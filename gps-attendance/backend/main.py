from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
from math import radians, sin, cos, sqrt, atan2
from typing import Optional
import base64, os, uuid, logging, httpx, requests
from geopy.distance import geodesic

from database import get_db, init_db, PHOTOS_DIR
from telegram_config import BOT_TOKEN, CHAT_ID

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs(PHOTOS_DIR, exist_ok=True)
app.mount("/photos", StaticFiles(directory=PHOTOS_DIR), name="photos")

init_db()


# ── Set your office coordinates here ──
OFFICE_LAT =12.9584217
OFFICE_LON = 77.5012103
ALLOWED_RADIUS_METERS = 100

IST = timezone(timedelta(hours=5, minutes=30))

def ist_now():
    return datetime.now(IST)

def is_inside_geofence(user_lat, user_lon, office_lat, office_lon, radius_meters=100):
    """Check if user is within geofence using geopy.distance"""
    user_location = (user_lat, user_lon)
    office_location = (office_lat, office_lon)
    distance = geodesic(user_location, office_location).meters
    return distance <= radius_meters, distance

def save_base64_image(b64_string: str, filename: str):
    if "," in b64_string:
        b64_string = b64_string.split(",")[1]
    with open(os.path.join(PHOTOS_DIR, filename), "wb") as f:
        f.write(base64.b64decode(b64_string))

def compare_faces(img1_path: str, img2_path: str) -> bool:
    try:
        from deepface import DeepFace
        result = DeepFace.verify(img1_path, img2_path, model_name="Facenet", enforce_detection=False)
        return result["verified"]
    except ImportError:
        logger.warning("DeepFace library not available, skipping face verification")
        return True  # Allow attendance if library is not installed
    except Exception as e:
        logger.warning(f"Face comparison failed: {e}. Allowing attendance for now.")
        return True  # Allow attendance if face comparison fails

def send_telegram(message: str):
    if BOT_TOKEN == "YOUR_BOT_TOKEN_HERE" or CHAT_ID == "YOUR_CHAT_ID_HERE":
        return
    try:
        url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
        httpx.post(url, json={"chat_id": CHAT_ID, "text": message, "parse_mode": "HTML"}, timeout=5)
    except Exception as e:
        logger.warning(f"Telegram alert failed: {e}")

# ── Schemas ──
class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    selfie: Optional[str] = None

class AttendanceRequest(BaseModel):
    user_id: int
    latitude: float
    longitude: float
    type: str
    selfie: str
    accuracy: Optional[float] = None
    speed: Optional[float] = None
    sensor_data: Optional[dict] = None

class TaskRequest(BaseModel):
    user_id: int
    title: str
    description: Optional[str] = ''
    date: Optional[str] = None
    status: Optional[str] = 'pending'

class LeaveRequest(BaseModel):
    user_id: int
    start_date: str
    end_date: str
    reason: str

class MeetingRequest(BaseModel):
    created_by: int
    title: str
    description: Optional[str] = None
    scheduled_for: str
    user_id: Optional[int] = None
    meeting_link: Optional[str] = None

class MeetingResponseRequest(BaseModel):
    user_id: int
    response: str

class ReferralRequest(BaseModel):
    referrer_id: int
    candidate_name: str
    candidate_email: str
    resume_url: Optional[str] = None

class ReferralStatusUpdate(BaseModel):
    status: str
    bonus_awarded: Optional[bool] = False

class UserUpdateRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    profile_photo: Optional[str] = None
    github: Optional[str] = None
    linkedin: Optional[str] = None
    mobile_number: Optional[str] = None
    performance_points: Optional[int] = None

# ── Fake GPS Detection Functions ──
def get_ip_location(ip_address: str) -> tuple:
    """Get location from IP address using ip-api.com"""
    try:
        response = requests.get(f"http://ip-api.com/json/{ip_address}", timeout=5)
        data = response.json()
        if data.get("status") == "success":
            return data.get("lat"), data.get("lon")
    except Exception as e:
        logger.warning(f"IP geolocation failed: {e}")
    return None, None

