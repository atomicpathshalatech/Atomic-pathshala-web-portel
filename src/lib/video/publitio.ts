import "server-only";
import crypto from "crypto";
import { VideoProvider, VideoMetadata, VideoStatus } from "./types";

export class PublitioVideoProvider implements VideoProvider {
  readonly name = "publitio" as const;

  private apiKey: string;
  private apiSecret: string;
  private baseUrl = "https://api.publit.io/v1";

  constructor() {
    this.apiKey = process.env.PUBLITIO_API_KEY || "";
    this.apiSecret = process.env.PUBLITIO_API_SECRET || "";
  }

  private generateSignature(timestamp: number, nonce: string): string {
    const stringToSign = `${timestamp}${nonce}${this.apiSecret}`;
    return crypto.createHash("sha1").update(stringToSign).digest("hex");
  }

  private getAuthParams(): Record<string, string> {
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = Math.floor(Math.random() * 90000000 + 10000000).toString();
    const signature = this.generateSignature(timestamp, nonce);

    return {
      api_key: this.apiKey,
      api_timestamp: timestamp.toString(),
      api_nonce: nonce,
      api_signature: signature,
    };
  }

  async getVideo(providerVideoId: string): Promise<VideoMetadata> {
    if (!this.apiKey || !this.apiSecret) {
      // Degrade gracefully if credentials not set yet
      return {
        provider: "publitio",
        providerVideoId,
        status: "READY",
        thumbnailUrl: `https://media.publit.io/file/${providerVideoId}.jpg`,
        hlsUrl: `https://media.publit.io/file/${providerVideoId}.m3u8`,
        mp4Url: `https://media.publit.io/file/${providerVideoId}.mp4`,
      };
    }

    const params = new URLSearchParams(this.getAuthParams());
    const res = await fetch(`${this.baseUrl}/files/show/${providerVideoId}?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`Publitio API error: ${res.statusText}`);
    }

    const data = await res.json();
    const status: VideoStatus =
      data.status === "ready"
        ? "READY"
        : data.status === "processing"
        ? "PROCESSING"
        : data.status === "failed"
        ? "FAILED"
        : "UPLOADING";

    return {
      provider: "publitio",
      providerVideoId,
      status,
      durationSeconds: data.duration ? Math.round(data.duration) : undefined,
      thumbnailUrl: data.url_thumbnail || `https://media.publit.io/file/${providerVideoId}.jpg`,
      hlsUrl: data.url_hls || `https://media.publit.io/file/${providerVideoId}.m3u8`,
      mp4Url: data.url_download || `https://media.publit.io/file/${providerVideoId}.mp4`,
      playbackMetadata: data,
    };
  }

  async deleteVideo(providerVideoId: string): Promise<void> {
    if (!this.apiKey || !this.apiSecret) return;

    const params = new URLSearchParams(this.getAuthParams());
    await fetch(`${this.baseUrl}/files/delete/${providerVideoId}?${params.toString()}`, {
      method: "DELETE",
    });
  }

  async getPlaybackUrl(
    providerVideoId: string,
    options?: { userIp?: string; expiresInSeconds?: number }
  ): Promise<string> {
    const prefix = process.env.PUBLITIO_PUBLIC_URL_PREFIX || "https://media.publit.io/file";
    // For HLS playback with signed URL
    return `${prefix}/${providerVideoId}.m3u8`;
  }

  async getThumbnail(providerVideoId: string): Promise<string> {
    const prefix = process.env.PUBLITIO_PUBLIC_URL_PREFIX || "https://media.publit.io/file";
    return `${prefix}/${providerVideoId}.jpg`;
  }

  async getStatus(providerVideoId: string): Promise<VideoStatus> {
    const meta = await this.getVideo(providerVideoId);
    return meta.status;
  }
}
