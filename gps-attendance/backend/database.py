import sqlite3, os

DB_PATH = os.path.join(os.path.dirname(__file__), "attendance.db")
PHOTOS_DIR = os.path.join(os.path.dirname(__file__), "photos")
os.makedirs(PHOTOS_DIR, exist_ok=True)

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            profile_photo TEXT
        );

        CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('in','out')),
            timestamp TEXT NOT NULL,
            selfie_path TEXT,
            face_match INTEGER DEFAULT 0,
            accuracy REAL,
            speed REAL,
            fake_gps_detected INTEGER DEFAULT 0,
            fake_gps_reason TEXT,
            ip_address TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
    """)
    conn.commit()
    conn.close()