def detect_fake_gps(req: AttendanceRequest, client_ip: str) -> tuple:
    """
    Comprehensive fake GPS detection
    Returns: (is_fake, reason, details)
    """
    issues = []
    details = {}

    # 1. Accuracy Check
    if req.accuracy and req.accuracy > 50:
        issues.append("Low GPS accuracy")
        details["accuracy"] = f"{req.accuracy:.1f}m (should be < 50m)"

    # 2. Speed Check - Check for sudden jumps
    db = get_db()
    last_record = db.execute(
        "SELECT latitude, longitude, timestamp FROM attendance WHERE user_id=? ORDER BY timestamp DESC LIMIT 1",
        (req.user_id,)
    ).fetchone()

    if last_record:
        last_lat, last_lon = last_record["latitude"], last_record["longitude"]
        last_time = datetime.fromisoformat(last_record["timestamp"]).replace(tzinfo=timezone.utc)

        # Calculate time difference and distance
        current_time = datetime.now(timezone.utc)
        time_diff = (current_time - last_time).total_seconds() / 3600  # hours
        distance = geodesic((req.latitude, req.longitude), (last_lat, last_lon)).meters

        if time_diff > 0:
            speed_kmh = distance / 1000 / time_diff  # km/h
            details["speed"] = f"{speed_kmh:.1f} km/h"

            # Flag suspicious speeds (> 200 km/h or instant teleportation)
            if speed_kmh > 200 or (time_diff < 0.01 and distance > 100):
                issues.append("Suspicious movement speed")
                details["speed_issue"] = f"{speed_kmh:.1f} km/h over {time_diff:.2f} hours"

    # 3. IP + GPS mismatch
    if client_ip and client_ip != "127.0.0.1" and not client_ip.startswith("192.168."):
        ip_lat, ip_lon = get_ip_location(client_ip)
        if ip_lat and ip_lon:
            ip_distance = geodesic((req.latitude, req.longitude), (ip_lat, ip_lon)).meters
            details["ip_distance"] = f"{ip_distance:.0f}m"

            # If IP location is more than 50km from GPS location, suspicious
            if ip_distance > 50000:  # 50km
                issues.append("IP location mismatch")
                details["ip_mismatch"] = f"IP suggests location {ip_distance:.0f}m away"

    # 4. Device Sensor Check (basic)
    if req.sensor_data:
        # Check for accelerometer data indicating movement
        accel = req.sensor_data.get("accelerometer", {})
        if accel:
            # If device shows high acceleration but GPS shows no movement, suspicious
            accel_magnitude = (accel.get("x", 0)**2 + accel.get("y", 0)**2 + accel.get("z", 0)**2)**0.5
            if accel_magnitude > 15:  # High acceleration
                details["high_acceleration"] = f"{accel_magnitude:.1f} m/s²"
                # Could be suspicious if combined with other factors

    db.close()

    is_fake = len(issues) > 0
    reason = "; ".join(issues) if issues else "Location verified"

    return is_fake, reason, details

