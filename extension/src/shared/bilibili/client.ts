import { buildPlainText } from "./formatters";
import type { ResolvedSubtitle, SubtitleSegment, SubtitleTrack } from "./types";

const BV_PATTERN = /\b(BV[0-9A-Za-z]{10})\b/;

export function extractBvid(source: string): string | null {
  const match = String(source).match(BV_PATTERN);
  return match ? match[1] : null;
}

function normalizeSubtitleUrl(raw: unknown): string {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  return value.startsWith("//") ? `https:${value}` : value;
}

function chooseBestTrack(payload: Array<Record<string, unknown>>, preferredLanguage = "zh-Hans"): SubtitleTrack | null {
  const tracks = payload
    .map((item) => ({
      language: String(item.lan ?? "").trim(),
      languageCode: String(item.lan_doc ?? "").trim(),
      subtitleUrl: normalizeSubtitleUrl(item.subtitle_url),
    }))
    .filter((track) => track.language && track.subtitleUrl);

  return tracks.find((track) => track.language === preferredLanguage) ?? tracks[0] ?? null;
}

function parseSegments(raw: any): SubtitleSegment[] {
  const body = Array.isArray(raw?.body) ? raw.body : [];
  return body
    .map((item) => ({
      from: Number(item.from ?? 0),
      to: Number(item.to ?? 0),
      text: String(item.content ?? "").trim(),
    }))
    .filter((segment) => segment.text);
}

export class BilibiliApiClient {
  constructor(private readonly requestJson: (input: string) => Promise<any>) {}

  async loadAiSubtitle(source: string, preferredLanguage = "zh-Hans"): Promise<ResolvedSubtitle> {
    const bvid = extractBvid(source);
    if (!bvid) {
      throw new Error("无法解析 BV 号");
    }

    const viewPayload = await this.requestJson(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`);
    const aid = String(viewPayload?.data?.aid ?? "").trim();
    const cid = String(viewPayload?.data?.cid ?? viewPayload?.data?.pages?.[0]?.cid ?? "").trim();
    const title = String(viewPayload?.data?.title ?? bvid).trim();
    if (!aid || !cid) {
      throw new Error("未能解析视频 aid/cid");
    }

    const playerPayload = await this.requestJson(`https://api.bilibili.com/x/player/wbi/v2?aid=${aid}&cid=${cid}`);
    const track = chooseBestTrack(playerPayload?.data?.subtitle?.subtitles ?? [], preferredLanguage);
    if (!track) {
      throw new Error("无可用 AI 字幕");
    }

    const subtitlePayload = await this.requestJson(track.subtitleUrl);
    const segments = parseSegments(subtitlePayload);
    if (segments.length === 0) {
      throw new Error("字幕为空");
    }

    return {
      source: bvid,
      title,
      language: track.language,
      subtitleUrl: track.subtitleUrl,
      segments,
      text: buildPlainText(segments),
    };
  }
}
