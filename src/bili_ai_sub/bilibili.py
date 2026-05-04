from __future__ import annotations

import io
import json
import re
from datetime import UTC, datetime, timedelta
from typing import Mapping

import httpx
import qrcode
from qrcode.image.svg import SvgPathImage

from .models import (
    Account,
    QrLoginSession,
    QrPollResult,
    ResolvedSubtitle,
    SessionSnapshot,
    SubtitleSegment,
    SubtitleTrack,
)
from .store import COOKIE_WHITELIST, SessionStore

_BV_PATTERN = re.compile(r"\b(BV[0-9A-Za-z]{10})\b")
_VIDEO_PATH_PATTERN = re.compile(r"/video/(BV[0-9A-Za-z]{10})")
_AUTH_EXPIRED_PATTERN = re.compile(r"未登录|登录态|权限|SESSDATA")
_DEFAULT_HEADERS = {
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Origin": "https://www.bilibili.com",
    "Referer": "https://www.bilibili.com/",
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/135.0.0.0 Safari/537.36"
    ),
}


class BilibiliError(RuntimeError):
    pass


class BilibiliClient:
    def __init__(self, store: SessionStore | None = None, http_client: httpx.Client | None = None) -> None:
        self.store = store or SessionStore()
        self._owns_client = http_client is None
        self.http = http_client or httpx.Client(timeout=20.0, follow_redirects=True)

    def close(self) -> None:
        if self._owns_client:
            self.http.close()

    def __enter__(self) -> "BilibiliClient":
        return self

    def __exit__(self, *_args: object) -> None:
        self.close()

    def get_status(self, refresh: bool = False) -> SessionSnapshot:
        snapshot = self.store.load()
        if not refresh or snapshot.status != "active" or not snapshot.cookies:
            return snapshot

        try:
            account = self._fetch_account_summary(snapshot.cookies)
        except BilibiliError as exc:
            return self.store.mark_expired(str(exc))

        return self.store.save_active(snapshot.cookies, account)

    def start_qr_login(self) -> QrLoginSession:
        payload = self._request_json(
            "https://passport.bilibili.com/x/passport-login/web/qrcode/generate?source=main-fe-header"
        )
        qrcode_key = str(payload.get("data", {}).get("qrcode_key", "")).strip()
        qrcode_url = str(payload.get("data", {}).get("url", "")).strip()
        if not qrcode_key or not qrcode_url:
            raise BilibiliError("生成 B 站扫码登录会话失败")

        expires_at = (datetime.now(UTC) + timedelta(minutes=3)).isoformat().replace("+00:00", "Z")
        return QrLoginSession(
            qrcode_key=qrcode_key,
            qrcode_url=qrcode_url,
            expires_at=expires_at,
            poll_interval_ms=1500,
        )

    def poll_qr_login(self, qrcode_key: str) -> QrPollResult:
        if not qrcode_key.strip():
            raise BilibiliError("qrcode_key 不能为空")

        response = self.http.get(
            "https://passport.bilibili.com/x/passport-login/web/qrcode/poll",
            params={
                "qrcode_key": qrcode_key.strip(),
                "source": "main-fe-header",
            },
            headers=_DEFAULT_HEADERS,
        )
        payload = self._parse_json_response(response)
        raw_poll_code = payload.get("data", {}).get("code", payload.get("code", -1))
        poll_code = int(raw_poll_code if raw_poll_code is not None else -1)
        message = str(payload.get("data", {}).get("message", payload.get("message", ""))).strip() or "unknown"

        if poll_code == 0:
            cookies = extract_response_cookies(response)
            if not cookies:
                raise BilibiliError("扫码成功，但没有拿到有效登录 Cookie")
            account = self._fetch_account_summary(cookies)
            self.store.save_active(cookies, account)
            return QrPollResult(
                status="success",
                account=account,
                message="登录成功" if message == "0" else message,
                expires_at=None,
                last_error=None,
            )

        if poll_code == 86038:
            expired = self.store.mark_expired(message or "二维码已失效")
            return QrPollResult(
                status="expired",
                account=None,
                message=expired.last_error or "二维码已失效",
                expires_at=expired.updated_at,
                last_error=expired.last_error,
            )

        return QrPollResult(
            status=map_qr_poll_status(poll_code),
            account=None,
            message=message,
            expires_at=None,
            last_error=None,
        )

    def logout(self) -> None:
        self.store.clear()

    def fetch_ai_subtitle(self, source_input: str, preferred_language: str | None = None) -> ResolvedSubtitle:
        snapshot = self.store.load()
        if snapshot.status != "active" or not snapshot.cookies:
            raise BilibiliError("当前没有可用的 B 站登录态，请先执行 login")

        bvid = extract_bvid(source_input)
        if not bvid:
            raise BilibiliError("无法从输入中解析 BV 号")

        view_payload = self._request_json(
            "https://api.bilibili.com/x/web-interface/view",
            params={"bvid": bvid},
        )
        aid = str(view_payload.get("data", {}).get("aid", "")).strip()
        cid = str(
            view_payload.get("data", {}).get("cid")
            or (view_payload.get("data", {}).get("pages") or [{}])[0].get("cid", "")
        ).strip()
        if not aid or not cid:
            raise BilibiliError("未能解析视频 aid/cid")

        cookie_header = build_cookie_header(snapshot.cookies)
        player_response = self.http.get(
            "https://api.bilibili.com/x/player/wbi/v2",
            params={"aid": aid, "cid": cid},
            headers=build_request_headers(cookie_header),
        )
        player_payload = self._parse_json_response(player_response)
        if looks_like_expired_auth(player_response.status_code, player_payload):
            self.store.mark_expired("Bilibili 登录态已失效")
            raise BilibiliError("Bilibili 登录态已失效，请重新扫码登录")

        track = choose_best_track(
            (player_payload.get("data", {}).get("subtitle", {}) or {}).get("subtitles", []),
            preferred_language=preferred_language,
        )
        if track is None:
            raise BilibiliError("当前视频没有可用的 AI 字幕轨")

        subtitle_response = self.http.get(
            track.subtitle_url,
            headers=build_request_headers(cookie_header),
        )
        subtitle_payload = self._parse_json_response(subtitle_response)
        if looks_like_expired_auth(subtitle_response.status_code, subtitle_payload):
            self.store.mark_expired("Bilibili 登录态已失效")
            raise BilibiliError("Bilibili 登录态已失效，请重新扫码登录")

        raw_subtitle_json = subtitle_response.text
        segments = parse_subtitle_segments(raw_subtitle_json)
        if not segments:
            raise BilibiliError("AI 字幕响应为空或无法解析")

        return ResolvedSubtitle(
            language=track.language,
            raw_subtitle_json=raw_subtitle_json,
            segments=segments,
            source="bilibili-auth",
            subtitle_url=track.subtitle_url,
            text=build_transcript_text(segments),
            track=track,
        )

    def _fetch_account_summary(self, cookies: Mapping[str, str]) -> Account | None:
        response = self.http.get(
            "https://api.bilibili.com/x/web-interface/nav",
            headers=build_request_headers(build_cookie_header(cookies)),
        )
        payload = self._parse_json_response(response)
        if looks_like_expired_auth(response.status_code, payload):
            raise BilibiliError("当前登录态已失效")
        data = payload.get("data", {})
        mid = str(data.get("mid", "")).strip()
        uname = str(data.get("uname", "")).strip()
        if not mid or not uname:
            return None
        return {
            "mid": mid,
            "uname": uname,
        }

    def _request_json(
        self,
        url: str,
        *,
        params: Mapping[str, str] | None = None,
        headers: Mapping[str, str] | None = None,
    ) -> dict:
        response = self.http.get(url, params=params, headers=headers or _DEFAULT_HEADERS)
        return self._parse_json_response(response)

    def _parse_json_response(self, response: httpx.Response) -> dict:
        try:
            return response.json()
        except json.JSONDecodeError as exc:
            raise BilibiliError(f"返回了无法解析的响应: {response.text[:120]}") from exc


