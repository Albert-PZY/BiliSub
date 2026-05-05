import { PROVIDERS } from "../settings/provider-catalog";

export type ChatCompletionRole = "system" | "user" | "assistant";

export interface ChatCompletionMessage {
  role: ChatCompletionRole;
  content: string;
}

export interface ChatCompletionsInput {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatCompletionMessage[];
  temperature: number;
  maxOutputTokens: number;
}

const APPROVED_BASE_URLS = new Set(PROVIDERS.map((provider) => provider.baseUrl));

function normalizeBaseUrl(baseUrl: string): string {
  return String(baseUrl ?? "").trim().replace(/\/+$/, "");
}

function assertApprovedBaseUrl(baseUrl: string): string {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!APPROVED_BASE_URLS.has(normalized)) {
    throw new Error("未批准的 LLM baseUrl");
  }
  return normalized;
}

function extractAssistantContent(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const choice = (payload as { choices?: Array<Record<string, unknown>> }).choices?.[0];
  if (!choice || typeof choice !== "object") {
    return "";
  }

  const message = choice.message as Record<string, unknown> | undefined;
  const messageContent = message?.content;
  if (typeof messageContent === "string") {
    return messageContent;
  }

  if (Array.isArray(messageContent)) {
    return messageContent
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (part && typeof part === "object") {
          return String((part as { text?: unknown }).text ?? "");
        }
        return "";
      })
      .join("")
      .trim();
  }

  const text = choice.text;
  if (typeof text === "string") {
    return text;
  }

  return "";
}

async function readErrorMessage(response: Response): Promise<string> {
  const rawBody = await response.text().catch(() => "");
  if (!rawBody.trim()) {
    return `${response.status} ${response.statusText}`.trim();
  }

  try {
    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const errorMessage = payload.error && typeof payload.error === "object"
      ? String((payload.error as { message?: unknown }).message ?? "")
      : "";
    const fallbackMessage = String(payload.message ?? payload.error ?? payload.msg ?? "").trim();
    return errorMessage.trim() || fallbackMessage || rawBody.trim();
  } catch {
    return rawBody.trim();
  }
}

export function createChatCompletionsClient(fetchImpl: typeof fetch = fetch) {
  return {
    async complete(input: ChatCompletionsInput): Promise<string> {
      const baseUrl = assertApprovedBaseUrl(input.baseUrl);
      if (!input.apiKey.trim()) {
        throw new Error("未配置 API Key");
      }
      if (!input.model.trim()) {
        throw new Error("未配置 Model");
      }

      const response = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${input.apiKey}`,
        },
        body: JSON.stringify({
          model: input.model,
          messages: input.messages,
          temperature: input.temperature,
          max_tokens: input.maxOutputTokens,
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const payload = await response.json();
      const content = extractAssistantContent(payload);
      if (!content) {
        throw new Error("LLM 未返回内容");
      }

      return content;
    },
  };
}
