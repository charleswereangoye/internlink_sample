import sqlite3

conn = sqlite3.connect("database.db")

try:
    conn.execute("ALTER TABLE users ADD COLUMN university TEXT")
    conn.execute("ALTER TABLE users ADD COLUMN major TEXT")
    conn.execute("ALTER TABLE users ADD COLUMN graduation_year INTEGER")
    conn.execute("ALTER TABLE users ADD COLUMN skills TEXT")
    print("Skill Profile columns added successfully!")
except Exception as e:
    print("Notice:", e)

conn.commit()
conn.close()