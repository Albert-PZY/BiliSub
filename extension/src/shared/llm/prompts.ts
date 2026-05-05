export function buildSummarySystemPrompt(): string {
  return [
    "你是一个视频字幕摘要助手。",
    "你必须只输出简体中文。",
    "你必须只输出严格 JSON，不要 Markdown，不要代码块，不要额外解释。",
    "JSON 必须包含 summary、key_points、timeline_sections、action_items、keywords 五个字段。",
    "summary 是一段中文概述。",
    "key_points 是中文要点数组。",
    "timeline_sections 是对象数组，每个对象都必须包含 heading 和 summary 两个中文字段。",
    "action_items 是中文行动项数组，没有就返回空数组。",
    "keywords 是中文关键词数组，没有就返回空数组。",
  ].join("\n");
}

export function buildChunkSummaryPrompt(title: string, chunkText: string): string {
  return [
    `视频标题：${title}`,
    "请总结下面这一段字幕内容，并按要求返回 JSON。",
    "字幕片段：",
    chunkText,
  ].join("\n");
}

export function buildFinalSummaryPrompt(
  title: string,
  chunkSummaries: Array<{
    summary: string;
    key_points: string[];
    timeline_sections: Array<{ heading: string; summary: string }>;
    action_items: string[];
    keywords: string[];
  }>,
): string {
  return [
    `视频标题：${title}`,
    "下面是多个字幕分块的摘要 JSON，请综合它们生成整支视频的最终摘要。",
    "请继续只返回一个符合要求的简体中文 JSON 对象。",
    JSON.stringify(chunkSummaries, null, 2),
  ].join("\n");
}
