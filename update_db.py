import sqlite3

conn = sqlite3.connect("database.db")

conn.execute("""
CREATE TABLE IF NOT EXISTS internships(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sme_id INTEGER,
    title TEXT,
    description TEXT,
    location TEXT,
    start_date TEXT,
    end_date TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(sme_id) REFERENCES users(id)
)
""")

conn.commit()
conn.close()

print("Internships table added successfully!")