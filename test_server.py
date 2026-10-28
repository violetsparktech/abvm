import json
import re
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import server


class EnquiryEndpointTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp_dir = tempfile.TemporaryDirectory()
        server.DATABASE = Path(cls.temp_dir.name) / "test.sqlite3"
        server.initialize_database()
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.SchoolSiteHandler)
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()
        cls.base_url = f"http://127.0.0.1:{cls.httpd.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.thread.join()
        cls.httpd.server_close()
        cls.temp_dir.cleanup()

    def post_enquiry(self, payload):
        request = Request(
            self.base_url + "/api/enquiries",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            response = urlopen(request)
        except HTTPError as error:
            response = error
        return response.status, json.loads(response.read())

    @staticmethod
    def valid_enquiry():
        return {
            "guardian_name": "Test Guardian",
            "phone": "+91 98765 43210",
            "class_interest": "Class 5",
            "email": "guardian@example.test",
            "message": "Please share admission details.",
            "consent": True,
            "category": "admissions",
        }

    def test_valid_enquiry_is_persisted_and_returns_reference(self):
        status, response = self.post_enquiry(self.valid_enquiry())
        self.assertEqual(status, 201)
        self.assertRegex(response["reference"], r"^ABV-[A-F0-9]{8}$")
        with server.connect_database() as connection:
            row = connection.execute(
                "SELECT guardian_name, class_interest FROM enquiries WHERE reference = ?",
                (response["reference"],),
            ).fetchone()
        self.assertEqual(row["guardian_name"], "Test Guardian")
        self.assertEqual(row["class_interest"], "Class 5")

    def test_invalid_phone_and_missing_consent_are_rejected(self):
        invalid_phone = self.valid_enquiry()
        invalid_phone["phone"] = "send-money-now"
        self.assertEqual(self.post_enquiry(invalid_phone)[0], 400)

        no_consent = self.valid_enquiry()
        no_consent["consent"] = False
        self.assertEqual(self.post_enquiry(no_consent)[0], 400)

    def test_unknown_class_is_rejected(self):
        payload = self.valid_enquiry()
        payload["class_interest"] = "Class 9"
        status, response = self.post_enquiry(payload)
        self.assertEqual(status, 400)
        self.assertIn("valid class", response["error"])

    def test_enquiry_records_are_not_publicly_listed(self):
        status, _ = self.post_enquiry(self.valid_enquiry())
        self.assertEqual(status, 201)
        with self.assertRaises(HTTPError) as error:
            urlopen(self.base_url + "/api/enquiries")
        self.assertEqual(error.exception.code, 404)

    def test_homepage_and_health_endpoint_are_served(self):
        with urlopen(self.base_url + "/") as response:
            self.assertEqual(response.status, 200)
            self.assertIn("text/html", response.headers["Content-Type"])
            self.assertIn(b"Anand Bal Vidya Mandir", response.read())
        with urlopen(self.base_url + "/fee-receipt.html") as response:
            self.assertEqual(response.status, 200)
            self.assertIn(b"Generate payment receipt", response.read())
        with urlopen(self.base_url + "/receipt.js") as response:
            self.assertEqual(response.status, 200)
            self.assertIn("javascript", response.headers["Content-Type"])
        with urlopen(self.base_url + "/api/health") as response:
            self.assertEqual(json.loads(response.read())["status"], "ok")

    def test_static_site_urls_work_from_a_github_pages_project_path(self):
        project_root = Path(__file__).parent
        for filename in ("index.html", "fee-receipt.html"):
            contents = (project_root / filename).read_text(encoding="utf-8")
            for url in re.findall(r'\b(?:href|src)=["\']([^"\']+)["\']', contents):
                if url.startswith(("#", "https:", "mailto:", "tel:")):
                    continue
                self.assertFalse(url.startswith("/"), f"{filename} contains root-relative URL: {url}")
                resource = url.split("?", 1)[0].split("#", 1)[0]
                if resource:
                    self.assertTrue((project_root / resource.removeprefix("./")).is_file(), f"Missing resource: {url}")

        styles = (project_root / "styles.css").read_text(encoding="utf-8")
        for url in re.findall(r"url\(['\"]?([^'\")]+)", styles):
            self.assertFalse(url.startswith("/"), f"styles.css contains root-relative URL: {url}")
            self.assertTrue((project_root / url.removeprefix("./")).is_file(), f"Missing stylesheet resource: {url}")

        script = (project_root / "script.js").read_text(encoding="utf-8")
        self.assertNotRegex(script, r"fetch\(\s*['\"]/")

    def test_database_and_source_files_are_not_public(self):
        for path in ("/abvm.sqlite3", "/server.py", "/test_server.py", "/README.md"):
            with self.subTest(path=path):
                with self.assertRaises(HTTPError) as error:
                    urlopen(self.base_url + path)
                self.assertEqual(error.exception.code, 404)


if __name__ == "__main__":
    unittest.main()
