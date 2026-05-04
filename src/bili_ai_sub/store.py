from __future__ import annotations

import json
from dataclasses import asdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Mapping

from .models import Account, SessionSnapshot

COOKIE_WHITELIST = (
    "DedeUserID",
    "DedeUserID__ckMd5",
    "SESSDATA",
    "bili_jct",
    "sid",
)


def utc_now_iso() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def project_root() -> Path:
    return Path(__file__).resolve().parents[2]


class SessionStore:
    def __init__(self, path: str | Path | None = None) -> None:
        self.path = Path(path) if path else project_root() / "data" / "session.json"

    def load(self) -> SessionSnapshot:
        if not self.path.exists():
            return self._default_snapshot()

        try:
            payload = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return self._default_snapshot()

        cookies = normalize_cookies(payload.get("cookies"))
        status = str(payload.get("status") or "").strip().lower()
        if status == "expired":
            normalized_status = "expired"
        elif cookies:
            normalized_status = "active"
        else:
            normalized_status = "missing"

        return SessionSnapshot(
            status=normalized_status,
            cookies=cookies,
            account=normalize_account(payload.get("account")),
            updated_at=str(payload.get("updated_at") or "").strip() or utc_now_iso(),
            last_validated_at=normalize_nullable_string(payload.get("last_validated_at")),
            last_error=normalize_nullable_string(payload.get("last_error")),
        )

    def save_active(
        self,
        cookies: Mapping[str, str],
        account: Mapping[str, str] | Account | None,
    ) -> SessionSnapshot:
        snapshot = SessionSnapshot(
            status="active",
            cookies=normalize_cookies(cookies),
            account=normalize_account(account),
            updated_at=utc_now_iso(),
            last_validated_at=utc_now_iso(),
            last_error=None,
        )
        self._write_snapshot(snapshot)
        return snapshot

    def mark_expired(self, message: str) -> SessionSnapshot:
        snapshot = SessionSnapshot(
            status="expired",
            cookies={},
            account=None,
            updated_at=utc_now_iso(),
            last_validated_at=None,
            last_error=message.strip() or "Bilibili 登录态已失效",
        )
        self._write_snapshot(snapshot)
        return snapshot

    def clear(self) -> None:
        if self.path.exists():
            self.path.unlink()

    def qr_svg_path(self) -> Path:
        return self.path.parent / "latest-login-qr.svg"

    def _write_snapshot(self, snapshot: SessionSnapshot) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(
            json.dumps(asdict(snapshot), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def _default_snapshot(self) -> SessionSnapshot:
        return SessionSnapshot(
            status="missing",
            cookies={},
            account=None,
            updated_at=utc_now_iso(),
            last_validated_at=None,
            last_error=None,
        )


def normalize_cookies(payload: object) -> dict[str, str]:
    raw = payload if isinstance(payload, Mapping) else {}
    normalized: dict[str, str] = {}
    for name in COOKIE_WHITELIST:
        value = str(raw.get(name, "")).strip()
        if value:
            normalized[name] = value
    return normalized


def normalize_account(payload: object) -> Account | None:
    raw = payload if isinstance(payload, Mapping) else {}
    mid = str(raw.get("mid", "")).strip()
    uname = str(raw.get("uname", "")).strip()
    if not mid or not uname:
        return None
    return {
        "mid": mid,
        "uname": uname,
    }


def normalize_nullable_string(value: object) -> str | None:
    candidate = str(value or "").strip()
    return candidate or None
