export const OPENAI_PROVIDER = {
  id: "openai",
  label: "OpenAI",
  baseUrl: "https://api.openai.com/v1",
} as const;

export const DASHSCOPE_PROVIDER = {
  id: "dashscope",
  label: "阿里云百炼",
  baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
} as const;

export const PROVIDERS = [OPENAI_PROVIDER, DASHSCOPE_PROVIDER] as const;

export type ProviderId = (typeof PROVIDERS)[number]["id"];

const PROVIDER_MAP: Record<ProviderId, (typeof PROVIDERS)[number]> = {
  [OPENAI_PROVIDER.id]: OPENAI_PROVIDER,
  [DASHSCOPE_PROVIDER.id]: DASHSCOPE_PROVIDER,
};

export function getProviderPreset(providerId: string | undefined) {
  return PROVIDER_MAP[(providerId ?? OPENAI_PROVIDER.id) as ProviderId] ?? OPENAI_PROVIDER;
}

export function resolveProviderBaseUrl(providerId: string | undefined): string {
  return getProviderPreset(providerId).baseUrl;
}
