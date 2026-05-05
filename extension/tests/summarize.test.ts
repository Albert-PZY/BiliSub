// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { summarizeSegments } from "../src/shared/llm/summarize";

describe("summarizeSegments", () => {
  it("returns chinese summary payload after chunk and final aggregation", async () => {
    const complete = vi
      .fn()
      .mockResolvedValueOnce(
        '{"summary":"分块摘要","key_points":["一点"],"timeline_sections":[{"heading":"开场","summary":"第一段"}],"action_items":[],"keywords":["关键词"]}',
      )
      .mockResolvedValueOnce(
        '{"summary":"最终摘要","key_points":["总结"],"timeline_sections":[{"heading":"全片","summary":"整体总结"}],"action_items":[],"keywords":["关键词"]}',
      );

    const result = await summarizeSegments({
      title: "示例视频",
      segments: [{ from: 0, to: 2, text: "This is a test sentence." }],
      complete,
    });

    expect(complete).toHaveBeenCalledTimes(2);
    expect(result.summary).toBe("最终摘要");
    expect(result.key_points[0]).toBe("总结");
  });
});
