import type { SubtitleSegment } from "../bilibili/types";
import { buildChunkSummaryPrompt, buildFinalSummaryPrompt } from "./prompts";

export interface SummaryTimelineSection {
  heading: string;
  summary: string;
}

export interface SummaryResult {
  summary: string;
  key_points: string[];
  timeline_sections: SummaryTimelineSection[];
  action_items: string[];
  keywords: string[];
}

interface SummarizeInput {
  title: string;
  segments: SubtitleSegment[];
  complete: (prompt: string) => Promise<string>;
  chunkSize?: number;
}

function chunkSegments(segments: SubtitleSegment[], maxChars: number): string[] {
  const chunks: string[] = [];
  let currentChunk = "";

  for (const segment of segments) {
    const line = segment.text.trim();
    if (!line) {
      continue;
    }

    const nextChunk = currentChunk ? `${currentChunk}\n${line}` : line;
    if (nextChunk.length > maxChars && currentChunk) {
      chunks.push(currentChunk);
      currentChunk = line;
      continue;
    }

    currentChunk = nextChunk;
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
}

function normalizeTimelineSections(value: unknown): SummaryTimelineSection[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((section) => {
      if (!section || typeof section !== "object") {
        return null;
      }

      const heading = String((section as { heading?: unknown }).heading ?? "").trim();
      const summary = String((section as { summary?: unknown }).summary ?? "").trim();
      if (!heading && !summary) {
        return null;
      }

      return { heading, summary };
    })
    .filter((section): section is SummaryTimelineSection => section !== null);
}

function extractJsonPayload(raw: string): string {
  const trimmed = raw.trim();
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (fencedMatch?.[1] ?? trimmed).trim();
}

function parseSummaryResult(raw: string): SummaryResult {
  try {
    const payload = JSON.parse(extractJsonPayload(raw)) as Record<string, unknown>;
    const result: SummaryResult = {
      summary: String(payload.summary ?? "").trim(),
      key_points: toStringArray(payload.key_points),
      timeline_sections: normalizeTimelineSections(payload.timeline_sections),
      action_items: toStringArray(payload.action_items),
      keywords: toStringArray(payload.keywords),
    };

    if (!result.summary) {
      throw new Error("摘要结果缺少 summary");
    }

    return result;
  } catch (error) {
    if (error instanceof Error && error.message === "摘要结果缺少 summary") {
      throw error;
    }
    throw new Error("摘要结果格式错误");
  }
}

export async function summarizeSegments(input: SummarizeInput): Promise<SummaryResult> {
  const chunks = chunkSegments(input.segments, input.chunkSize ?? 4000);
  if (chunks.length === 0) {
    throw new Error("字幕为空，无法生成摘要");
  }

  const chunkResults: SummaryResult[] = [];
  for (const chunk of chunks) {
    const chunkResponse = await input.complete(buildChunkSummaryPrompt(input.title, chunk));
    chunkResults.push(parseSummaryResult(chunkResponse));
  }

  const finalResponse = await input.complete(buildFinalSummaryPrompt(input.title, chunkResults));
  return parseSummaryResult(finalResponse);
}
