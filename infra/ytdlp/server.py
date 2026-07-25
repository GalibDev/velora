import json
import re
import subprocess
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse


YOUTUBE_HOSTS = {
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "youtu.be",
}


def safe_filename(title: str, extension: str) -> str:
    cleaned = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "", title)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()[:160] or "velora-video"
    return f"{cleaned}.{extension}"


class Handler(BaseHTTPRequestHandler):
    def send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path == "/health":
            self.send_json(200, {"ok": True})
            return
        self.send_json(404, {"error": "not_found"})

    def do_POST(self) -> None:
        if self.path != "/resolve":
            self.send_json(404, {"error": "not_found"})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            request = json.loads(self.rfile.read(length))
            source = str(request.get("url", ""))
            parsed = urlparse(source)
            if parsed.scheme not in {"http", "https"} or parsed.hostname not in YOUTUBE_HOSTS:
                self.send_json(400, {"error": "invalid_youtube_url"})
                return

            quality = re.sub(r"\D", "", str(request.get("quality", "720"))) or "720"
            format_selector = (
                f"best[height<={quality}][ext=mp4]/"
                f"best[height<={quality}]/best[ext=mp4]/best"
            )
            result = subprocess.run(
                [
                    "yt-dlp",
                    "--no-playlist",
                    "--no-warnings",
                    "--dump-single-json",
                    "-f",
                    format_selector,
                    source,
                ],
                capture_output=True,
                check=True,
                text=True,
                timeout=90,
            )
            info = json.loads(result.stdout)
            media_url = info.get("url")
            if not media_url:
                self.send_json(502, {"error": "media_url_missing"})
                return

            extension = info.get("ext") or "mp4"
            self.send_json(
                200,
                {
                    "url": media_url,
                    "filename": safe_filename(info.get("title") or "velora-video", extension),
                    "contentType": f"video/{extension}",
                },
            )
        except subprocess.TimeoutExpired:
            self.send_json(504, {"error": "resolver_timeout"})
        except subprocess.CalledProcessError as error:
            self.send_json(502, {"error": error.stderr.strip()[-500:] or "resolver_failed"})
        except Exception:
            self.send_json(400, {"error": "invalid_request"})

    def log_message(self, format: str, *args) -> None:
        return


ThreadingHTTPServer(("0.0.0.0", 9100), Handler).serve_forever()
