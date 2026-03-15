import sqlite3

conn = sqlite3.connect("database.db")

conn.execute("""
CREATE TABLE users(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first TEXT,
    last TEXT,
    email TEXT UNIQUE, 
    password TEXT
)
""")

conn.commit()
conn.close()

print("Secure Database created")