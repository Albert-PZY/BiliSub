import { useEffect, useState } from "react";
import { PROVIDERS, resolveProviderBaseUrl } from "../shared/settings/provider-catalog";
import { loadSummarySettings, saveSummarySettings, type SummarySettings } from "../shared/settings/storage";

export function OptionsApp() {
  const [settings, setSettings] = useState<SummarySettings | null>(null);

  useEffect(() => {
    void loadSummarySettings().then(setSettings);
  }, []);

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
            setSettings({
              ...settings,
              provider,
              baseUrl: resolveProviderBaseUrl(provider),
              connectionStatus: "unknown",
              connectionError: undefined,
            });
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
            setSettings({
              ...settings,
              apiKey: event.target.value,
              connectionStatus: "unknown",
              connectionError: undefined,
            })
          }
        />
      </label>
      <label>
        Model
        <input
          aria-label="Model"
          value={settings.model}
          onChange={(event) =>
            setSettings({
              ...settings,
              model: event.target.value,
              connectionStatus: "unknown",
              connectionError: undefined,
            })
          }
        />
      </label>
      <p>Base URL: {settings.baseUrl}</p>
      <button
        type="button"
        onClick={() => {
          void saveSummarySettings(settings);
        }}
      >
        保存设置
      </button>
    </main>
  );
}
