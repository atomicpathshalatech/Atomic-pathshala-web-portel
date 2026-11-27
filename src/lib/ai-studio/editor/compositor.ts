import { EditorClip } from "./types";

/**
 * Draws a single timeline frame at `timeMs` onto a 2D canvas using loaded
 * image/video elements and text/caption overlays.
 */
export function renderTimelineFrame(params: {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  timeMs: number;
  clips: EditorClip[];
  imageCache: Map<string, HTMLImageElement>;
  videoCache: Map<string, HTMLVideoElement>;
  onAssetLoaded?: () => void;
}) {
  const { ctx, width, height, timeMs, clips, imageCache, videoCache, onAssetLoaded } = params;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#0B0E14";
  ctx.fillRect(0, 0, width, height);

  const activeAtTime = clips.filter(
    (c) => timeMs >= c.startMs && timeMs <= c.startMs + c.durationMs
  );

  // 1. Visual tracks (VIDEO_1, VIDEO_2, IMAGE)
  const visualOrder = ["VIDEO_1", "VIDEO_2", "IMAGE"];
  for (const trackId of visualOrder) {
    const trackClips = activeAtTime.filter((c) => c.trackId === trackId);
    for (const clip of trackClips) {
      if (!clip.mediaUrl) continue;

      let alpha = 1;
      if (clip.transition === "fade") {
        const elapsed = timeMs - clip.startMs;
        const remaining = clip.startMs + clip.durationMs - timeMs;
        if (elapsed < 400) alpha = Math.max(0, elapsed / 400);
        else if (remaining < 400) alpha = Math.max(0, remaining / 400);
      }

      ctx.save();
      ctx.globalAlpha = alpha;

      if (trackId === "IMAGE") {
        let img = imageCache.get(clip.mediaUrl);
        if (!img) {
          img = new window.Image();
          img.crossOrigin = "anonymous";
          img.onload = () => onAssetLoaded?.();
          img.src = clip.mediaUrl;
          imageCache.set(clip.mediaUrl, img);
        }
        if (img.complete && img.naturalWidth > 0) {
          const dx = clip.x ?? 0;
          const dy = clip.y ?? 0;
          const dw = clip.width ?? width;
          const dh = clip.height ?? height;
          ctx.drawImage(img, dx, dy, dw, dh);
        }
      } else {
        let vid = videoCache.get(clip.mediaUrl);
        if (!vid) {
          vid = document.createElement("video");
          vid.crossOrigin = "anonymous";
          vid.muted = true;
          vid.playsInline = true;
          vid.src = clip.mediaUrl;
          videoCache.set(clip.mediaUrl, vid);
        }
        const targetSec = ((timeMs - clip.startMs) + clip.trimStartMs) / 1000;
        if (Math.abs(vid.currentTime - targetSec) > 0.25 && vid.readyState >= 2) {
          vid.currentTime = targetSec;
        }
        if (vid.readyState >= 2) {
          ctx.drawImage(vid, clip.x ?? 0, clip.y ?? 0, clip.width ?? width, clip.height ?? height);
        }
      }
      ctx.restore();
    }
  }

  // 2. Text & Caption overlays
  const overlayOrder = ["TEXT", "CAPTION"];
  for (const trackId of overlayOrder) {
    const overlayClips = activeAtTime.filter((c) => c.trackId === trackId);
    for (const clip of overlayClips) {
      if (!clip.text) continue;
      const fontSize = clip.fontSize || (trackId === "CAPTION" ? Math.round(height * 0.045) : Math.round(height * 0.065));
      ctx.save();
      ctx.font = `700 ${fontSize}px ${clip.fontFamily || "Inter, sans-serif"}`;
      ctx.textAlign = clip.align || "center";
      ctx.textBaseline = "middle";

      const tx = clip.x ?? (clip.align === "left" ? 60 : clip.align === "right" ? width - 60 : width / 2);
      const ty = clip.y ?? (trackId === "CAPTION" ? height * 0.86 : height * 0.2);

      if (trackId === "CAPTION") {
        const metrics = ctx.measureText(clip.text);
        const padX = 20;
        const padY = 10;
        ctx.fillStyle = clip.bgColor || "rgba(0, 0, 0, 0.72)";
        ctx.fillRect(
          tx - metrics.width / 2 - padX,
          ty - fontSize / 2 - padY,
          metrics.width + padX * 2,
          fontSize + padY * 2
        );
      }

      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(0,0,0,0.85)";
      ctx.strokeText(clip.text, tx, ty);
      ctx.fillStyle = clip.color || "#FFFFFF";
      ctx.fillText(clip.text, tx, ty);
      ctx.restore();
    }
  }
}

