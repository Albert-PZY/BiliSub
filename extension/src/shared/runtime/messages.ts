import type { ResolvedSubtitle } from "../bilibili/types";

export interface WorkbenchContextResult {
  supported: boolean;
  bvid: string | null;
  title: string;
}

export type PageBridgeFetchRequest = {
  type: "WORKBENCH_FETCH_JSON";
  requestId: string;
  url: string;
};

export type PageBridgeFetchResponse =
  | {
      type: "WORKBENCH_FETCH_JSON_RESULT";
      requestId: string;
      ok: true;
      payload: unknown;
    }
  | {
      type: "WORKBENCH_FETCH_JSON_RESULT";
      requestId: string;
      ok: false;
      error: string;
    };

export type RuntimeRequest =
  | { type: "WORKBENCH_GET_CONTEXT" }
  | { type: "WORKBENCH_LOAD_SUBTITLE" }
  | { type: "WORKBENCH_JUMP_TO_TIME"; seconds: number };

export type RuntimeResponse =
  | WorkbenchContextResult
  | { ok: true; payload: ResolvedSubtitle }
  | { ok: true }
  | { ok: false; error: string };
