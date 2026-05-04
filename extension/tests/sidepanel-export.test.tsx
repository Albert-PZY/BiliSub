import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/sidepanel/App";

beforeEach(() => {
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) }
  });
});

describe("side panel export actions", () => {
  it("copies the full subtitle text", () => {
    render(
      <App
        initialState={{
          status: "ready",
          title: "示例视频",
          bvid: "BV1darmBcE4A",
          segments: [{ from: 0, to: 2, text: "第一句" }],
          text: "第一句",
          summaryState: "disabled",
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "复制全文" }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("第一句");
  });
});
