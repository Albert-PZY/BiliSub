// @vitest-environment node

import { describe, expect, it } from "vitest";
import { buildPlainText, renderSrt } from "../src/shared/bilibili/formatters";
import type { SubtitleSegment } from "../src/shared/bilibili/types";

const segments: SubtitleSegment[] = [
  { from: 0, to: 2.5, text: "第一句" },
  { from: 2.5, to: 5, text: "第二句" }
];

describe("subtitle formatters", () => {
  it("renders plain text with one line per segment", () => {
    expect(buildPlainText(segments)).toBe("第一句\n第二句");
  });

  it("renders srt blocks with contiguous numbering", () => {
    const output = renderSrt(segments);
    expect(output).toContain("1\n00:00:00,000 --> 00:00:02,500\n第一句");
    expect(output).toContain("2\n00:00:02,500 --> 00:00:05,000\n第二句");
  });
});
