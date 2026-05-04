// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { BilibiliApiClient, extractBvid } from "../src/shared/bilibili/client";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
});

describe("extractBvid", () => {
  it("extracts bvid from video url", () => {
    expect(extractBvid("https://www.bilibili.com/video/BV1darmBcE4A")).toBe("BV1darmBcE4A");
  });
});

describe("BilibiliApiClient", () => {
  it("loads subtitle segments from the bilibili api chain", async () => {
    fetchMock
      .mockResolvedValueOnce({ data: { aid: 1, cid: 2, title: "示例视频" } })
      .mockResolvedValueOnce({
        data: {
          subtitle: {
            subtitles: [
              { lan: "zh-Hans", lan_doc: "简体中文", subtitle_url: "https://i0.hdslb.com/subtitle/demo.json" }
            ]
          }
        }
      })
      .mockResolvedValueOnce({
        body: [{ from: 0, to: 2, content: "第一句" }]
      });

    const client = new BilibiliApiClient(fetchMock);
    const resolved = await client.loadAiSubtitle("BV1darmBcE4A");

    expect(resolved.language).toBe("zh-Hans");
    expect(resolved.segments[0].text).toBe("第一句");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
