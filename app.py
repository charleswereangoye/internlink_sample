from flask import Flask, render_template, request, jsonify
import sqlite3
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)

def get_db():
    conn = sqlite3.connect("database.db")
    conn.row_factory = sqlite3.Row
    return conn

# --- HTML PAGE ROUTES ---
@app.route("/")
def home():
    return render_template("index.html")

@app.route("/internships")
def internships():
    return render_template("listing.html")

@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html")

@app.route("/sme_dashboard")
def sme_dashboard():
    return render_template("sme_dashboard.html")

# --- INTERNSHIP API ROUTES ---
@app.route("/api/internships", methods=["GET", "POST"])
def api_internships():
    conn = get_db()
    
    if request.method == "POST":
        data = request.json
        try:
            conn.execute(
                "INSERT INTO internships (sme_id, title, description, location, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)",
                (data["sme_id"], data["title"], data["description"], data["location"], data["start_date"], data["end_date"])
            )
            conn.commit()
            return jsonify({"status": "success", "message": "Internship published!"})
        except Exception as e:
            return jsonify({"status": "error", "message": "Database error"})
        finally:
            conn.close()
            
    else: # GET request (Fetching jobs for the listings page)
        # We join the tables to get the SME's company_name on the job card
        jobs = conn.execute("""
            SELECT i.*, u.company_name 
            FROM internships i 
            JOIN users u ON i.sme_id = u.id 
            ORDER BY i.created_at DESC
        """).fetchall()
        conn.close()
        return jsonify([dict(ix) for ix in jobs])

# --- APPLICATION TRACKING API ---
@app.route("/api/applications", methods=["GET", "POST", "PUT"])
def api_applications():
    conn = get_db()
    
    if request.method == "POST": # A student clicks "Apply"
        data = request.json
        
        # Check if they already applied to prevent spam
        existing = conn.execute("SELECT * FROM applications WHERE student_id=? AND internship_id=?", 
                               (data["student_id"], data["internship_id"])).fetchone()
        if existing:
            return jsonify({"status": "error", "message": "You already applied to this internship."})
            
        try:
            conn.execute(
                "INSERT INTO applications (student_id, internship_id) VALUES (?, ?)",
                (data["student_id"], data["internship_id"])
            )
            conn.commit()
            return jsonify({"status": "success", "message": "Application submitted successfully!"})
        except Exception:
            return jsonify({"status": "error", "message": "Failed to submit application."})
        finally:
            conn.close()
            
    elif request.method == "GET": # Dashboards fetching the application list
        user_id = request.args.get("user_id")
        role = request.args.get("role")
        
        if role == "sme":
            # SMEs see who applied to THEIR jobs
            apps = conn.execute("""
                SELECT a.id as app_id, a.status, a.application_date, 
                       u.first, u.last, u.email, i.title 
                FROM applications a
                JOIN users u ON a.student_id = u.id
                JOIN internships i ON a.internship_id = i.id
                WHERE i.sme_id = ? ORDER BY a.application_date DESC
            """, (user_id,)).fetchall()
        else:
            # Students see their own application history
            apps = conn.execute("""
                SELECT a.id as app_id, a.status, a.application_date, 
                       i.title, i.location, u.company_name
                FROM applications a
                JOIN internships i ON a.internship_id = i.id
                JOIN users u ON i.sme_id = u.id
                WHERE a.student_id = ? ORDER BY a.application_date DESC
            """, (user_id,)).fetchall()
            
        conn.close()
        return jsonify([dict(ix) for ix in apps])
        
    elif request.method == "PUT": # SME accepts or rejects an application
        data = request.json
        conn.execute("UPDATE applications SET status = ? WHERE id = ?", (data["status"], data["app_id"]))
        conn.commit()
        conn.close()
        return jsonify({"status": "success", "message": f"Application marked as {data['status']}!"})

