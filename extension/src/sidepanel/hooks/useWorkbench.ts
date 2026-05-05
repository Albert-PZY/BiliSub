import { useEffect, useMemo, useState } from "react";
import type { SubtitleSegment } from "../../shared/bilibili/types";
import { createChatCompletionsClient } from "../../shared/llm/client";
import { buildSummarySystemPrompt } from "../../shared/llm/prompts";
import { summarizeSegments, type SummaryResult } from "../../shared/llm/summarize";
import { loadSummarySettings, saveSummarySettings, type SummarySettings } from "../../shared/settings/storage";

export interface WorkbenchState {
  status: "loading" | "unsupported" | "error" | "ready";
  title: string;
  bvid: string | null;
  text: string;
  segments: SubtitleSegment[];
  errorMessage?: string;
  summaryState: "disabled" | "idle" | "loading" | "ready" | "error";
  summaryDisabledReason?: string;
  summaryError?: string;
  summaryResult?: SummaryResult;
}

function buildSummaryAvailability(settings: SummarySettings): {
  summaryState: WorkbenchState["summaryState"];
  summaryDisabledReason?: string;
} {
  if (!settings.apiKey.trim()) {
    return {
      summaryState: "disabled",
      summaryDisabledReason: "未配置 API Key，摘要不可用。",
    };
  }

  if (!settings.model.trim()) {
    return {
      summaryState: "disabled",
      summaryDisabledReason: "未配置 Model，摘要不可用。",
    };
  }

  if (settings.connectionStatus !== "passed") {
    return {
      summaryState: "disabled",
      summaryDisabledReason: settings.connectionError
        ? `连接测试失败：${settings.connectionError}`
        : "尚未测试连接，摘要功能不可用。",
    };
  }

  return {
    summaryState: "idle",
    summaryDisabledReason: undefined,
  };
}

export function useWorkbench(initialState?: Partial<WorkbenchState>) {
  const [state, setState] = useState<WorkbenchState>({
    status: "loading",
    title: "",
    bvid: null,
    text: "",
    segments: [],
    summaryState: "disabled",
    summaryDisabledReason: "尚未测试连接，摘要功能不可用。",
    ...initialState,
  });
  const [summarySettings, setSummarySettings] = useState<SummarySettings | null>(null);
  const [query, setQuery] = useState("");

  const filteredSegments = useMemo(() => {
    const keyword = query.trim();
    if (!keyword) {
      return state.segments;
    }
    return state.segments.filter((segment) => segment.text.includes(keyword));
  }, [query, state.segments]);

  useEffect(() => {
    if (initialState?.status) {
      return;
    }

    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (!tabId) {
        setState((current) => ({
          ...current,
          status: "unsupported",
          errorMessage: "无法定位活动标签页",
        }));
        return;
      }

      chrome.tabs.sendMessage(tabId, { type: "WORKBENCH_GET_CONTEXT" }, (context) => {
        if (!context?.supported) {
          setState((current) => ({ ...current, status: "unsupported" }));
          return;
        }

        chrome.tabs.sendMessage(tabId, { type: "WORKBENCH_LOAD_SUBTITLE" }, (response) => {
          if (!response?.ok) {
            setState((current) => ({
              ...current,
              status: "error",
              errorMessage: response?.error ?? "字幕加载失败",
            }));
            return;
          }

          setState((current) => ({
            ...current,
            status: "ready",
            title: response.payload.title,
            bvid: response.payload.source,
            text: response.payload.text,
            segments: response.payload.segments,
          }));
        });
      });
    });
  }, [initialState?.status]);

  useEffect(() => {
    if (initialState?.status) {
      return;
    }

    let disposed = false;

    async function syncSummarySettings() {
      try {
        const nextSettings = await loadSummarySettings();
        if (disposed) {
          return;
        }

        setSummarySettings(nextSettings);
        setState((current) => ({
          ...current,
          ...buildSummaryAvailability(nextSettings),
          summaryError: undefined,
          summaryResult: undefined,
        }));
      } catch {
        if (disposed) {
          return;
        }

        setSummarySettings(null);
        setState((current) => ({
          ...current,
          summaryState: "disabled",
          summaryDisabledReason: "摘要设置加载失败。",
          summaryError: undefined,
          summaryResult: undefined,
        }));
      }
    }

    void syncSummarySettings();

    const handleStorageChanged: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (
      changes,
      areaName,
    ) => {
      if (areaName !== "local" || !changes.summarySettings) {
        return;
      }
      void syncSummarySettings();
    };

    chrome.storage.onChanged.addListener(handleStorageChanged);
    return () => {
      disposed = true;
      chrome.storage.onChanged.removeListener(handleStorageChanged);
    };
  }, [initialState?.status]);

  async function jumpTo(seconds: number) {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.id) {
      return;
    }
    await chrome.tabs.sendMessage(tab.id, { type: "WORKBENCH_JUMP_TO_TIME", seconds });
  }

  async function generateSummary() {
    if (state.status !== "ready" || !summarySettings) {
      return;
    }

    const availability = buildSummaryAvailability(summarySettings);
    if (availability.summaryState === "disabled") {
      setState((current) => ({
        ...current,
        ...availability,
        summaryError: undefined,
        summaryResult: undefined,
      }));
      return;
    }

    setState((current) => ({
      ...current,
      summaryState: "loading",
      summaryError: undefined,
      summaryResult: undefined,
    }));

    try {
      const client = createChatCompletionsClient();
      const result = await summarizeSegments({
        title: state.title,
        segments: state.segments,
        complete: async (prompt) =>
          client.complete({
            baseUrl: summarySettings.baseUrl,
            apiKey: summarySettings.apiKey,
            model: summarySettings.model,
            temperature: summarySettings.temperature,
            maxOutputTokens: summarySettings.maxOutputTokens,
            messages: [
              {
                role: "system",
                content: buildSummarySystemPrompt(),
              },
              {
                role: "user",
                content: prompt,
              },
            ],
          }),
      });

      setState((current) => ({
        ...current,
        summaryState: "ready",
        summaryDisabledReason: undefined,
        summaryError: undefined,
        summaryResult: result,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "摘要生成失败";
      const failedSettings: SummarySettings = {
        ...summarySettings,
        connectionStatus: "failed",
        connectionError: message,
      };

      setSummarySettings(failedSettings);
      void saveSummarySettings(failedSettings);
      setState((current) => ({
        ...current,
        summaryState: "error",
        summaryDisabledReason: buildSummaryAvailability(failedSettings).summaryDisabledReason,
        summaryError: message,
        summaryResult: undefined,
      }));
    }
  }

  return { state, query, setQuery, filteredSegments, jumpTo, generateSummary };
}
