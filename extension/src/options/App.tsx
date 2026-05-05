import { useEffect, useState } from "react";
import { createChatCompletionsClient } from "../shared/llm/client";
import { PROVIDERS, resolveProviderBaseUrl } from "../shared/settings/provider-catalog";
import { loadSummarySettings, saveSummarySettings, type SummarySettings } from "../shared/settings/storage";

function buildConnectionMessage(settings: SummarySettings): string {
  if (!settings.apiKey.trim()) {
    return "未配置 API Key，摘要功能不可用。";
  }

  if (!settings.model.trim()) {
    return "未配置 Model，摘要功能不可用。";
  }

  if (settings.connectionStatus === "passed") {
    return "连接测试已通过，摘要功能可用。";
  }

  if (settings.connectionStatus === "failed") {
    return `连接测试失败：${settings.connectionError ?? "连接失败"}`;
  }

  return "尚未测试连接，摘要功能不可用。";
}

export function OptionsApp() {
  const [settings, setSettings] = useState<SummarySettings | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    void loadSummarySettings().then((loaded) => {
      setSettings(loaded);
      setStatusMessage(buildConnectionMessage(loaded));
    });
  }, []);

  async function persistSettings(nextSettings: SummarySettings) {
    setIsSaving(true);
    try {
      await saveSummarySettings(nextSettings);
      setStatusMessage("设置已保存。");
    } finally {
      setIsSaving(false);
    }
  }

  async function testConnection(currentSettings: SummarySettings) {
    setIsTesting(true);
    const client = createChatCompletionsClient();

    try {
      await client.complete({
        baseUrl: currentSettings.baseUrl,
        apiKey: currentSettings.apiKey,
        model: currentSettings.model,
        messages: [{ role: "user", content: "请只返回 OK" }],
        temperature: 0,
        maxOutputTokens: 16,
      });

      const nextSettings: SummarySettings = {
        ...currentSettings,
        connectionStatus: "passed",
        connectionError: undefined,
      };
      setSettings(nextSettings);
      await saveSummarySettings(nextSettings);
      setStatusMessage(buildConnectionMessage(nextSettings));
    } catch (error) {
      const message = error instanceof Error ? error.message : "连接失败";
      const nextSettings: SummarySettings = {
        ...currentSettings,
        connectionStatus: "failed",
        connectionError: message,
      };
      setSettings(nextSettings);
      await saveSummarySettings(nextSettings);
      setStatusMessage(buildConnectionMessage(nextSettings));
    } finally {
      setIsTesting(false);
    }
  }

  if (!settings) {
    return <main>设置加载中…</main>;
  }

  return (
    <main>
      <h1>摘要设置</h1>
      <label>
        摘要服务
        <select
          value={settings.provider}
          onChange={(event) => {
            const provider = event.target.value as SummarySettings["provider"];
            const nextSettings: SummarySettings = {
              ...settings,
              provider,
              baseUrl: resolveProviderBaseUrl(provider),
              connectionStatus: "unknown",
              connectionError: undefined,
            };
            setSettings(nextSettings);
            setStatusMessage(buildConnectionMessage(nextSettings));
          }}
        >
          {PROVIDERS.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        API Key
        <input
          aria-label="API Key"
          type="password"
          value={settings.apiKey}
          onChange={(event) =>
            {
              const nextSettings: SummarySettings = {
              ...settings,
              apiKey: event.target.value,
              connectionStatus: "unknown",
              connectionError: undefined,
              };
              setSettings(nextSettings);
              setStatusMessage(buildConnectionMessage(nextSettings));
            }
          }
        />
      </label>
      <label>
        Model
        <input
          aria-label="Model"
          value={settings.model}
          onChange={(event) =>
            {
              const nextSettings: SummarySettings = {
              ...settings,
              model: event.target.value,
              connectionStatus: "unknown",
              connectionError: undefined,
              };
              setSettings(nextSettings);
              setStatusMessage(buildConnectionMessage(nextSettings));
            }
          }
        />
      </label>
      <p>Base URL: {settings.baseUrl}</p>
      <p>{statusMessage || buildConnectionMessage(settings)}</p>
      <section>
        <button
          type="button"
          disabled={isTesting}
          onClick={() => {
            void testConnection(settings);
          }}
        >
          {isTesting ? "测试中…" : "测试连接"}
        </button>
        <button
          type="button"
          disabled={isSaving}
          onClick={() => {
            void persistSettings(settings);
          }}
        >
          {isSaving ? "保存中…" : "保存设置"}
        </button>
      </section>
    </main>
  );
}