/**
 * Renders the multi-track timeline to a downloadable WebM/MP4 Blob using
 * Canvas captureStream + Web Audio MediaStreamDestination + MediaRecorder.
 */
export async function exportTimelineVideo(params: {
  width: number;
  height: number;
  fps: number;
  durationMs: number;
  clips: EditorClip[];
  onProgress: (pct: number) => void;
}): Promise<{ blob: Blob; mimeType: string }> {
  const { width, height, fps, durationMs, clips, onProgress } = params;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  const imageCache = new Map<string, HTMLImageElement>();
  const videoCache = new Map<string, HTMLVideoElement>();

  const audioCtx = new AudioContext();
  const dest = audioCtx.createMediaStreamDestination();

  // Schedule audio clips (VOICE, MUSIC, SFX)
  const audioClips = clips.filter(
    (c) => (c.trackId === "VOICE" || c.trackId === "MUSIC" || c.trackId === "SFX") && c.mediaUrl
  );
  const voiceClips = audioClips.filter((c) => c.trackId === "VOICE");

  for (const clip of audioClips) {
    try {
      const res = await fetch(clip.mediaUrl!);
      if (!res.ok) continue;
      const arr = await res.arrayBuffer();
      const buf = await audioCtx.decodeAudioData(arr);
      const src = audioCtx.createBufferSource();
      src.buffer = buf;

      const gain = audioCtx.createGain();
      const startSec = clip.startMs / 1000;
      const durSec = clip.durationMs / 1000;
      const offsetSec = clip.trimStartMs / 1000;

      let targetVol = clip.volume ?? 1;
      if (clip.trackId === "MUSIC" && clip.duckUnderVoice && voiceClips.length > 0) {
        targetVol = Math.min(targetVol, 0.25);
      }

      gain.gain.setValueAtTime(targetVol, startSec);
      if (clip.fadeInMs > 0) {
        gain.gain.setValueAtTime(0.001, startSec);
        gain.gain.linearRampToValueAtTime(targetVol, startSec + clip.fadeInMs / 1000);
      }
      if (clip.fadeOutMs > 0 && durSec > clip.fadeOutMs / 1000) {
        gain.gain.setValueAtTime(targetVol, startSec + durSec - clip.fadeOutMs / 1000);
        gain.gain.linearRampToValueAtTime(0.001, startSec + durSec);
      }

      src.connect(gain);
      gain.connect(dest);
      src.start(startSec, offsetSec, durSec);
    } catch {
      // Skip unreadable audio clip without crashing render
    }
  }

  const videoStream = canvas.captureStream(fps);
  const combinedStream = new MediaStream([
    ...videoStream.getVideoTracks(),
    ...dest.stream.getAudioTracks(),
  ]);

  const mimeType = MediaRecorder.isTypeSupported("video/mp4")
    ? "video/mp4"
    : MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : "video/webm";

  const recorder = new MediaRecorder(combinedStream, { mimeType });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  return new Promise<{ blob: Blob; mimeType: string }>((resolve, reject) => {
    recorder.onerror = (ev) => reject(new Error(String(ev)));
    recorder.onstop = async () => {
      await audioCtx.close();
      resolve({ blob: new Blob(chunks, { type: mimeType }), mimeType });
    };

    recorder.start(250);
    const startWall = performance.now();

    const step = () => {
      const elapsed = performance.now() - startWall;
      if (elapsed >= durationMs) {
        onProgress(100);
        recorder.stop();
        return;
      }
      renderTimelineFrame({
        ctx,
        width,
        height,
        timeMs: elapsed,
        clips,
        imageCache,
        videoCache,
      });
      onProgress(Math.min(99, Math.round((elapsed / durationMs) * 100)));
      requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  });
}
