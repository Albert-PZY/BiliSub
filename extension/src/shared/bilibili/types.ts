export interface SubtitleSegment {
  from: number;
  to: number;
  text: string;
}

export interface SubtitleTrack {
  language: string;
  languageCode: string;
  subtitleUrl: string;
}

export interface ResolvedSubtitle {
  source: string;
  title: string;
  language: string;
  subtitleUrl: string;
  segments: SubtitleSegment[];
  text: string;
}
