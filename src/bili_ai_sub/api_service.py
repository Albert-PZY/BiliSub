from __future__ import annotations

from dataclasses import asdict
from typing import Callable

from .bilibili import BilibiliClient, render_qr_ascii, render_srt, save_qr_svg
from .store import SessionStore


class ApiService:
    def __init__(
        self,
        store: SessionStore,
        client_factory: Callable[[], BilibiliClient] | None = None,
    ) -> None:
        self.store = store
        self.client_factory = client_factory or (lambda: BilibiliClient(store=self.store))

    def get_status(self) -> dict:
        with self.client_factory() as client:
            snapshot = client.get_status(refresh=True)
        return {
            "status": snapshot.status,
            "account": snapshot.account,
            "last_validated_at": snapshot.last_validated_at,
            "last_error": snapshot.last_error,
            "updated_at": snapshot.updated_at,
            "cookies": sorted(snapshot.cookies.keys()),
        }

    def start_login(self) -> dict:
        with self.client_factory() as client:
            qr_session = client.start_qr_login()
        qr_svg_path = self.store.qr_svg_path()
        qr_svg_path.parent.mkdir(parents=True, exist_ok=True)
        save_qr_svg(qr_session.qrcode_url, str(qr_svg_path))
        return {
            "qrcode_key": qr_session.qrcode_key,
            "qrcode_url": qr_session.qrcode_url,
            "qr_ascii": render_qr_ascii(qr_session.qrcode_url),
            "qr_svg_path": str(qr_svg_path),
            "expires_at": qr_session.expires_at,
            "poll_interval_ms": qr_session.poll_interval_ms,
        }

    def poll_login(self, qrcode_key: str) -> dict:
        with self.client_factory() as client:
            result = client.poll_qr_login(qrcode_key)
        return {
            "status": result.status,
            "account": result.account,
            "message": result.message,
            "expires_at": result.expires_at,
            "last_error": result.last_error,
        }

    def logout(self) -> dict:
        with self.client_factory() as client:
            client.logout()
        return {
            "status": "missing",
            "message": "已清除本地 B 站登录态",
        }

    def get_subtitles(self, *, source: str, language: str | None, include_raw: bool) -> dict:
        with self.client_factory() as client:
            resolved = client.fetch_ai_subtitle(source, preferred_language=language)
        payload = {
            "source": resolved.source,
            "language": resolved.language,
            "subtitle_url": resolved.subtitle_url,
            "text": resolved.text,
            "srt": render_srt(resolved.segments),
            "segments": [asdict(segment) for segment in resolved.segments],
            "track": asdict(resolved.track),
        }
        if include_raw:
            payload["raw_subtitle_json"] = resolved.raw_subtitle_json
        return payload
