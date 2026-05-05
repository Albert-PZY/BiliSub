import { OPENAI_PROVIDER, resolveProviderBaseUrl, type ProviderId } from "./provider-catalog";

export interface SummarySettings {
  provider: ProviderId;
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxOutputTokens: number;
  connectionStatus: "unknown" | "passed" | "failed";
  connectionError?: string;
}

const SETTINGS_KEY = "summarySettings";

const DEFAULT_SUMMARY_SETTINGS: SummarySettings = {
  provider: OPENAI_PROVIDER.id,
  baseUrl: OPENAI_PROVIDER.baseUrl,
  apiKey: "",
  model: "",
  temperature: 0.2,
  maxOutputTokens: 1200,
  connectionStatus: "unknown",
};

function normalizeSummarySettings(settings: Partial<SummarySettings> | undefined): SummarySettings {
  const provider = settings?.provider ?? DEFAULT_SUMMARY_SETTINGS.provider;
  return {
    provider,
    baseUrl: resolveProviderBaseUrl(provider),
    apiKey: settings?.apiKey ?? DEFAULT_SUMMARY_SETTINGS.apiKey,
    model: settings?.model ?? DEFAULT_SUMMARY_SETTINGS.model,
    temperature: settings?.temperature ?? DEFAULT_SUMMARY_SETTINGS.temperature,
    maxOutputTokens: settings?.maxOutputTokens ?? DEFAULT_SUMMARY_SETTINGS.maxOutputTokens,
    connectionStatus: settings?.connectionStatus ?? DEFAULT_SUMMARY_SETTINGS.connectionStatus,
    connectionError: settings?.connectionError,
  };
}

export async function loadSummarySettings(): Promise<SummarySettings> {
  const payload = await chrome.storage.local.get(SETTINGS_KEY);
  return normalizeSummarySettings(payload[SETTINGS_KEY] as SummarySettings | undefined);
}

export async function saveSummarySettings(settings: SummarySettings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: normalizeSummarySettings(settings) });
}
