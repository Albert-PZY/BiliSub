import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OptionsApp } from "../src/options/App";
import { DASHSCOPE_PROVIDER, OPENAI_PROVIDER } from "../src/shared/settings/provider-catalog";

function createStorageSettings() {
  return {
    summarySettings: {
      provider: OPENAI_PROVIDER.id,
      baseUrl: OPENAI_PROVIDER.baseUrl,
      apiKey: "",
      model: "gpt-4.1-mini",
      temperature: 0.2,
      maxOutputTokens: 1200,
      connectionStatus: "unknown" as const,
    },
  };
}

describe("options app", () => {
  const localGet = vi.fn();

  beforeEach(() => {
    localGet.mockReset();
    localGet.mockResolvedValue(createStorageSettings());
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: localGet,
          set: vi.fn(async () => undefined),
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("only offers approved providers and does not expose editable base url", async () => {
    render(<OptionsApp />);

    const providerSelect = await screen.findByRole("combobox", { name: "摘要服务" });
    const options = within(providerSelect).getAllByRole("option");

    expect(options.map((option) => option.textContent)).toEqual(["OpenAI", "阿里云百炼"]);
    expect(screen.getByText(`Base URL: ${OPENAI_PROVIDER.baseUrl}`)).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /base url/i })).not.toBeInTheDocument();
  });

  it("switches base url when provider changes", async () => {
    const user = userEvent.setup();

    render(<OptionsApp />);

    const providerSelect = await screen.findByRole("combobox", { name: "摘要服务" });
    await user.selectOptions(providerSelect, DASHSCOPE_PROVIDER.id);

    await waitFor(() => {
      expect(screen.getByText(`Base URL: ${DASHSCOPE_PROVIDER.baseUrl}`)).toBeInTheDocument();
    });
  });
});