def extract_bvid(source_input: str) -> str | None:
    raw = str(source_input or "").strip()
    if not raw:
        return None

    direct_match = _BV_PATTERN.search(raw)
    if direct_match:
        return direct_match.group(1)

    try:
        parsed = httpx.URL(raw)
    except Exception:
        return None

    path_match = _VIDEO_PATH_PATTERN.search(parsed.path)
    if path_match:
        return path_match.group(1)
    return None


def choose_best_track(payload: list[Mapping[str, object]], preferred_language: str | None = None) -> SubtitleTrack | None:
    tracks = []
    for item in payload:
        language = normalize_language(item.get("lan") or item.get("lang"))
        subtitle_url = normalize_subtitle_url(item.get("subtitle_url"))
        if not language or not subtitle_url:
            continue
        tracks.append(
            SubtitleTrack(
                language=language,
                label=str(item.get("lan_doc") or item.get("lan") or item.get("lang") or "").strip(),
                subtitle_url=subtitle_url,
            )
        )

    if not tracks:
        return None

    preferred_base = base_language(preferred_language)
    return min(
        tracks,
        key=lambda track: (
            rank_language(track.language, preferred_language),
            int(base_language(track.language) != preferred_base),
            track.language,
        ),
    )


def parse_subtitle_segments(raw_json: str) -> list[SubtitleSegment]:
    try:
        payload = json.loads(str(raw_json or ""))
    except json.JSONDecodeError:
        return []

    if isinstance(payload.get("body"), list):
        segments = [
            SubtitleSegment(
                start=round(float(item.get("from", 0) or 0), 3),
                end=round(float(item.get("to", 0) or 0), 3),
                text=normalize_text(item.get("content", "")),
            )
            for item in payload["body"]
        ]
        return [segment for segment in segments if segment.text]

    events = payload.get("events") or []
    normalized: list[SubtitleSegment] = []
    for event in events:
        start = round(float(event.get("tStartMs", 0) or 0) / 1000, 3)
        duration = max(0.0, float(event.get("dDurationMs", 0) or 0) / 1000)
        text = normalize_text("".join(str(segment.get("utf8", "")) for segment in event.get("segs", [])))
        if not text:
            continue
        normalized.append(
            SubtitleSegment(
                start=start,
                end=round(start + duration, 3),
                text=text,
            )
        )
    return normalized


