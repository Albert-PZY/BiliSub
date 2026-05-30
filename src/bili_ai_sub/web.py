from __future__ import annotations

import json
import mimetypes
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Callable
from urllib.parse import unquote, urlparse

from .bilibili import BilibiliClient, BilibiliError, render_srt, save_qr_svg
from .store import SessionStore


STATIC_ROOT = Path(__file__).resolve().parent / "web_static"


class LocalWebServer(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True

    def __init__(
        self,
        server_address: tuple[str, int],
        store: SessionStore,
        client_factory: Callable[[], Any] | None = None,
    ) -> None:
        self.store = store
        self.client_factory = client_factory or (lambda: BilibiliClient(store=self.store))
        super().__init__(server_address, LocalWebRequestHandler)


class LocalWebRequestHandler(BaseHTTPRequestHandler):
    server: LocalWebServer

    def do_GET(self) -> None:  # noqa: N802
        request_path = urlparse(self.path).path
        if request_path == "/":
            return self._write_file(STATIC_ROOT / "index.html")
        if request_path == "/favicon.ico" and not (STATIC_ROOT / "favicon.ico").exists():
            self.send_response(HTTPStatus.NO_CONTENT)
            self.end_headers()
            return None
        if request_path == "/local/login/qr.svg":
            return self._write_qr_svg()
        if request_path.startswith("/local/"):
            return self._write_json(HTTPStatus.NOT_FOUND, {"error": "操作不存在"})
        return self._write_file(STATIC_ROOT / unquote(request_path).lstrip("/"))

    def do_POST(self) -> None:  # noqa: N802
        path = self.path.split("?", 1)[0]
        try:
            if path == "/local/status":
                return self._write_json(HTTPStatus.OK, self._status())
            if path == "/local/login/start":
                return self._write_json(HTTPStatus.OK, self._start_login())
            if path == "/local/login/poll":
                payload = self._read_json()
                qrcode_key = str(payload.get("qrcode_key", "")).strip()
                if not qrcode_key:
                    return self._write_json(HTTPStatus.BAD_REQUEST, {"error": "qrcode_key 不能为空"})
                return self._write_json(HTTPStatus.OK, self._poll_login(qrcode_key))
            if path == "/local/logout":
                self.server.store.clear()
                return self._write_json(HTTPStatus.OK, {"status": "missing"})
            if path == "/local/subtitles":
                payload = self._read_json()
                return self._write_json(HTTPStatus.OK, self._fetch_many(payload))
            return self._write_json(HTTPStatus.NOT_FOUND, {"error": "操作不存在"})
        except BilibiliError as exc:
            return self._write_json(HTTPStatus.CONFLICT, {"error": str(exc)})
        except Exception as exc:  # pragma: no cover
            return self._write_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": str(exc)})

    def log_message(self, _format: str, *_args: object) -> None:
        return

    def _status(self) -> dict[str, Any]:
        with self.server.client_factory() as client:
            snapshot = client.get_status(refresh=True)
        return {
            "status": snapshot.status,
            "account": snapshot.account,
            "last_error": snapshot.last_error,
        }

    def _start_login(self) -> dict[str, Any]:
        with self.server.client_factory() as client:
            session = client.start_qr_login()
        qr_svg_path = self.server.store.qr_svg_path()
        qr_svg_path.parent.mkdir(parents=True, exist_ok=True)
        save_qr_svg(session.qrcode_url, str(qr_svg_path))
        return {
            "qrcode_key": session.qrcode_key,
            "qr_svg_url": "/local/login/qr.svg",
            "poll_interval_ms": session.poll_interval_ms,
        }

    def _poll_login(self, qrcode_key: str) -> dict[str, Any]:
        with self.server.client_factory() as client:
            result = client.poll_qr_login(qrcode_key)
        return {
            "status": result.status,
            "account": result.account,
            "message": result.message,
        }

    def _fetch_many(self, payload: dict[str, Any]) -> dict[str, Any]:
        sources = [str(item).strip() for item in payload.get("sources", []) if str(item).strip()]
        language = str(payload.get("language", "all")).strip()
        preferred_language = None if language.lower() in {"", "all", "__all__"} else language
        if not sources:
            return {"items": []}

        items: list[dict[str, Any]] = []
        with self.server.client_factory() as client:
            for source in sources:
                try:
                    subtitles = client.fetch_ai_subtitles(source, preferred_language=preferred_language)
                    items.append(
                        {
                            "ok": True,
                            "source": source,
                            "subtitles": [
                                {
                                    "language": resolved.language,
                                    "label": resolved.label,
                                    "text": resolved.text,
                                    "srt": render_srt(resolved.segments),
                                    "raw_json": resolved.raw_subtitle_json,
                                }
                                for resolved in subtitles
                            ],
                        }
                    )
                except BilibiliError as exc:
                    items.append({"ok": False, "source": source, "error": str(exc)})
        return {"items": items}

    def _read_json(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0") or 0)
        if length <= 0:
            return {}
        raw = self.rfile.read(length).decode("utf-8")
        payload = json.loads(raw)
        return payload if isinstance(payload, dict) else {}

    def _write_file(self, path: Path) -> None:
        resolved = path.resolve()
        static_root = STATIC_ROOT.resolve()
        if static_root not in resolved.parents and resolved != static_root:
            return self._write_json(HTTPStatus.NOT_FOUND, {"error": "页面不存在"})
        if not resolved.is_file():
            return self._write_json(HTTPStatus.NOT_FOUND, {"error": "页面不存在"})
        body = resolved.read_bytes()
        content_type = mimetypes.guess_type(resolved.name)[0] or "application/octet-stream"
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", f"{content_type}; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _write_qr_svg(self) -> None:
        path = self.server.store.qr_svg_path()
        if not path.is_file():
            return self._write_json(HTTPStatus.NOT_FOUND, {"error": "二维码不存在"})
        body = path.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "image/svg+xml; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _write_json(self, status_code: HTTPStatus, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def create_web_server(
    *,
    store: SessionStore,
    host: str = "127.0.0.1",
    port: int = 8933,
    client_factory: Callable[[], Any] | None = None,
) -> LocalWebServer:
    return LocalWebServer((host, port), store, client_factory)
