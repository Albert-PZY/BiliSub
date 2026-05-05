import { buildExportFileName, renderSrt } from "../shared/bilibili/formatters";
import { useWorkbench, type WorkbenchState } from "./hooks/useWorkbench";
import { triggerDownload } from "./utils/download";

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

export function App({ initialState }: { initialState?: Partial<WorkbenchState> }) {
  const { state, query, setQuery, filteredSegments, jumpTo, generateSummary } = useWorkbench(initialState);
  const summaryButtonDisabled =
    state.status !== "ready" ||
    state.summaryState === "disabled" ||
    state.summaryState === "loading" ||
    state.summaryState === "error";

  if (state.status === "loading") {
    return <main>字幕加载中…</main>;
  }

  if (state.status === "unsupported") {
    return <main>当前页面不支持</main>;
  }

  if (state.status === "error") {
    return <main>{state.errorMessage ?? "字幕加载失败"}</main>;
  }

  return (
    <main>
      <header>
        <h1>{state.title}</h1>
        <p>{state.bvid}</p>
      </header>
      <section>
        <button type="button" onClick={() => void copyText(state.text)}>
          复制全文
        </button>
        <button
          type="button"
          onClick={() =>
            triggerDownload(
              buildExportFileName(state.bvid ?? "subtitle", "txt"),
              state.text,
              "text/plain;charset=utf-8",
            )
          }
        >
          导出 TXT
        </button>
        <button
          type="button"
          onClick={() =>
            triggerDownload(
              buildExportFileName(state.bvid ?? "subtitle", "srt"),
              renderSrt(state.segments),
              "text/plain;charset=utf-8",
            )
          }
        >
          导出 SRT
        </button>
        <button
          type="button"
          disabled={summaryButtonDisabled}
          onClick={() => {
            void generateSummary();
          }}
        >
          {state.summaryState === "loading" ? "生成摘要中…" : "生成摘要"}
        </button>
      </section>
      {state.summaryState === "disabled" ? <p>{state.summaryDisabledReason}</p> : null}
      {state.summaryState === "error" ? <p>{state.summaryError ?? "摘要生成失败"}</p> : null}
      {state.summaryState === "ready" && state.summaryResult ? (
        <article>
          <h2>摘要结果</h2>
          <p>{state.summaryResult.summary}</p>
          {state.summaryResult.key_points.length > 0 ? (
            <section>
              <h3>要点</h3>
              <ul>
                {state.summaryResult.key_points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </section>
          ) : null}
          {state.summaryResult.timeline_sections.length > 0 ? (
            <section>
              <h3>章节小结</h3>
              <ul>
                {state.summaryResult.timeline_sections.map((section) => (
                  <li key={`${section.heading}-${section.summary}`}>
                    <strong>{section.heading}</strong>
                    <p>{section.summary}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {state.summaryResult.action_items.length > 0 ? (
            <section>
              <h3>行动项</h3>
              <ul>
                {state.summaryResult.action_items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}
          {state.summaryResult.keywords.length > 0 ? (
            <section>
              <h3>关键词</h3>
              <p>{state.summaryResult.keywords.join(" / ")}</p>
            </section>
          ) : null}
        </article>
      ) : null}
      <input
        placeholder="搜索字幕"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <ul>
        {filteredSegments.length === 0 ? <li>没有匹配结果</li> : null}
        {filteredSegments.map((segment) => (
          <li key={`${segment.from}-${segment.to}`}>
            <button type="button" onClick={() => jumpTo(segment.from)}>
              {segment.text}
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
