import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../src/sidepanel/App";

describe("side panel summary", () => {
  it("disables summary when llm is unavailable", () => {
    render(
      <App
        initialState={{
          status: "ready",
          title: "示例视频",
          bvid: "BV1darmBcE4A",
          segments: [{ from: 0, to: 2, text: "第一句" }],
          text: "第一句",
          summaryState: "disabled",
          summaryDisabledReason: "未配置 API Key，摘要不可用。",
        }}
      />,
    );

    expect(screen.getByRole("button", { name: "生成摘要" })).toBeDisabled();
    expect(screen.getByText("未配置 API Key，摘要不可用。")).toBeInTheDocument();
  });

  it("shows generated summary content", () => {
    render(
      <App
        initialState={{
          status: "ready",
          title: "示例视频",
          bvid: "BV1darmBcE4A",
          segments: [{ from: 0, to: 2, text: "第一句" }],
          text: "第一句",
          summaryState: "ready",
          summaryResult: {
            summary: "最终摘要",
            key_points: ["总结一"],
            timeline_sections: [{ heading: "开场", summary: "内容概览" }],
            action_items: [],
            keywords: ["关键词"],
          },
        }}
      />,
    );

    expect(screen.getByText("最终摘要")).toBeInTheDocument();
    expect(screen.getByText("总结一")).toBeInTheDocument();
    expect(screen.getByText("开场")).toBeInTheDocument();
  });
});
