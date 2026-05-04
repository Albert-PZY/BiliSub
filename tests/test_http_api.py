from __future__ import annotations

from contextlib import contextmanager
from threading import Thread

import httpx

from bili_ai_sub.http_api import create_http_api_server


class StubApiService:
    def __init__(self) -> None:
        self.calls: list[tuple[str, object]] = []

    def get_status(self) -> dict:
        self.calls.append(("status", None))
        return {
            "status": "active",
            "account": {"mid": "12345", "uname": "tester"},
            "cookies": ["SESSDATA", "DedeUserID"],
        }

    def start_login(self) -> dict:
        self.calls.append(("login.start", None))
        return {
            "qrcode_key": "qr-key-1",
            "qrcode_url": "https://passport.bilibili.com/scan",
            "qr_ascii": "##\n##",
            "qr_svg_path": "F:/BiliAISub/data/latest-login-qr.svg",
            "expires_at": "2026-05-01T00:00:00Z",
            "poll_interval_ms": 1500,
        }

    def poll_login(self, qrcode_key: str) -> dict:
        self.calls.append(("login.poll", qrcode_key))
        return {
            "status": "success",
            "account": {"mid": "12345", "uname": "tester"},
            "message": "登录成功",
        }

    def logout(self) -> dict:
        self.calls.append(("logout", None))
        return {
            "status": "missing",
            "message": "已清除本地 B 站登录态",
        }

    def get_subtitles(self, *, source: str, language: str | None, include_raw: bool) -> dict:
        self.calls.append(("subtitles", {"source": source, "language": language, "include_raw": include_raw}))
        payload = {
            "source": "bilibili-auth",
            "language": "ai-zh",
            "subtitle_url": "https://aisubtitle.example/subtitle.json",
            "text": "第一句\n第二句",
            "srt": "1\n00:00:00,000 --> 00:00:02,500\n第一句",
            "segments": [
                {"start": 0.0, "end": 2.5, "text": "第一句"},
                {"start": 2.5, "end": 5.0, "text": "第二句"},
            ],
        }
        if include_raw:
            payload["raw_subtitle_json"] = '{"body":[]}'
        return payload


@contextmanager
def run_server(service: StubApiService):
    server = create_http_api_server(service, host="127.0.0.1", port=0)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    host, port = server.server_address
    base_url = f"http://{host}:{port}"
    try:
        yield base_url
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=3)


def test_http_api_exposes_core_routes() -> None:
    service = StubApiService()

    with run_server(service) as base_url:
        with httpx.Client(base_url=base_url, timeout=5.0) as client:
            health = client.get("/health")
            assert health.status_code == 200
            assert health.json() == {
                "ok": True,
                "service": "bili-ai-sub",
            }

            status = client.get("/status")
            assert status.status_code == 200
            assert status.json()["status"] == "active"

            login_start = client.post("/login/start")
            assert login_start.status_code == 200
            assert login_start.json()["qrcode_key"] == "qr-key-1"

            login_poll = client.get("/login/poll", params={"qrcode_key": "qr-key-1"})
            assert login_poll.status_code == 200
            assert login_poll.json()["status"] == "success"

            subtitles = client.get(
                "/subtitles",
                params={
                    "source": "BV1darmBcE4A",
                    "language": "zh-Hans",
                    "include_raw": "1",
                },
            )
            assert subtitles.status_code == 200
            subtitle_payload = subtitles.json()
            assert subtitle_payload["language"] == "ai-zh"
            assert subtitle_payload["segments"][0]["text"] == "第一句"
            assert subtitle_payload["raw_subtitle_json"] == '{"body":[]}'

            logout = client.post("/logout")
            assert logout.status_code == 200
            assert logout.json()["status"] == "missing"

    assert ("status", None) in service.calls
    assert ("login.start", None) in service.calls
    assert ("login.poll", "qr-key-1") in service.calls
    assert ("logout", None) in service.calls


def test_http_api_rejects_missing_required_parameters() -> None:
    service = StubApiService()

    with run_server(service) as base_url:
        with httpx.Client(base_url=base_url, timeout=5.0) as client:
            missing_source = client.get("/subtitles")
            assert missing_source.status_code == 400
            assert missing_source.json()["error"] == "source 不能为空"

            missing_qrcode_key = client.get("/login/poll")
            assert missing_qrcode_key.status_code == 400
            assert missing_qrcode_key.json()["error"] == "qrcode_key 不能为空"
