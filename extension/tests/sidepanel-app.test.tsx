import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../src/sidepanel/App";

describe("side panel app", () => {
  it("shows unsupported state outside bilibili video pages", () => {
    render(<App initialState={{ status: "unsupported" }} />);
    expect(screen.getByText("当前页面不支持")).toBeInTheDocument();
  });

  it("shows a search box when subtitles are ready", () => {
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
    expect(screen.getByPlaceholderText("搜索字幕")).toBeInTheDocument();
  });
});
