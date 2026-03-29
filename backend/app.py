import os
import psycopg2
from psycopg2.extras import RealDictCursor
from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import date, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv

# Initialize environment variables
basedir = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(basedir, '.env'))

# Initialize Flask application and enable Cross-Origin Resource Sharing
app = Flask(__name__)
CORS(app)

# --- DATABASE WRAPPER ---
# Provides a standardized interface for executing psycopg2 queries 
# to maintain backward compatibility with previous architecture.
class DBWrapper:
    def __init__(self, conn):
        self.conn = conn

    def execute(self, query, params=()):
        cur = self.conn.cursor()
        cur.execute(query, params)
        return cur

    def commit(self):
        self.conn.commit()

    def close(self):
        self.conn.close()

def get_db():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise ValueError("Configuration Error: DATABASE_URL is missing from the environment.")
    
    conn = psycopg2.connect(db_url, cursor_factory=RealDictCursor)
    return DBWrapper(conn)

# --- CLOUD DATABASE SETUP ROUTE ---
@app.route("/init-db")
def init_db():
    conn = get_db()
    try:
        conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            first VARCHAR(100),
            last VARCHAR(100),
            email VARCHAR(120) UNIQUE,
            password VARCHAR(255),
            role VARCHAR(20),
            company_name VARCHAR(150),
            university VARCHAR(150),
            major VARCHAR(100),
            graduation_year VARCHAR(10),
            skills TEXT
        );
        """)
        conn.execute("""
        CREATE TABLE IF NOT EXISTS internships (
            id SERIAL PRIMARY KEY,
            sme_id INTEGER REFERENCES users(id),
            title VARCHAR(150),
            description TEXT,
            location VARCHAR(100),
            start_date VARCHAR(20),
            end_date VARCHAR(20),
            is_active INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)
        conn.execute("""
        CREATE TABLE IF NOT EXISTS applications (
            id SERIAL PRIMARY KEY,
            student_id INTEGER REFERENCES users(id),
            internship_id INTEGER REFERENCES internships(id),
            status VARCHAR(50) DEFAULT 'Pending',
            application_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)
        conn.commit()
        return "Database schema initialized successfully."
    except Exception as e:
        return f"Schema initialization failed: {e}"
    finally:
        conn.close()

# --- INTERNSHIP API ROUTES ---
@app.route("/api/internships", methods=["GET", "POST", "DELETE", "PUT"])
def api_internships():
    conn = get_db()
    
    if request.method == "POST":
        data = request.json
        try:
            conn.execute(
                "INSERT INTO internships (sme_id, title, description, location, start_date, end_date, is_active) VALUES (%s, %s, %s, %s, %s, %s, 1)",
                (data["sme_id"], data["title"], data["description"], data["location"], data["start_date"], data["end_date"])
            )
            conn.commit()
            return jsonify({"status": "success", "message": "Internship published successfully."})
        except Exception as e:
            try:
                conn.execute(
                    "INSERT INTO internships (sme_id, title, description, location, start_date, end_date) VALUES (%s, %s, %s, %s, %s, %s)",
                    (data["sme_id"], data["title"], data["description"], data["location"], data["start_date"], data["end_date"])
                )
                conn.commit()
                return jsonify({"status": "success", "message": "Internship published successfully."})
            except Exception as inner_e:
                return jsonify({"status": "error", "message": "Database transaction error."})
        finally:
            conn.close()
            
    elif request.method == "PUT": 
        data = request.json
        internship_id = data.get("internship_id")
        try:
            conn.execute(
                "UPDATE internships SET title=%s, description=%s, location=%s, start_date=%s, end_date=%s WHERE id=%s AND sme_id=%s",
                (data["title"], data["description"], data["location"], data["start_date"], data["end_date"], internship_id, data["sme_id"])
            )
            conn.commit()
            return jsonify({"status": "success", "message": "Internship record updated."})
        except Exception as e:
            return jsonify({"status": "error", "message": "Failed to update record."})
        finally:
            conn.close()
            
    elif request.method == "DELETE":
        data = request.json
        internship_id = data.get("internship_id")
        if not internship_id:
            conn.close()
            return jsonify({"status": "error", "message": "Missing resource identifier."}), 400
        try:
            conn.execute("UPDATE internships SET is_active = 0 WHERE id = %s", (internship_id,))
            conn.commit()
            return jsonify({"status": "success", "message": "Internship closed successfully."})
        except Exception as e:
            return jsonify({"status": "error", "message": "Failed to close internship."})
        finally:
            conn.close()
            
    else:
        # GET request handling
        jobs = conn.execute("""
            SELECT i.*, u.company_name 
            FROM internships i 
            JOIN users u ON i.sme_id = u.id 
            WHERE i.is_active = 1 OR i.is_active IS NULL
            ORDER BY i.created_at DESC
        """).fetchall()
        conn.close()
        return jsonify([dict(ix) for ix in jobs])

# --- APPLICATION TRACKING API ---
@app.route("/api/applications", methods=["GET", "POST", "PUT"])
def api_applications():
    conn = get_db()
    
    if request.method == "POST": 
        data = request.json
        existing = conn.execute("SELECT * FROM applications WHERE student_id=%s AND internship_id=%s", 
                               (data["student_id"], data["internship_id"])).fetchone()
        if existing:
            return jsonify({"status": "error", "message": "Application already exists for this candidate."})
        try:
            conn.execute(
                "INSERT INTO applications (student_id, internship_id) VALUES (%s, %s)",
                (data["student_id"], data["internship_id"])
            )
            conn.commit()
            return jsonify({"status": "success", "message": "Application submitted."})
        except Exception:
            return jsonify({"status": "error", "message": "Transaction failed."})
        finally:
            conn.close()
            
    elif request.method == "GET": 
        user_id = request.args.get("user_id")
        role = request.args.get("role")
        
        if role == "sme":
            apps = conn.execute("""
                SELECT a.id as app_id, a.status, a.application_date, 
                       u.first, u.last, u.email, u.university, u.major, u.graduation_year, u.skills,
                       i.title 
                FROM applications a
                JOIN users u ON a.student_id = u.id
                JOIN internships i ON a.internship_id = i.id
                WHERE i.sme_id = %s ORDER BY a.application_date DESC
            """, (user_id,)).fetchall()
        else:
            apps = conn.execute("""
                SELECT a.id as app_id, a.status, a.application_date, 
                       i.title, i.location, u.company_name
                FROM applications a
                JOIN internships i ON a.internship_id = i.id
                JOIN users u ON i.sme_id = u.id
                WHERE a.student_id = %s ORDER BY a.application_date DESC
            """, (user_id,)).fetchall()
            
        conn.close()
        return jsonify([dict(ix) for ix in apps])
        
    elif request.method == "PUT": 
        data = request.json
        conn.execute("UPDATE applications SET status = %s WHERE id = %s", (data["status"], data["app_id"]))
        conn.commit()
        conn.close()
        return jsonify({"status": "success", "message": f"Candidate marked as {data['status']}."})

# --- SME LIVE METRICS API ---
@app.route("/api/sme_metrics/applications_timeseries", methods=["GET"])
def sme_applications_timeseries():
    sme_id = request.args.get("user_id")
    if not sme_id:
        return jsonify({"status": "error", "message": "Identifier required."}), 400

    conn = get_db()
    try:
        rows = conn.execute(
            """
            SELECT TO_CHAR(COALESCE(a.application_date, CURRENT_TIMESTAMP), 'YYYY-MM-DD') AS day, COUNT(*) AS cnt
            FROM applications a
            JOIN internships i ON a.internship_id = i.id
            WHERE i.sme_id = %s
              AND COALESCE(a.application_date, CURRENT_TIMESTAMP) >= CURRENT_DATE - INTERVAL '6 days'
            GROUP BY day
            ORDER BY day ASC
            """,
            (sme_id,),
        ).fetchall()
    finally:
        conn.close()

    counts_by_day = {r["day"]: int(r["cnt"]) for r in rows}
    labels = []
    counts = []
    for offset in range(6, -1, -1):
        d = (date.today() - timedelta(days=offset)).isoformat()
        labels.append(d)
        counts.append(counts_by_day.get(d, 0))

    return jsonify({"status": "success", "labels": labels, "counts": counts})

# --- SKILL PROFILE API ---
@app.route("/api/profile", methods=["GET", "PUT"])
def api_profile():
    conn = get_db()
    
    if request.method == "GET": 
        user_id = request.args.get("user_id")
        user = conn.execute("SELECT university, major, graduation_year, skills FROM users WHERE id=%s", (user_id,)).fetchone()
        conn.close()
        return jsonify(dict(user) if user else {})
        
    elif request.method == "PUT": 
        data = request.json
        try:
            conn.execute(
                "UPDATE users SET university=%s, major=%s, graduation_year=%s, skills=%s WHERE id=%s",
                (data.get("university"), data.get("major"), data.get("graduation_year"), data.get("skills"), data.get("user_id"))
            )
            conn.commit()
            return jsonify({"status": "success", "message": "Profile updated."})
        except Exception as e:
            return jsonify({"status": "error", "message": "Profile update failed."})
        finally:
            conn.close()

# --- SKILL-BASED MATCHING ENGINE ---
@app.route("/api/match", methods=["GET"])
def match_internships():
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"status": "error", "message": "Identifier required."})

    conn = get_db()
    student = conn.execute("SELECT skills FROM users WHERE id=%s", (user_id,)).fetchone()
    if not student or not student["skills"]:
        conn.close()
        return jsonify({"status": "error", "message": "Profile lacks skill data. Please update profile."})

    raw_skills = student["skills"].split(",")
    skills = [s.strip().lower() for s in raw_skills if s.strip()]

    jobs = conn.execute("""
        SELECT i.*, u.company_name 
        FROM internships i 
        JOIN users u ON i.sme_id = u.id 
        WHERE i.is_active = 1 OR i.is_active IS NULL
    """).fetchall() 
    conn.close()

    matched_jobs = []
    for job in jobs:
        job_dict = dict(job)
        score = 0
        job_text = (job_dict["title"] + " " + job_dict["description"]).lower()
        for skill in skills:
            if skill in job_text:
                score += 1
        if score > 0:
            job_dict["match_score"] = score
            matched_jobs.append(job_dict)

    matched_jobs.sort(key=lambda x: x["match_score"], reverse=True)
    return jsonify({"status": "success", "matches": matched_jobs})

# --- AUTHENTICATION ROUTES ---
@app.route("/register", methods=["POST"])
def register():
    data = request.json
    if not data or not all(k in data for k in ("first", "last", "email", "password", "role")):
        return jsonify({"status": "error", "message": "Incomplete payload."}), 400

    hashed_password = generate_password_hash(data["password"])
    company_name = data.get("companyName", "") 
    
    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO users (first, last, email, password, role, company_name) VALUES (%s, %s, %s, %s, %s, %s)",
            (data["first"], data["last"], data["email"], hashed_password, data["role"], company_name)
        )
        conn.commit()
        return jsonify({"status": "success", "message": "Registration successful."})
    except psycopg2.IntegrityError:
        return jsonify({"status": "error", "message": "Email is already provisioned."})
    finally:
        conn.close()

@app.route("/login", methods=["POST"])
def login():
    data = request.json
    if not data or "email" not in data or "password" not in data:
        return jsonify({"status": "error", "message": "Incomplete credentials."}), 400

    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE email=%s", (data["email"],)).fetchone()
    conn.close()

    if user and check_password_hash(user["password"], data["password"]):
        return jsonify({"status": "success", "role": user["role"], "user_id": user["id"]})
    else:
        return jsonify({"status": "error", "message": "Authentication failed."})

if __name__ == "__main__":
    app.run(debug=True)