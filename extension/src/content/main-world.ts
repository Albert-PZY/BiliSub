import type { PageBridgeFetchRequest, PageBridgeFetchResponse } from "../shared/runtime/messages";

window.addEventListener("message", async (event) => {
  if (event.source !== window) {
    return;
  }

  const data = event.data as PageBridgeFetchRequest | undefined;
  if (!data || data.type !== "WORKBENCH_FETCH_JSON") {
    return;
  }

  let response: PageBridgeFetchResponse;

  try {
    const result = await fetch(data.url, {
      credentials: "include",
      headers: {
        Accept: "application/json, text/plain, */*",
      },
    });
    const payload = await result.json();
    response = {
      type: "WORKBENCH_FETCH_JSON_RESULT",
      requestId: data.requestId,
      ok: true,
      payload,
    };
  } catch (error) {
    response = {
      type: "WORKBENCH_FETCH_JSON_RESULT",
      requestId: data.requestId,
      ok: false,
      error: error instanceof Error ? error.message : "fetch failed",
    };
  }

  window.postMessage(response, window.location.origin);
});
