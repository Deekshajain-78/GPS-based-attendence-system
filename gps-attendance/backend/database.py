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
            profile_photo TEXT,
            github TEXT,
            linkedin TEXT,
            mobile_number TEXT,
            performance_points INTEGER DEFAULT 0
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

        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            date TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS leave_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            reason TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            admin_comment TEXT,
            requested_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS meetings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_by INTEGER NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            scheduled_for TEXT NOT NULL,
            user_id INTEGER DEFAULT NULL,
            status TEXT NOT NULL DEFAULT 'scheduled',
            created_at TEXT NOT NULL,
            meeting_link TEXT,
            FOREIGN KEY (created_by) REFERENCES users(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS meeting_responses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            meeting_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            response TEXT NOT NULL CHECK(response IN ('accept','decline','maybe')),
            responded_at TEXT NOT NULL,
            FOREIGN KEY (meeting_id) REFERENCES meetings(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS referrals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            referrer_id INTEGER NOT NULL,
            candidate_name TEXT NOT NULL,
            candidate_email TEXT NOT NULL,
            resume_url TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            bonus_awarded INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (referrer_id) REFERENCES users(id)
        );
    """)
    # Add new columns if existing schema lacks them
    existing = [r['name'] for r in conn.execute("PRAGMA table_info(users)").fetchall()]
    if 'github' not in existing:
        conn.execute("ALTER TABLE users ADD COLUMN github TEXT")
    if 'linkedin' not in existing:
        conn.execute("ALTER TABLE users ADD COLUMN linkedin TEXT")
    if 'mobile_number' not in existing:
        conn.execute("ALTER TABLE users ADD COLUMN mobile_number TEXT")
    if 'performance_points' not in existing:
        conn.execute("ALTER TABLE users ADD COLUMN performance_points INTEGER DEFAULT 0")

    existing_meetings = [r['name'] for r in conn.execute("PRAGMA table_info(meetings)").fetchall()]
    if 'meeting_link' not in existing_meetings:
        conn.execute("ALTER TABLE meetings ADD COLUMN meeting_link TEXT")

    conn.commit()
    conn.close()
