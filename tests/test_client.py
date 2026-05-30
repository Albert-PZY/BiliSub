import httpx

from bili_ai_sub.bilibili import BilibiliClient, render_srt
from bili_ai_sub.store import SessionStore


def test_qr_login_success_persists_session(tmp_path) -> None:
    store = SessionStore(tmp_path / "session.json")

    def handler(request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        if "passport-login/web/qrcode/generate" in url:
            return httpx.Response(
                200,
                json={
                    "code": 0,
                    "data": {
                        "qrcode_key": "qr-key-1",
                        "url": "https://passport.bilibili.com/h5-app/passport/login/scan",
                    },
                },
            )
        if "passport-login/web/qrcode/poll" in url:
            return httpx.Response(
                200,
                json={
                    "code": 0,
                    "data": {
                        "code": 0,
                        "message": "0",
                    },
                },
                headers=[
                    ("set-cookie", "SESSDATA=sess-token; Path=/; HttpOnly"),
                    ("set-cookie", "DedeUserID=12345; Path=/"),
                ],
            )
        if "x/web-interface/nav" in url:
            assert "SESSDATA=sess-token" in request.headers["Cookie"]
            return httpx.Response(
                200,
                json={
                    "code": 0,
                    "data": {
                        "mid": 12345,
                        "uname": "tester",
                    },
                },
            )
        raise AssertionError(f"unexpected request: {url}")

    client = BilibiliClient(
        store=store,
        http_client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    qr_session = client.start_qr_login()
    poll_result = client.poll_qr_login(qr_session.qrcode_key)

    assert poll_result.status == "success"
    assert poll_result.account == {"mid": "12345", "uname": "tester"}
    assert store.load().cookies["SESSDATA"] == "sess-token"


def test_fetch_ai_subtitle_returns_segments_text_and_srt(tmp_path) -> None:
    store = SessionStore(tmp_path / "session.json")
    store.save_active(
        cookies={"SESSDATA": "sess-token", "DedeUserID": "12345"},
        account={"mid": "12345", "uname": "tester"},
    )

    def handler(request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        if "x/web-interface/view" in url:
            return httpx.Response(
                200,
                json={
                    "code": 0,
                    "data": {
                        "aid": 1001,
                        "cid": 2002,
                    },
                },
            )
        if "x/player/wbi/v2" in url:
            assert "SESSDATA=sess-token" in request.headers["Cookie"]
            return httpx.Response(
                200,
                json={
                    "code": 0,
                    "data": {
                        "subtitle": {
                            "subtitles": [
                                {
                                    "lan": "en",
                                    "lan_doc": "English",
                                    "subtitle_url": "https://i0.hdslb.com/bfs/subtitle/en.json",
                                },
                                {
                                    "lan": "zh-Hans",
                                    "lan_doc": "简体中文",
                                    "subtitle_url": "//i0.hdslb.com/bfs/subtitle/zh.json",
                                },
                            ]
                        }
                    },
                },
            )
        if "bfs/subtitle/zh.json" in url:
            return httpx.Response(
                200,
                json={
                    "body": [
                        {"from": 0, "to": 2.5, "content": "第一句"},
                        {"from": 2.5, "to": 5, "content": "第二句"},
                    ]
                },
            )
        raise AssertionError(f"unexpected request: {url}")

    client = BilibiliClient(
        store=store,
        http_client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    resolved = client.fetch_ai_subtitle(
        "https://www.bilibili.com/video/BV1darmBcE4A",
        preferred_language="zh-Hans",
    )

    assert resolved.language == "zh-hans"
    assert resolved.label == "简体中文"
    assert resolved.text == "第一句\n第二句"
    assert [segment.text for segment in resolved.segments] == ["第一句", "第二句"]
    assert render_srt(resolved.segments).splitlines()[1] == "00:00:00,000 --> 00:00:02,500"


def test_fetch_ai_subtitles_returns_all_available_languages(tmp_path) -> None:
    store = SessionStore(tmp_path / "session.json")
    store.save_active(
        cookies={"SESSDATA": "sess-token", "DedeUserID": "12345"},
        account={"mid": "12345", "uname": "tester"},
    )

    def handler(request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        if "x/web-interface/view" in url:
            return httpx.Response(200, json={"code": 0, "data": {"aid": 1001, "cid": 2002}})
        if "x/player/wbi/v2" in url:
            return httpx.Response(
                200,
                json={
                    "code": 0,
                    "data": {
                        "subtitle": {
                            "subtitles": [
                                {
                                    "lan": "en",
                                    "lan_doc": "English",
                                    "subtitle_url": "https://i0.hdslb.com/bfs/subtitle/en.json",
                                },
                                {
                                    "lan": "zh-Hans",
                                    "lan_doc": "简体中文",
                                    "subtitle_url": "//i0.hdslb.com/bfs/subtitle/zh.json",
                                },
                            ]
                        }
                    },
                },
            )
        if "bfs/subtitle/en.json" in url:
            return httpx.Response(200, json={"body": [{"from": 0, "to": 1, "content": "Hello"}]})
        if "bfs/subtitle/zh.json" in url:
            return httpx.Response(200, json={"body": [{"from": 0, "to": 1, "content": "你好"}]})
        raise AssertionError(f"unexpected request: {url}")

    client = BilibiliClient(
        store=store,
        http_client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    subtitles = client.fetch_ai_subtitles("BV1darmBcE4A")

    assert [subtitle.language for subtitle in subtitles] == ["en", "zh-hans"]
    assert [subtitle.text for subtitle in subtitles] == ["Hello", "你好"]
