import type { SubtitleSegment } from "./types";

function formatTimestamp(seconds: number): string {
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const secs = Math.floor((totalMs % 60_000) / 1_000);
  const millis = totalMs % 1_000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

export function buildPlainText(segments: SubtitleSegment[]): string {
  return segments
    .map((segment) => segment.text.trim())
    .filter(Boolean)
    .join("\n");
}

export function renderSrt(segments: SubtitleSegment[]): string {
  return segments
    .map((segment, index) => {
      const start = formatTimestamp(segment.from);
      const end = formatTimestamp(segment.to);
      return `${index + 1}\n${start} --> ${end}\n${segment.text.trim()}`;
    })
    .join("\n\n");
}

export function buildExportFileName(source: string, extension: "txt" | "srt"): string {
  const fallback = source.trim() || "subtitle";
  return `${fallback}.ai-subtitles.${extension}`;
}
