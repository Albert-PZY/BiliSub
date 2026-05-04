from bili_ai_sub.bilibili import choose_best_track, extract_bvid


def test_extract_bvid_from_direct_value_and_url() -> None:
    assert extract_bvid("BV1darmBcE4A") == "BV1darmBcE4A"
    assert (
        extract_bvid("https://www.bilibili.com/video/BV1darmBcE4A/?spm_id_from=333.1007.tianma.1-1-1.click")
        == "BV1darmBcE4A"
    )
    assert extract_bvid("https://example.com/video/123") is None


def test_choose_best_track_prefers_requested_language_and_normalizes_url() -> None:
    track = choose_best_track(
        [
            {
                "lan": "en",
                "lan_doc": "English",
                "subtitle_url": "https://i0.hdslb.com/bfs/subtitle/en.json",
            },
            {
                "lan": "zh-Hans",
                "lan_doc": "简体中文",
                "subtitle_url": "//i0.hdslb.com/bfs/subtitle/zh-hans.json",
            },
        ],
        preferred_language="zh-Hans",
    )

    assert track is not None
    assert track.language == "zh-hans"
    assert track.label == "简体中文"
    assert track.subtitle_url == "https://i0.hdslb.com/bfs/subtitle/zh-hans.json"
