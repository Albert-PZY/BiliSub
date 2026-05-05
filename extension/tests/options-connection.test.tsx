import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OPENAI_PROVIDER } from "../src/shared/settings/provider-catalog";

const completeMock = vi.fn();

vi.mock("../src/shared/llm/client", () => ({
  createChatCompletionsClient: () => ({
    complete: completeMock,
  }),
}));

import { OptionsApp } from "../src/options/App";

function createSettings() {
  return {
    summarySettings: {
      provider: OPENAI_PROVIDER.id,
      baseUrl: OPENAI_PROVIDER.baseUrl,
      apiKey: "sk-demo",
      model: "gpt-4.1-mini",
      temperature: 0.2,
      maxOutputTokens: 1200,
      connectionStatus: "unknown" as const,
    },
  };
}

describe("options connection", () => {
  const localSet = vi.fn();

  beforeEach(() => {
    completeMock.mockReset();
    localSet.mockReset();
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn(async () => createSettings()),
          set: localSet,
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("marks settings as passed after a successful test", async () => {
    const user = userEvent.setup();
    completeMock.mockResolvedValue("OK");

    render(<OptionsApp />);

    await user.click(await screen.findByRole("button", { name: "测试连接" }));

    await waitFor(() => {
      expect(screen.getByText("连接测试已通过，摘要功能可用。")).toBeInTheDocument();
    });
    expect(localSet).toHaveBeenCalledWith(
      expect.objectContaining({
        summarySettings: expect.objectContaining({
          connectionStatus: "passed",
        }),
      }),
    );
  });

  it("marks settings as failed after a failed test", async () => {
    const user = userEvent.setup();
    completeMock.mockRejectedValue(new Error("401 Unauthorized"));

    render(<OptionsApp />);

    await user.click(await screen.findByRole("button", { name: "测试连接" }));

    await waitFor(() => {
      expect(screen.getByText("连接测试失败：401 Unauthorized")).toBeInTheDocument();
    });
    expect(localSet).toHaveBeenCalledWith(
      expect.objectContaining({
        summarySettings: expect.objectContaining({
          connectionStatus: "failed",
          connectionError: "401 Unauthorized",
        }),
      }),
    );
  });
});