# ── Routes ──
@app.post("/register")
def register(req: RegisterRequest):
    try:
        db = get_db()
        if db.execute("SELECT id FROM users WHERE email=?", (req.email,)).fetchone():
            db.close()
            raise HTTPException(status_code=400, detail="Email already registered")

        profile_path = None
        if req.selfie:
            filename = f"profile_{uuid.uuid4().hex}.jpg"
            save_base64_image(req.selfie, filename)
            profile_path = f"photos/{filename}"

        db.execute(
            "INSERT INTO users (name, email, password, profile_photo) VALUES (?, ?, ?, ?)",
            (req.name, req.email, req.password, profile_path)
        )
        db.commit()
        db.close()
        return {"message": "Registration successful"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Register error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/login")
def login(req: LoginRequest):
    db = get_db()
    user = db.execute(
        "SELECT id, name, email, profile_photo, github, linkedin, mobile_number FROM users WHERE email=? AND password=?",
        (req.email, req.password)
    ).fetchone()
    db.close()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password. Only registered users can login.")
    return {
        "id": user["id"], "name": user["name"], "email": user["email"], "profile_photo": user["profile_photo"],
        "github": user["github"], "linkedin": user["linkedin"], "mobile_number": user["mobile_number"]
    }

@app.post("/attendance")
def mark_attendance(req: AttendanceRequest, request: Request):
    try:
        if req.type not in ("in", "out"):
            raise HTTPException(status_code=400, detail="type must be 'in' or 'out'")

        # Get client IP for fake GPS detection
        client_ip = request.client.host if request.client else None

        # Fake GPS Detection
        is_fake_gps, fake_reason, fake_details = detect_fake_gps(req, client_ip)

        # Geofencing Check
        is_inside, distance = is_inside_geofence(req.latitude, req.longitude, OFFICE_LAT, OFFICE_LON, ALLOWED_RADIUS_METERS)

        if not is_inside:
            raise HTTPException(
                status_code=403,
                detail=f"You are {int(distance)}m away from the office. Must be within {ALLOWED_RADIUS_METERS}m."
            )

        # If fake GPS detected, still allow but log it
        if is_fake_gps:
            logger.warning(f"Fake GPS detected for user {req.user_id}: {fake_reason}")
            send_telegram(
                f"🚨 <b>Suspicious Location Activity</b>\n"
                f"👤 User ID: {req.user_id}\n"
                f"📍 GPS: {req.latitude:.5f}, {req.longitude:.5f}\n"
                f"⚠️ Issue: {fake_reason}\n"
                f"📊 Details: {fake_details}\n"
                f"🕐 Time: {ist_now().strftime('%d %b %Y, %I:%M %p')} IST"
            )

        selfie_filename = f"selfie_{req.user_id}_{uuid.uuid4().hex}.jpg"
        save_base64_image(req.selfie, selfie_filename)
        selfie_path = f"photos/{selfie_filename}"

        db = get_db()
        user = db.execute("SELECT profile_photo FROM users WHERE id=?", (req.user_id,)).fetchone()

        face_match = 0
        if user and user["profile_photo"]:
            try:
                profile_abs = os.path.join(os.path.dirname(__file__), user["profile_photo"])
                selfie_abs = os.path.join(PHOTOS_DIR, selfie_filename)
                if not compare_faces(profile_abs, selfie_abs):
                    db.close()
                    send_telegram(
                        f"🚨 <b>Fake Attempt Detected!</b>\n"
                        f"👤 User ID: {req.user_id}\n"
                        f"📍 Location: {req.latitude:.5f}, {req.longitude:.5f}\n"
                        f"🕐 Time: {ist_now().strftime('%d %b %Y, %I:%M %p')} IST\n"
                        f"❌ Face did not match registered profile."
                    )
                    raise HTTPException(status_code=403, detail="Face does not match registered profile. Attendance denied.")
                face_match = 1
            except HTTPException:
                raise
            except Exception as e:
                logger.warning(f"Face check error, allowing attendance: {e}")
                face_match = 1
        else:
            db.execute("UPDATE users SET profile_photo=? WHERE id=?", (selfie_path, req.user_id))
            db.commit()
            face_match = 1

        db.execute(
            "INSERT INTO attendance (user_id, latitude, longitude, type, timestamp, selfie_path, face_match, accuracy, speed, fake_gps_detected, fake_gps_reason, ip_address) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            (req.user_id, req.latitude, req.longitude, req.type, datetime.utcnow().isoformat(), selfie_path, face_match, req.accuracy, req.speed, 1 if is_fake_gps else 0, fake_reason if is_fake_gps else None, client_ip)
        )
        db.commit()

        user_info = db.execute("SELECT name FROM users WHERE id=?", (req.user_id,)).fetchone()
        name = user_info["name"] if user_info else f"User {req.user_id}"
        now = ist_now()
        time_str = now.strftime("%I:%M %p")
        date_str = now.strftime("%d %b %Y")
        is_late = req.type == "in" and (now.hour > 9 or (now.hour == 9 and now.minute > 0))

        if req.type == "in":
            emoji = "⏰" if is_late else "✅"
            status = "Late Check-in" if is_late else "Attendance Marked"
            send_telegram(
                f"{emoji} <b>{status}</b>\n"
                f"👤 Name: {name}\n"
                f"🕐 Time: {time_str} IST\n"
                f"📅 Date: {date_str}\n"
                f"📍 Location: <a href='https://maps.google.com/?q={req.latitude},{req.longitude}'>View on Map</a>"
            )
        else:
            send_telegram(
                f"🔴 <b>Check-out Recorded</b>\n"
                f"👤 Name: {name}\n"
                f"🕐 Time: {time_str} IST\n"
                f"📅 Date: {date_str}\n"
                f"📍 Location: <a href='https://maps.google.com/?q={req.latitude},{req.longitude}'>View on Map</a>"
            )

        db.close()
        return {"message": "Attendance recorded", "face_match": face_match}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Attendance error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/attendance/{user_id}")
def get_attendance(user_id: int):
    db = get_db()
    rows = db.execute(
        "SELECT * FROM attendance WHERE user_id=? ORDER BY timestamp DESC",
        (user_id,)
    ).fetchall()
    db.close()
    return [dict(r) for r in rows]

@app.get("/users/{user_id}")
def get_user(user_id: int):
    db = get_db()
    user = db.execute("SELECT id, name, email, profile_photo, github, linkedin, mobile_number, performance_points FROM users WHERE id=?", (user_id,)).fetchone()
    db.close()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return dict(user)

@app.put("/users/{user_id}")
def update_user(user_id: int, req: UserUpdateRequest):
    db = get_db()
    if not db.execute("SELECT id FROM users WHERE id=?", (user_id,)).fetchone():
        db.close()
        raise HTTPException(status_code=404, detail="User not found")

    fields = []
    params = []

    if req.name is not None:
        fields.append("name=?")
        params.append(req.name)
    if req.email is not None:
        fields.append("email=?")
        params.append(req.email)
    if req.password is not None:
        fields.append("password=?")
        params.append(req.password)

    if req.profile_photo:
        filename = f"profile_{uuid.uuid4().hex}.jpg"
        save_base64_image(req.profile_photo, filename)
        profile_path = f"photos/{filename}"
        fields.append("profile_photo=?")
        params.append(profile_path)

    if req.github is not None:
        fields.append("github=?")
        params.append(req.github)
    if req.linkedin is not None:
        fields.append("linkedin=?")
        params.append(req.linkedin)
    if req.mobile_number is not None:
        fields.append("mobile_number=?")
        params.append(req.mobile_number)

    if fields:
        params.append(user_id)
        db.execute(f"UPDATE users SET {', '.join(fields)} WHERE id=?", tuple(params))
        db.commit()

    user = db.execute("SELECT id, name, email, profile_photo, github, linkedin, mobile_number FROM users WHERE id=?", (user_id,)).fetchone()
    db.close()
    return dict(user)

@app.post("/tasks")
def create_task(req: TaskRequest):
    db = get_db()
    task_date = req.date or datetime.utcnow().date().isoformat()
    now = datetime.utcnow().isoformat()
    cursor = db.execute(
        "INSERT INTO tasks (user_id, title, description, date, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'pending', ?, ?)",
        (req.user_id, req.title, req.description, task_date, now, now)
    )
    db.commit()
    task_id = cursor.lastrowid
    db.close()
    return {"id": task_id, "message": "Task created"}

@app.get("/tasks/{user_id}")
def get_tasks(user_id: int):
    db = get_db()
    rows = db.execute(
        "SELECT * FROM tasks WHERE user_id=? ORDER BY date DESC, id DESC",
        (user_id,)
    ).fetchall()
    db.close()
    return [dict(r) for r in rows]

@app.post("/tasks/{task_id}")
def update_task(task_id: int, req: TaskRequest):
    db = get_db()
    now = datetime.utcnow().isoformat()
    new_status = req.status if req.status else 'pending'
    db.execute(
        "UPDATE tasks SET title=?, description=?, date=?, status=?, updated_at=? WHERE id=?",
        (req.title, req.description, req.date or datetime.utcnow().date().isoformat(), new_status, now, task_id)
    )
    db.commit()
    db.close()
    return {"message": "Task updated"}

@app.post("/tasks/{task_id}/complete")
def complete_task(task_id: int):
    db = get_db()
    now = datetime.utcnow().isoformat()
    db.execute("UPDATE tasks SET status='completed', updated_at=? WHERE id=?", (now, task_id))
    db.commit()
    db.close()
    return {"message": "Task completed"}

@app.post("/tasks/{task_id}/inprogress")
def inprogress_task(task_id: int):
    db = get_db()
    now = datetime.utcnow().isoformat()
    db.execute("UPDATE tasks SET status='in-progress', updated_at=? WHERE id=?", (now, task_id))
    db.commit()
    db.close()
    return {"message": "Task set in-progress"}

@app.post("/leaves")
def request_leave(req: LeaveRequest):
    db = get_db()
    now = datetime.utcnow().isoformat()
    cursor = db.execute(
        "INSERT INTO leave_requests (user_id, start_date, end_date, reason, status, requested_at, updated_at) VALUES (?, ?, ?, ?, 'pending', ?, ?)",
        (req.user_id, req.start_date, req.end_date, req.reason, now, now)
    )
    db.commit()
    leave_id = cursor.lastrowid
    db.close()
    return {"id": leave_id, "message": "Leave requested"}

@app.get("/leaves/{user_id}")
def get_leaves(user_id: int):
    db = get_db()
    rows = db.execute(
        "SELECT * FROM leave_requests WHERE user_id=? ORDER BY requested_at DESC",
        (user_id,)
    ).fetchall()
    db.close()
    return [dict(r) for r in rows]

@app.post("/meetings")
def create_meeting(req: MeetingRequest):
    db = get_db()
    now = datetime.utcnow().isoformat()
    cursor = db.execute(
        "INSERT INTO meetings (created_by, title, description, scheduled_for, user_id, status, created_at, meeting_link) VALUES (?, ?, ?, ?, ?, 'scheduled', ?, ?)",
        (req.created_by, req.title, req.description, req.scheduled_for, req.user_id, now, req.meeting_link)
    )
    db.commit()
    meeting_id = cursor.lastrowid
    db.close()
    return {"id": meeting_id, "message": "Meeting scheduled"}

@app.get("/meetings/{user_id}")
def get_meetings(user_id: int):
    db = get_db()
    rows = db.execute(
        "SELECT m.*, u.name AS organizer_name, "
        "(SELECT mr.response FROM meeting_responses mr WHERE mr.meeting_id=m.id AND mr.user_id=?) AS my_response "
        "FROM meetings m JOIN users u ON m.created_by=u.id "
        "WHERE m.user_id IS NULL OR m.user_id=? "
        "ORDER BY scheduled_for DESC",
        (user_id, user_id)
    ).fetchall()
    db.close()
    return [dict(r) for r in rows]

@app.post("/meetings/{meeting_id}/respond")
def respond_meeting(meeting_id: int, req: MeetingResponseRequest):
    if req.response not in ('accept', 'decline', 'maybe'):
        raise HTTPException(status_code=400, detail='Invalid response')
    db = get_db()
    now = datetime.utcnow().isoformat()
    existing = db.execute("SELECT id FROM meeting_responses WHERE meeting_id=? AND user_id=?", (meeting_id, req.user_id)).fetchone()
    if existing:
        db.execute("UPDATE meeting_responses SET response=?, responded_at=? WHERE id=?", (req.response, now, existing['id']))
    else:
        db.execute("INSERT INTO meeting_responses (meeting_id, user_id, response, responded_at) VALUES (?, ?, ?, ?)", (meeting_id, req.user_id, req.response, now))
    db.commit()
    db.close()
    return {"message": "Response recorded"}

@app.post("/referrals")
def create_referral(req: ReferralRequest):
    db = get_db()
    now = datetime.utcnow().isoformat()
    cursor = db.execute(
        "INSERT INTO referrals (referrer_id, candidate_name, candidate_email, resume_url, status, bonus_awarded, created_at, updated_at) VALUES (?, ?, ?, ?, 'pending', 0, ?, ?)",
        (req.referrer_id, req.candidate_name, req.candidate_email, req.resume_url, now, now)
    )
    db.commit()
    referral_id = cursor.lastrowid
    db.close()
    return {"id": referral_id, "message": "Referral submitted"}

@app.get("/referrals/{user_id}")
def get_referrals(user_id: int):
    db = get_db()
    rows = db.execute("SELECT * FROM referrals WHERE referrer_id=? ORDER BY created_at DESC", (user_id,)).fetchall()
    db.close()
    return [dict(r) for r in rows]

@app.get("/admin/meetings")
def admin_get_meetings():
    db = get_db()
    rows = db.execute("SELECT m.*, u.name AS organizer_name FROM meetings m JOIN users u ON m.created_by=u.id ORDER BY scheduled_for DESC").fetchall()
    db.close()
    return [dict(r) for r in rows]

@app.get("/admin/meeting-responses")
def admin_get_meeting_responses():
    db = get_db()
    rows = db.execute("SELECT mr.*, u.name AS user_name, m.title AS meeting_title FROM meeting_responses mr JOIN users u ON mr.user_id=u.id JOIN meetings m ON mr.meeting_id=m.id ORDER BY responded_at DESC").fetchall()
    db.close()
    return [dict(r) for r in rows]

@app.get("/admin/referrals")
def admin_get_referrals():
    db = get_db()
    rows = db.execute("SELECT r.*, u.name AS referrer_name, u.email AS referrer_email FROM referrals r JOIN users u ON r.referrer_id=u.id ORDER BY created_at DESC").fetchall()
    db.close()
    return [dict(r) for r in rows]

@app.put("/admin/referrals/{referral_id}")
def admin_update_referral(referral_id: int, req: ReferralStatusUpdate):
    if req.status not in ('pending', 'hired', 'rejected', 'done'):
        raise HTTPException(status_code=400, detail='Invalid status')
    db = get_db()
    now = datetime.utcnow().isoformat()
    bonus = 1 if req.bonus_awarded else 0
    db.execute("UPDATE referrals SET status=?, bonus_awarded=?, updated_at=? WHERE id=?", (req.status, bonus, now, referral_id))
    db.commit()
    db.close()
    return {"message": "Referral updated"}

# ── Admin Routes ──
@app.post("/admin/create-user")
def create_user(req: RegisterRequest):
    try:
        db = get_db()
        # Check if user already exists
        existing = db.execute("SELECT id FROM users WHERE email=?", (req.email,)).fetchone()
        if existing:
            db.close()
            raise HTTPException(status_code=400, detail="Email already registered")

        # Save profile photo if provided
        profile_photo_path = None
        if req.selfie:
            profile_photo_path = f"profile_{uuid.uuid4().hex}.jpg"
            save_base64_image(req.selfie, profile_photo_path)

        # Insert user
        cursor = db.execute(
            "INSERT INTO users (name, email, password, profile_photo) VALUES (?, ?, ?, ?)",
            (req.name, req.email, req.password, profile_photo_path)
        )
        db.commit()
        user_id = cursor.lastrowid
        db.close()
        return {"id": user_id, "message": "User created successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Create user error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/admin/users")
def get_users():
    db = get_db()
    rows = db.execute("SELECT id, name, email, performance_points FROM users ORDER BY id").fetchall()
    db.close()
    return [dict(r) for r in rows]

@app.get("/admin/all-attendance")
def get_all_attendance():
    db = get_db()
    rows = db.execute(
        "SELECT a.*, u.name, u.email FROM attendance a JOIN users u ON a.user_id=u.id ORDER BY timestamp DESC"
    ).fetchall()
    db.close()
    return [dict(r) for r in rows]

@app.get("/admin/stats")
def get_stats():
    db = get_db()
    today = datetime.utcnow().date().isoformat()

    total_users = db.execute("SELECT COUNT(*) as c FROM users").fetchone()["c"]
    total_records = db.execute("SELECT COUNT(*) as c FROM attendance").fetchone()["c"]
    present_today = db.execute(
        "SELECT COUNT(DISTINCT user_id) as c FROM attendance WHERE type='in' AND timestamp LIKE ?",
        (f"{today}%",)
    ).fetchone()["c"]
    late_today = db.execute(
        "SELECT COUNT(*) as c FROM attendance WHERE type='in' AND timestamp LIKE ? AND strftime('%H', timestamp) >= '09'",
        (f"{today}%",)
    ).fetchone()["c"]
    daily = db.execute("""
        SELECT DATE(timestamp) as day, COUNT(*) as count
        FROM attendance WHERE type='in'
        GROUP BY day ORDER BY day DESC LIMIT 7
    """).fetchall()
    per_user = db.execute("""
        SELECT u.name, COUNT(a.id) as count
        FROM users u LEFT JOIN attendance a ON u.id = a.user_id AND a.type='in'
        GROUP BY u.id ORDER BY count DESC
    """).fetchall()
    db.close()
    return {
        "total_users": total_users,
        "total_records": total_records,
        "present_today": present_today,
        "late_today": late_today,
        "daily_checkins": [dict(r) for r in daily],
        "per_user": [dict(r) for r in per_user],
    }

@app.get("/admin/tasks")
def get_all_tasks():
    db = get_db()
    rows = db.execute("SELECT t.*, u.name, u.email FROM tasks t JOIN users u ON t.user_id=u.id ORDER BY t.date DESC, t.id DESC").fetchall()
    db.close()
    return [dict(r) for r in rows]

@app.get("/admin/leaves")
def get_all_leaves():
    db = get_db()
    rows = db.execute("SELECT l.*, u.name, u.email FROM leave_requests l JOIN users u ON l.user_id=u.id ORDER BY l.requested_at DESC").fetchall()
    db.close()
    return [dict(r) for r in rows]

@app.post("/admin/leaves/{leave_id}/approve")
def approve_leave(leave_id: int):
    db = get_db()
    now = datetime.utcnow().isoformat()
    db.execute("UPDATE leave_requests SET status='approved', updated_at=? WHERE id=?", (now, leave_id))
    db.commit()
    db.close()
    return {"message": "Leave approved"}

@app.post("/admin/leaves/{leave_id}/reject")
def reject_leave(leave_id: int):
    db = get_db()
    now = datetime.utcnow().isoformat()
    db.execute("UPDATE leave_requests SET status='rejected', updated_at=? WHERE id=?", (now, leave_id))
    db.commit()
    db.close()
    return {"message": "Leave rejected"}

@app.put("/admin/users/{user_id}/performance")
def update_user_performance(user_id: int, req: dict):
    if 'performance_points' not in req:
        raise HTTPException(status_code=400, detail='performance_points required')
    db = get_db()
    db.execute("UPDATE users SET performance_points=? WHERE id=?", (req['performance_points'], user_id))
    db.commit()
    db.close()
    return {"message": "Performance points updated"}
