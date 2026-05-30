from __future__ import annotations

from contextlib import contextmanager
from dataclasses import dataclass
from threading import Thread

import httpx

from bili_ai_sub.models import QrLoginSession, QrPollResult, ResolvedSubtitle, SessionSnapshot, SubtitleSegment
from bili_ai_sub.store import SessionStore
from bili_ai_sub.web import create_web_server


@dataclass
class StubClient:
    store: SessionStore

    def __enter__(self) -> "StubClient":
        return self

    def __exit__(self, *_args: object) -> None:
        return None

    def get_status(self, refresh: bool = False) -> SessionSnapshot:
        return SessionSnapshot(
            status="active",
            cookies={"SESSDATA": "sess-token"},
            account={"mid": "12345", "uname": "tester"},
            updated_at="2026-05-30T00:00:00Z",
            last_validated_at="2026-05-30T00:00:00Z",
        )

    def start_qr_login(self) -> QrLoginSession:
        return QrLoginSession(
            qrcode_key="qr-key-1",
            qrcode_url="https://passport.bilibili.com/scan",
            poll_interval_ms=1500,
        )

    def poll_qr_login(self, qrcode_key: str) -> QrPollResult:
        assert qrcode_key == "qr-key-1"
        return QrPollResult(
            status="success",
            account={"mid": "12345", "uname": "tester"},
            message="登录成功",
        )

    def fetch_ai_subtitles(self, source_input: str, preferred_language: str | None = None) -> list[ResolvedSubtitle]:
        assert preferred_language is None
        segments = [
            SubtitleSegment(start=0, end=2.5, text=f"{source_input} 第一段"),
            SubtitleSegment(start=2.5, end=5, text="第二段"),
        ]
        return [
            ResolvedSubtitle(
                language="zh-hans",
                label="简体中文",
                raw_subtitle_json='{"body":[]}',
                segments=segments,
                subtitle_url="https://i0.hdslb.com/bfs/subtitle/zh.json",
                text="\n".join(segment.text for segment in segments),
            )
        ]


@contextmanager
def run_server(store: SessionStore):
    server = create_web_server(
        store=store,
        host="127.0.0.1",
        port=0,
        client_factory=lambda: StubClient(store),
    )
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    host, port = server.server_address
    try:
        yield f"http://{host}:{port}"
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=3)


def test_local_web_serves_page_and_core_actions(tmp_path) -> None:
    store = SessionStore(tmp_path / "session.json")

    with run_server(store) as base_url:
        with httpx.Client(base_url=base_url, timeout=5.0) as client:
            page = client.get("/")
            assert page.status_code == 200
            assert "B站AI字幕工具" in page.text

            status = client.post("/local/status")
            assert status.status_code == 200
            assert status.json()["account"]["uname"] == "tester"

            login_start = client.post("/local/login/start")
            assert login_start.status_code == 200
            assert login_start.json()["qr_svg_url"] == "/local/login/qr.svg"

            qr_svg = client.get("/local/login/qr.svg")
            assert qr_svg.status_code == 200
            assert "image/svg+xml" in qr_svg.headers["content-type"]

            login_poll = client.post("/local/login/poll", json={"qrcode_key": "qr-key-1"})
            assert login_poll.status_code == 200
            assert login_poll.json()["status"] == "success"

            subtitles = client.post(
                "/local/subtitles",
                json={"sources": ["BV1darmBcE4A", "BV1abcdefghi"], "language": "all"},
            )
            assert subtitles.status_code == 200
            payload = subtitles.json()
            assert len(payload["items"]) == 2
            assert payload["items"][0]["ok"] is True
            assert payload["items"][0]["subtitles"][0]["label"] == "简体中文"
            assert "00:00:00,000 --> 00:00:02,500" in payload["items"][0]["subtitles"][0]["srt"]
