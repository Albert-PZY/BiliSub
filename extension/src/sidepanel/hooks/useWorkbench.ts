import { useEffect, useMemo, useState } from "react";
import type { SubtitleSegment } from "../../shared/bilibili/types";

export interface WorkbenchState {
  status: "loading" | "unsupported" | "error" | "ready";
  title: string;
  bvid: string | null;
  text: string;
  segments: SubtitleSegment[];
  errorMessage?: string;
  summaryState: "disabled" | "idle" | "loading" | "ready" | "error";
}

export function useWorkbench(initialState?: Partial<WorkbenchState>) {
  const [state, setState] = useState<WorkbenchState>({
    status: "loading",
    title: "",
    bvid: null,
    text: "",
    segments: [],
    summaryState: "disabled",
    ...initialState,
  });
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

          setState({
            status: "ready",
            title: response.payload.title,
            bvid: response.payload.source,
            text: response.payload.text,
            segments: response.payload.segments,
            summaryState: "disabled",
          });
        });
      });
    });
  }, [initialState?.status]);

  async function jumpTo(seconds: number) {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.id) {
      return;
    }
    await chrome.tabs.sendMessage(tab.id, { type: "WORKBENCH_JUMP_TO_TIME", seconds });
  }

  return { state, query, setQuery, filteredSegments, jumpTo };
}
