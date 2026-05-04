import { buildExportFileName, renderSrt } from "../shared/bilibili/formatters";
import { useWorkbench, type WorkbenchState } from "./hooks/useWorkbench";
import { triggerDownload } from "./utils/download";

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

export function App({ initialState }: { initialState?: Partial<WorkbenchState> }) {
  const { state, query, setQuery, filteredSegments, jumpTo } = useWorkbench(initialState);

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
      </section>
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
