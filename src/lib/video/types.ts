export type VideoStatus = "UPLOADING" | "PROCESSING" | "READY" | "FAILED";

export interface VideoMetadata {
  provider: "publitio" | "bunny" | "youtube";
  providerVideoId: string;
  status: VideoStatus;
  durationSeconds?: number;
  thumbnailUrl?: string;
  hlsUrl?: string;
  mp4Url?: string;
  playbackMetadata?: Record<string, unknown>;
}

export interface VideoProvider {
  readonly name: "publitio" | "bunny" | "youtube";

  getVideo(providerVideoId: string): Promise<VideoMetadata>;
  deleteVideo(providerVideoId: string): Promise<void>;
  getPlaybackUrl(
    providerVideoId: string,
    options?: { userIp?: string; expiresInSeconds?: number }
  ): Promise<string>;
  getThumbnail(providerVideoId: string): Promise<string>;
  getStatus(providerVideoId: string): Promise<VideoStatus>;
}
