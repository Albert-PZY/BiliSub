// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DASHSCOPE_PROVIDER, OPENAI_PROVIDER } from "../src/shared/settings/provider-catalog";
import { loadSummarySettings, saveSummarySettings } from "../src/shared/settings/storage";

const localStore = new Map<string, unknown>();
const syncStore = new Map<string, unknown>();

beforeEach(() => {
  localStore.clear();
  syncStore.clear();
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: vi.fn(async () => Object.fromEntries(localStore)),
        set: vi.fn(async (payload: Record<string, unknown>) => {
          Object.entries(payload).forEach(([key, value]) => localStore.set(key, value));
        }),
      },
      sync: {
        get: vi.fn(async () => Object.fromEntries(syncStore)),
        set: vi.fn(async (payload: Record<string, unknown>) => {
          Object.entries(payload).forEach(([key, value]) => syncStore.set(key, value));
        }),
      },
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("summary settings storage", () => {
  it("persists api key only in local storage", async () => {
    await saveSummarySettings({
      provider: OPENAI_PROVIDER.id,
      baseUrl: OPENAI_PROVIDER.baseUrl,
      apiKey: "sk-demo",
      model: "gpt-4.1-mini",
      temperature: 0.2,
      maxOutputTokens: 1200,
      connectionStatus: "passed",
    });

    const settings = await loadSummarySettings();
    expect(settings.apiKey).toBe("sk-demo");
    expect(syncStore.size).toBe(0);
  });

  it("keeps dashscope on its official preset url", () => {
    expect(DASHSCOPE_PROVIDER.baseUrl).toBe("https://dashscope.aliyuncs.com/compatible-mode/v1");
  });
});
