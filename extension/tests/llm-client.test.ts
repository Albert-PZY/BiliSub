// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { createChatCompletionsClient } from "../src/shared/llm/client";

describe("llm client", () => {
  it("calls the approved chat completions path", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"summary":"好的","key_points":[],"timeline_sections":[],"action_items":[],"keywords":[]}' } }],
        }),
      ),
    );

    const client = createChatCompletionsClient(fetchMock);
    await client.complete({
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-demo",
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: "你好" }],
      temperature: 0.2,
      maxOutputTokens: 1200,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
