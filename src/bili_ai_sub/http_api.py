from __future__ import annotations

import json
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import parse_qs, urlparse

from .api_service import ApiService
from .bilibili import BilibiliError


class BiliAiSubHttpServer(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True

    def __init__(self, server_address: tuple[str, int], service: Any) -> None:
        self.service = service
        super().__init__(server_address, BiliAiSubRequestHandler)


class BiliAiSubRequestHandler(BaseHTTPRequestHandler):
    server: BiliAiSubHttpServer

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(HTTPStatus.NO_CONTENT)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        self._dispatch("GET")

    def do_POST(self) -> None:  # noqa: N802
        self._dispatch("POST")

    def log_message(self, _format: str, *_args: object) -> None:
        return

    def _dispatch(self, method: str) -> None:
        parsed = urlparse(self.path)
        path = normalize_route_path(parsed.path)
        query = parse_qs(parsed.query)

        try:
            if method == "GET" and path == "/health":
                return self._write_json(HTTPStatus.OK, {"ok": True, "service": "bili-ai-sub"})
            if method == "GET" and path == "/status":
                return self._write_json(HTTPStatus.OK, self.server.service.get_status())
            if method == "POST" and path == "/login/start":
                return self._write_json(HTTPStatus.OK, self.server.service.start_login())
            if method == "GET" and path == "/login/poll":
                qrcode_key = first_query_value(query, "qrcode_key")
                if not qrcode_key:
                    return self._write_json(HTTPStatus.BAD_REQUEST, {"error": "qrcode_key 不能为空"})
                return self._write_json(HTTPStatus.OK, self.server.service.poll_login(qrcode_key))
            if method == "POST" and path == "/logout":
                return self._write_json(HTTPStatus.OK, self.server.service.logout())
            if method == "GET" and path == "/subtitles":
                source = first_query_value(query, "source")
                if not source:
                    return self._write_json(HTTPStatus.BAD_REQUEST, {"error": "source 不能为空"})
                language = first_query_value(query, "language") or None
                include_raw = parse_bool(first_query_value(query, "include_raw"))
                return self._write_json(
                    HTTPStatus.OK,
                    self.server.service.get_subtitles(
                        source=source,
                        language=language,
                        include_raw=include_raw,
                    ),
                )
            return self._write_json(HTTPStatus.NOT_FOUND, {"error": f"未找到接口: {path}"})
        except BilibiliError as exc:
            return self._write_json(HTTPStatus.CONFLICT, {"error": str(exc)})
        except Exception as exc:  # pragma: no cover
            return self._write_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": str(exc)})

    def _write_json(self, status_code: HTTPStatus, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self._send_cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_cors_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")


def create_http_api_server(
    service: ApiService | Any,
    *,
    host: str = "127.0.0.1",
    port: int = 8933,
) -> BiliAiSubHttpServer:
    return BiliAiSubHttpServer((host, port), service)


def normalize_route_path(path: str) -> str:
    normalized = str(path or "").rstrip("/") or "/"
    if normalized.startswith("/api/"):
        return normalized[4:]
    if normalized == "/api":
        return "/"
    return normalized


def first_query_value(query: dict[str, list[str]], key: str) -> str:
    values = query.get(key) or []
    return str(values[0]).strip() if values else ""


def parse_bool(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes", "on"}
