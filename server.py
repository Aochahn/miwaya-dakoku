#!/usr/bin/env python3
import base64
import json
import mimetypes
import os
import re
import uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
PUBLIC_DIR = ROOT / "public"
DATA_DIR = ROOT / "data"
DB_PATH = DATA_DIR / "db.json"
PHOTO_DIR = ROOT / "storage" / "photos"
MAX_BODY_BYTES = 8 * 1024 * 1024


def now_iso():
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def today_key():
    return now_iso()[:10]


def read_db():
    with DB_PATH.open("r", encoding="utf-8") as file:
        return json.load(file)


def write_db(db):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    temp_path = DB_PATH.with_suffix(".tmp")
    with temp_path.open("w", encoding="utf-8") as file:
        json.dump(db, file, ensure_ascii=False, indent=2)
        file.write("\n")
    temp_path.replace(DB_PATH)


def json_response(handler, status, payload):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def save_photo(data_url):
    match = re.match(r"^data:image/(jpeg|jpg|png|webp);base64,(.+)$", data_url or "")
    if not match:
        raise ValueError("Invalid image data")

    ext = "jpg" if match.group(1) == "jpeg" else match.group(1)
    image_bytes = base64.b64decode(match.group(2), validate=True)
    if len(image_bytes) > MAX_BODY_BYTES:
        raise ValueError("Image is too large")

    PHOTO_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex}.{ext}"
    path = PHOTO_DIR / filename
    with path.open("wb") as file:
        file.write(image_bytes)
    return f"/photos/{filename}"


def active_users(db):
    users = [user for user in db["users"] if user.get("active", True)]
    return sorted(users, key=lambda user: (user.get("display_order", 9999), user["name"]))


def user_status(db, user_id):
    today = today_key()
    records = [
        record
        for record in db["attendance_records"]
        if record["user_id"] == user_id and record["recorded_at"].startswith(today)
    ]
    if not records:
        return "not_clocked_in"
    latest = sorted(records, key=lambda record: record["recorded_at"])[-1]
    if latest["type"] == "clock_in":
        return "clocked_in"
    return "clocked_out"


def grouped_attendance(db):
    users_by_id = {user["id"]: user for user in db["users"]}
    rows = {}
    for record in sorted(db["attendance_records"], key=lambda item: item["recorded_at"]):
        day = record["recorded_at"][:10]
        key = f"{day}:{record['user_id']}"
        row = rows.setdefault(
            key,
            {
                "date": day,
                "user_id": record["user_id"],
                "staff_name": users_by_id.get(record["user_id"], {}).get("name", "不明"),
                "clock_in": None,
                "clock_out": None,
                "photo_url": None,
            },
        )
        if record["type"] == "clock_in":
            row["clock_in"] = record["recorded_at"]
            row["photo_url"] = record.get("photo_url")
        if record["type"] == "clock_out":
            row["clock_out"] = record["recorded_at"]
    return sorted(rows.values(), key=lambda row: (row["date"], row["clock_in"] or ""), reverse=True)


class AttendanceHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/users":
            db = read_db()
            json_response(
                self,
                200,
                {
                    "users": [
                        {**user, "attendance_status": user_status(db, user["id"])}
                        for user in active_users(db)
                    ]
                },
            )
            return

        if path == "/api/attendance":
            json_response(self, 200, {"rows": grouped_attendance(read_db())})
            return

        if path.startswith("/photos/"):
            self.serve_file(PHOTO_DIR / path.removeprefix("/photos/"))
            return

        static_path = PUBLIC_DIR / "index.html" if path in {"/", "/admin"} else PUBLIC_DIR / path.lstrip("/")
        self.serve_file(static_path)

    def do_POST(self):
        parsed = urlparse(self.path)
        try:
            payload = self.read_json()
            if parsed.path == "/api/clock-in":
                self.handle_clock_in(payload)
                return
            if parsed.path == "/api/clock-out":
                self.handle_clock_out(payload)
                return
            json_response(self, 404, {"error": "Not found"})
        except ValueError as error:
            json_response(self, 400, {"error": str(error)})
        except Exception as error:
            json_response(self, 500, {"error": "Server error", "detail": str(error)})

    def read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length > MAX_BODY_BYTES:
            raise ValueError("Request body is too large")
        body = self.rfile.read(length).decode("utf-8")
        return json.loads(body or "{}")

    def handle_clock_in(self, payload):
        user_id = payload.get("user_id")
        photo_data_url = payload.get("photo_data_url")
        db = read_db()
        if not any(user["id"] == user_id and user.get("active", True) for user in db["users"]):
            raise ValueError("User not found")
        if user_status(db, user_id) == "clocked_in":
            raise ValueError("Already clocked in")

        recorded_at = now_iso()
        photo_url = save_photo(photo_data_url)
        db["attendance_records"].append(
            {
                "id": f"att_{uuid.uuid4().hex}",
                "user_id": user_id,
                "type": "clock_in",
                "recorded_at": recorded_at,
                "photo_url": photo_url,
                "created_at": recorded_at,
                "updated_at": recorded_at,
            }
        )
        write_db(db)
        json_response(self, 201, {"recorded_at": recorded_at, "photo_url": photo_url})

    def handle_clock_out(self, payload):
        user_id = payload.get("user_id")
        db = read_db()
        if not any(user["id"] == user_id and user.get("active", True) for user in db["users"]):
            raise ValueError("User not found")
        if user_status(db, user_id) != "clocked_in":
            raise ValueError("Cannot clock out unless clocked in")

        recorded_at = now_iso()
        db["attendance_records"].append(
            {
                "id": f"att_{uuid.uuid4().hex}",
                "user_id": user_id,
                "type": "clock_out",
                "recorded_at": recorded_at,
                "photo_url": None,
                "created_at": recorded_at,
                "updated_at": recorded_at,
            }
        )
        write_db(db)
        json_response(self, 201, {"recorded_at": recorded_at})

    def serve_file(self, path):
        path = path.resolve()
        allowed_roots = [PUBLIC_DIR.resolve(), PHOTO_DIR.resolve()]
        if not any(str(path).startswith(str(root)) for root in allowed_roots) or not path.exists() or path.is_dir():
            self.send_error(404)
            return

        content_type = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
        content = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def log_message(self, format, *args):
        print(f"{self.address_string()} - {format % args}")


if __name__ == "__main__":
    os.chdir(ROOT)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    PHOTO_DIR.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(("0.0.0.0", 8000), AttendanceHandler)
    print("Attendance prototype: http://localhost:8000")
    server.serve_forever()
