from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, TypedDict


class Account(TypedDict):
    mid: str
    uname: str


AuthStatus = Literal["missing", "active", "expired"]
QrPollStatus = Literal["pending", "scanned", "confirmed", "success", "expired", "failed"]


@dataclass(slots=True)
class SessionSnapshot:
    status: AuthStatus
    cookies: dict[str, str]
    account: Account | None
    updated_at: str
    last_validated_at: str | None = None
    last_error: str | None = None


@dataclass(slots=True)
class QrLoginSession:
    qrcode_key: str
    qrcode_url: str
    poll_interval_ms: int


@dataclass(slots=True)
class QrPollResult:
    status: QrPollStatus
    account: Account | None
    message: str


@dataclass(slots=True)
class SubtitleTrack:
    language: str
    label: str
    subtitle_url: str


@dataclass(slots=True)
class SubtitleSegment:
    start: float
    end: float
    text: str


@dataclass(slots=True)
class ResolvedSubtitle:
    language: str
    label: str
    raw_subtitle_json: str
    segments: list[SubtitleSegment]
    subtitle_url: str
    text: str
