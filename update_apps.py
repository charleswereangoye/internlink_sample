import sqlite3

conn = sqlite3.connect("database.db")

conn.execute("""
CREATE TABLE IF NOT EXISTS applications(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER,
    internship_id INTEGER,
    status TEXT DEFAULT 'Pending',
    application_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(student_id) REFERENCES users(id),
    FOREIGN KEY(internship_id) REFERENCES internships(id)
)
""")

conn.commit()
conn.close()

print("Applications tracking table activated!")