# --- SKILL PROFILE API (MOVED ABOVE APP.RUN) ---
@app.route("/api/profile", methods=["GET", "PUT"])
def api_profile():
    conn = get_db()
    
    if request.method == "GET": # Load the profile data
        user_id = request.args.get("user_id")
        user = conn.execute("SELECT university, major, graduation_year, skills FROM users WHERE id=?", (user_id,)).fetchone()
        conn.close()
        
        # If user exists, return their data, otherwise return empty dictionary
        return jsonify(dict(user) if user else {})
        
    elif request.method == "PUT": # Save the profile data
        data = request.json
        try:
            conn.execute(
                "UPDATE users SET university=?, major=?, graduation_year=?, skills=? WHERE id=?",
                (data.get("university"), data.get("major"), data.get("graduation_year"), data.get("skills"), data.get("user_id"))
            )
            conn.commit()
            return jsonify({"status": "success", "message": "Skill Profile updated!"})
        except Exception as e:
            print("🚨 CRASH REPORT:", e) 
            return jsonify({"status": "error", "message": "Failed to update profile."})
        finally:
            conn.close()

# --- SKILL-BASED MATCHING ENGINE ---
@app.route("/api/match", methods=["GET"])
def match_internships():
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"status": "error", "message": "User ID required"})

    conn = get_db()
    
    # 1. Get the student's saved skills
    student = conn.execute("SELECT skills FROM users WHERE id=?", (user_id,)).fetchone()
    if not student or not student["skills"]:
        conn.close()
        return jsonify({"status": "error", "message": "No skills found. Please update your profile first!"})

    # Clean up the skills list (e.g., "Python, React" -> ["python", "react"])
    raw_skills = student["skills"].split(",")
    skills = [s.strip().lower() for s in raw_skills if s.strip()]

    # 2. Get all local internships
    jobs = conn.execute("""
        SELECT i.*, u.company_name 
        FROM internships i 
        JOIN users u ON i.sme_id = u.id 
        WHERE i.is_active = 1
    """).fetchall()
    conn.close()

    # 3. The Matching Algorithm
    matched_jobs = []
    for job in jobs:
        job_dict = dict(job)
        score = 0
        # Combine title and description and make it lowercase for scanning
        job_text = (job_dict["title"] + " " + job_dict["description"]).lower()
        
        # Count how many of the student's skills appear in the job text
        for skill in skills:
            if skill in job_text:
                score += 1
        
        # Only keep jobs that have at least 1 matching skill
        if score > 0:
            job_dict["match_score"] = score
            matched_jobs.append(job_dict)

    # Sort the results so the highest matching score appears first
    matched_jobs.sort(key=lambda x: x["match_score"], reverse=True)

    return jsonify({"status": "success", "matches": matched_jobs})

# --- AUTHENTICATION ROUTES ---
@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "GET":
        return render_template("register.html")
        
    data = request.json
    if not data or not all(k in data for k in ("first", "last", "email", "password", "role")):
        return jsonify({"status": "error", "message": "Missing data"}), 400

    hashed_password = generate_password_hash(data["password"])
    company_name = data.get("companyName", "") 
    
    conn = get_db()
    
    try:
        conn.execute(
            "INSERT INTO users (first, last, email, password, role, company_name) VALUES (?, ?, ?, ?, ?, ?)",
            (data["first"], data["last"], data["email"], hashed_password, data["role"], company_name)
        )
        conn.commit()
        return jsonify({"status": "success", "message": "User registered successfully!"})
    except sqlite3.IntegrityError:
        return jsonify({"status": "error", "message": "Email already registered."})
    finally:
        conn.close()

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "GET":
        return render_template("login.html")

    data = request.json
    if not data or "email" not in data or "password" not in data:
        return jsonify({"status": "error", "message": "Missing credentials"}), 400

    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE email=?", (data["email"],)).fetchone()
    conn.close()

    if user and check_password_hash(user["password"], data["password"]):
        # Return the role AND user_id so the frontend knows who is posting
        return jsonify({"status": "success", "role": user["role"], "user_id": user["id"]})
    else:
        return jsonify({"status": "error", "message": "Invalid email or password"})

# THIS MUST ALWAYS REMAIN AT THE VERY BOTTOM OF THE FILE
if __name__ == "__main__":
    app.run(debug=True)