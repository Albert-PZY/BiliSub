from bili_ai_sub.store import SessionStore


def test_session_store_saves_only_whitelisted_cookies(tmp_path) -> None:
    store = SessionStore(tmp_path / "session.json")

    store.save_active(
        cookies={
            "SESSDATA": "sess-token",
            "DedeUserID": "12345",
            "not_allowed": "ignore-me",
        },
        account={"mid": "12345", "uname": "tester"},
    )

    snapshot = store.load()
    assert snapshot.status == "active"
    assert snapshot.account is not None
    assert snapshot.account["uname"] == "tester"
    assert snapshot.cookies == {
        "SESSDATA": "sess-token",
        "DedeUserID": "12345",
    }
