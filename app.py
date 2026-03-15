from flask import Flask, render_template, request, jsonify
import sqlite3
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)

def get_db():
    conn = sqlite3.connect("database.db")
    conn.row_factory = sqlite3.Row
    return conn

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/register", methods=["POST"])
def register():
    data = request.json

    # Safety Check: Did they send all the required info?
    if not data or not all(k in data for k in ("first", "last", "email", "password")):
        return jsonify({"status": "error", "message": "Missing data"}), 400

    first = data["first"]
    last = data["last"]
    email = data["email"]
    password = data["password"]

    # Scramble the password so it is unreadable in the database
    hashed_password = generate_password_hash(password)

    conn = get_db()
    
    try:
        conn.execute(
            "INSERT INTO users (first, last, email, password) VALUES (?, ?, ?, ?)",
            (first, last, email, hashed_password)
        )
        conn.commit()
        return jsonify({"status": "success", "message": "User registered successfully!"})
        
    except sqlite3.IntegrityError:
        # The database blocked this because the email already exists
        return jsonify({"status": "error", "message": "Email already registered."})
        
    finally:
        conn.close()


@app.route("/login", methods=["POST"])
def login():
    data = request.json

    # Safety Check
    if not data or "email" not in data or "password" not in data:
        return jsonify({"status": "error", "message": "Missing credentials"}), 400

    email = data["email"]
    password = data["password"]

    conn = get_db()
    
    # Only search by email first
    user = conn.execute(
        "SELECT * FROM users WHERE email=?", 
        (email,)
    ).fetchone()
    
    conn.close()

    # If the user exists AND the typed password matches the scrambled one
    if user and check_password_hash(user["password"], password):
        return jsonify({"status": "success"})
    else:
        return jsonify({"status": "error", "message": "Invalid email or password"})


if __name__ == "__main__":
    app.run(debug=True)