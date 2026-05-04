import { BilibiliApiClient, extractBvid } from "../shared/bilibili/client";
import type {
  PageBridgeFetchRequest,
  PageBridgeFetchResponse,
  RuntimeRequest,
  RuntimeResponse,
} from "../shared/runtime/messages";

function requestPageJson(url: string): Promise<any> {
  const requestId = crypto.randomUUID();

  return new Promise((resolve, reject) => {
    const handler = (event: MessageEvent<PageBridgeFetchResponse>) => {
      if (event.source !== window) {
        return;
      }
      if (event.data?.type !== "WORKBENCH_FETCH_JSON_RESULT") {
        return;
      }
      if (event.data.requestId !== requestId) {
        return;
      }

      window.removeEventListener("message", handler);
      if (event.data.ok) {
        resolve(event.data.payload);
      } else {
        reject(new Error(event.data.error));
      }
    };

    window.addEventListener("message", handler);
    const payload: PageBridgeFetchRequest = { type: "WORKBENCH_FETCH_JSON", requestId, url };
    window.postMessage(payload, window.location.origin);
  });
}

const client = new BilibiliApiClient(requestPageJson);

chrome.runtime.onMessage.addListener((message: RuntimeRequest, _sender, sendResponse: (response: RuntimeResponse) => void) => {
  if (message.type === "WORKBENCH_GET_CONTEXT") {
    sendResponse({
      supported: location.pathname.startsWith("/video/"),
      bvid: extractBvid(location.href),
      title: document.title,
    });
    return true;
  }

  if (message.type === "WORKBENCH_LOAD_SUBTITLE") {
    client
      .loadAiSubtitle(location.href)
      .then((payload) => sendResponse({ ok: true, payload }))
      .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "unknown error" }));
    return true;
  }

  if (message.type === "WORKBENCH_JUMP_TO_TIME") {
    const video = document.querySelector("video");
    if (video instanceof HTMLVideoElement) {
      video.currentTime = Number(message.seconds);
      sendResponse({ ok: true });
    } else {
      sendResponse({ ok: false, error: "video element missing" });
    }
    return true;
  }

  return false;
});
