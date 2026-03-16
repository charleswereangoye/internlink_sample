import sqlite3

conn = sqlite3.connect("database.db")

# Drop the old table to start fresh
conn.execute("DROP TABLE IF EXISTS users")

conn.execute("""
CREATE TABLE users(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first TEXT,
    last TEXT,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT,           -- Identifies if they are a 'student' or 'sme'
    company_name TEXT    -- Only filled out if the role is 'sme'
)
""")

conn.commit()
conn.close()

print("Database updated with User Roles!")