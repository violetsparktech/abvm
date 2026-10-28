import json
import os
import re
import secrets
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parent
DATABASE = Path(os.environ.get("ABVM_DATABASE", ROOT / "abvm.sqlite3"))
MAX_BODY = 16_384
CLASSES = {"Nursery", "LKG", "UKG"} | {f"Class {number}" for number in range(1, 9)}
MIME_TYPES = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".jpeg": "image/jpeg",
    ".js": "text/javascript; charset=utf-8",
}
PUBLIC_FILES = {
    "fee-receipt.html",
    "index.html",
    "receipt.css",
    "receipt.js",
    "styles.css",
    "script.js",
    "abvm-logo.jpeg",
    "group photo.jpeg",
    "r2-img.jpeg",
    "robotics-3.jpeg",
    "robotics-img.jpeg",
    "school-img.jpeg",
}


@contextmanager
def connect_database():
    connection = sqlite3.connect(DATABASE, timeout=10)
    connection.row_factory = sqlite3.Row
    try:
        with connection:
            yield connection
    finally:
        connection.close()


def initialize_database():
    DATABASE.parent.mkdir(parents=True, exist_ok=True)
    with connect_database() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS enquiries (
                id INTEGER PRIMARY KEY,
                reference TEXT NOT NULL UNIQUE,
                guardian_name TEXT NOT NULL,
                phone TEXT NOT NULL,
                class_interest TEXT NOT NULL,
                email TEXT,
                message TEXT NOT NULL DEFAULT '',
                category TEXT NOT NULL DEFAULT 'admissions',
                created_at TEXT NOT NULL
            )
            """
        )


def clean_text(value, field, limit, required=False):
    if not isinstance(value, str):
        if required:
            raise ValueError(f"{field} is required.")
        return ""
    cleaned = value.strip()
    if required and not cleaned:
        raise ValueError(f"{field} is required.")
    if len(cleaned) > limit:
        raise ValueError(f"{field} must be {limit} characters or fewer.")
    return cleaned


class SchoolSiteHandler(BaseHTTPRequestHandler):
    server_version = "ABVMWebsite/1.0"

    def log_message(self, format_string, *args):
        # Avoid logging submitted form data or query strings.
        super().log_message("%s %s", self.command, urlsplit(self.path).path)

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
        )
        super().end_headers()

    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = unquote(urlsplit(self.path).path)
        if path == "/api/health":
            self.send_json(200, {"status": "ok"})
            return

        if path == "/":
            path = "/index.html"
        relative = path.lstrip("/")
        requested = (ROOT / relative).resolve()
        if requested.parent != ROOT or requested.name not in PUBLIC_FILES or not requested.is_file():
            self.send_error(404, "Page not found")
            return

        content_type = MIME_TYPES.get(requested.suffix.lower(), "application/octet-stream")
        body = requested.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache" if requested.suffix == ".html" else "public, max-age=3600")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if urlsplit(self.path).path != "/api/enquiries":
            self.send_json(404, {"error": "Endpoint not found."})
            return

        origin = self.headers.get("Origin")
        if origin:
            expected_origin = f"http://{self.headers.get('Host', '')}"
            if origin.rstrip("/") != expected_origin:
                self.send_json(403, {"error": "Request origin was not accepted."})
                return

        if self.headers.get_content_type() != "application/json":
            self.send_json(415, {"error": "Submit the enquiry as JSON."})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length < 1 or length > MAX_BODY:
            self.send_json(413, {"error": "The enquiry is empty or too large."})
            return

        try:
            payload = json.loads(self.rfile.read(length))
            if not isinstance(payload, dict):
                raise ValueError("Invalid enquiry details.")
            guardian = clean_text(payload.get("guardian_name"), "Name", 100, True)
            phone = clean_text(payload.get("phone"), "Phone number", 20, True)
            class_interest = clean_text(payload.get("class_interest"), "Class of interest", 30, True)
            email = clean_text(payload.get("email"), "Email", 254)
            message = clean_text(payload.get("message"), "Message", 1000)
            category = clean_text(payload.get("category"), "Enquiry type", 30) or "admissions"
            if not re.fullmatch(r"[0-9+().\-\s]{7,20}", phone):
                raise ValueError("Enter a valid phone number.")
            if class_interest not in CLASSES:
                raise ValueError("Select a valid class of interest.")
            if email and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
                raise ValueError("Enter a valid email address.")
            if category not in {"admissions", "general", "robotics", "fees"}:
                raise ValueError("Select a valid enquiry type.")
            if payload.get("consent") is not True:
                raise ValueError("Please agree to be contacted.")
        except (json.JSONDecodeError, UnicodeDecodeError):
            self.send_json(400, {"error": "The enquiry could not be read. Please try again."})
            return
        except ValueError as error:
            self.send_json(400, {"error": str(error)})
            return

        reference = "ABV-" + secrets.token_hex(4).upper()
        created_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
        try:
            with connect_database() as connection:
                connection.execute(
                    """
                    INSERT INTO enquiries
                        (reference, guardian_name, phone, class_interest, email, message, category, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (reference, guardian, phone, class_interest, email, message, category, created_at),
                )
        except sqlite3.Error:
            self.send_json(500, {"error": "The enquiry could not be saved. Please try again later."})
            return

        self.send_json(201, {"reference": reference, "message": "Enquiry received."})


if __name__ == "__main__":
    initialize_database()
    host = os.environ.get("ABVM_HOST", "127.0.0.1")
    port = int(os.environ.get("ABVM_PORT", "8000"))
    print(f"ABVM website running at http://{host}:{port}")
    try:
        ThreadingHTTPServer((host, port), SchoolSiteHandler).serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
