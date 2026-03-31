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
OFFICE_LAT = 12.961407
OFFICE_LON = 77.502102
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
        "SELECT id, name, email, profile_photo FROM users WHERE email=? AND password=?",
        (req.email, req.password)
    ).fetchone()
    db.close()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password. Only registered users can login.")
    return {"id": user["id"], "name": user["name"], "email": user["email"], "profile_photo": user["profile_photo"]}

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

# ── Admin Routes ──
@app.get("/admin/all-attendance")
def all_attendance():
    db = get_db()
    rows = db.execute("""
        SELECT a.*, u.name, u.email
        FROM attendance a
        JOIN users u ON a.user_id = u.id
        ORDER BY a.timestamp DESC
    """).fetchall()
    db.close()
    return [dict(r) for r in rows]

@app.get("/admin/users")
def get_users():
    db = get_db()
    rows = db.execute("SELECT id, name, email FROM users ORDER BY id").fetchall()
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