def render_srt(segments: list[SubtitleSegment]) -> str:
    lines: list[str] = []
    for index, segment in enumerate(segments, start=1):
        lines.extend(
            [
                str(index),
                f"{format_srt_timestamp(segment.start)} --> {format_srt_timestamp(segment.end)}",
                segment.text,
                "",
            ]
        )
    return "\n".join(lines).strip()


def render_qr_ascii(text: str) -> str:
    qr = qrcode.QRCode(border=1)
    qr.add_data(text)
    qr.make(fit=True)
    output = io.StringIO()
    qr.print_ascii(out=output, invert=True)
    return output.getvalue()


def save_qr_svg(text: str, output_path: str) -> str:
    qr = qrcode.QRCode(border=1)
    qr.add_data(text)
    qr.make(fit=True)
    image = qr.make_image(image_factory=SvgPathImage)
    with open(output_path, "wb") as file:
        image.save(file)
    return output_path


def build_request_headers(cookie_header: str | None = None) -> dict[str, str]:
    headers = dict(_DEFAULT_HEADERS)
    if cookie_header:
        headers["Cookie"] = cookie_header
    return headers


def build_cookie_header(cookies: Mapping[str, str]) -> str:
    parts = []
    for name in COOKIE_WHITELIST:
        value = str(cookies.get(name, "")).strip()
        if value:
            parts.append(f"{name}={value}")
    return "; ".join(parts)


def extract_response_cookies(response: httpx.Response) -> dict[str, str]:
    cookies: dict[str, str] = {}
    for name in COOKIE_WHITELIST:
        value = response.cookies.get(name)
        if value:
            cookies[name] = value.strip()
    return cookies


def normalize_subtitle_url(raw_url: object) -> str:
    value = str(raw_url or "").strip()
    if value.startswith("//"):
        return f"https:{value}"
    return value


def normalize_language(value: object) -> str:
    return str(value or "").strip().lower()


def base_language(value: object) -> str:
    return normalize_language(value).split("-", 1)[0].split("_", 1)[0]


def rank_language(value: str, preferred_language: str | None = None) -> int:
    preferred = normalize_language(preferred_language)
    normalized = normalize_language(value)
    if not preferred:
        return 0
    if normalized == preferred:
        return 0
    if base_language(normalized) == base_language(preferred):
        return 1
    return 2


def looks_like_expired_auth(status_code: int, payload: Mapping[str, object] | None) -> bool:
    if status_code in {401, 403}:
        return True
    if not payload:
        return False
    code = int(payload.get("code", 0) or 0)
    message = str(payload.get("message") or payload.get("msg") or "").strip()
    return code == -101 or bool(_AUTH_EXPIRED_PATTERN.search(message))


def build_transcript_text(segments: list[SubtitleSegment]) -> str:
    return "\n".join(segment.text for segment in segments if segment.text).strip()


def normalize_text(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def format_srt_timestamp(seconds: float) -> str:
    whole = max(0.0, float(seconds))
    hours = int(whole // 3600)
    minutes = int((whole % 3600) // 60)
    secs = int(whole % 60)
    millis = int(round((whole - int(whole)) * 1000))
    if millis == 1000:
        secs += 1
        millis = 0
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def map_qr_poll_status(code: int) -> str:
    if code == 86101:
        return "pending"
    if code == 86090:
        return "scanned"
    if code == 86100:
        return "confirmed"
    return "failed"
