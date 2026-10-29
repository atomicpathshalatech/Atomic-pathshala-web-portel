"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";
import { fitRate } from "@/lib/recorded-lectures/ai/format";

export type VoiceClip = { s: number; e: number; dur: number; url: string };

/** Clip playing at video time t: from its start until its (rate-fitted) audio ends. */
export function clipAt(clips: VoiceClip[], t: number): number {
  let lo = 0;
  let hi = clips.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (clips[mid]!.s <= t) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  if (found < 0) return -1;
  const c = clips[found]!;
  const slot = c.e - c.s;
  const playFor = c.dur / fitRate(c.dur, slot);
  return t < c.s + Math.max(slot, playFor) ? found : -1;
}

/**
 * Plays the AI voice track in step with the video: the video is muted, and
 * each clip starts at its sentence's time in the video, sped up or slowed a
 * little (0.9–1.35×) to fit its slot. Follows play, pause, seek and speed.
 * `clips` null = original audio. `videoSrc`: re-attach once the video exists.
 */
export function useAiVoice(videoRef: RefObject<HTMLVideoElement | null>, videoSrc: string | null, clips: VoiceClip[] | null, onClipError: () => void) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const nextRef = useRef<HTMLAudioElement | null>(null);
  const current = useRef(-1);
  const pendingOffset = useRef<number | null>(null);

  const sync = useCallback(() => {
    const v = videoRef.current;
    const a = audioRef.current;
    if (!v || !a || !clips) return;
    v.muted = true;
    const idx = clipAt(clips, v.currentTime);
    // Warm the cache for the clip after this one.
    const upcoming = clips[idx >= 0 ? idx + 1 : clips.findIndex((c) => c.s > v.currentTime)];
    if (upcoming && nextRef.current && nextRef.current.dataset.url !== upcoming.url) {
      nextRef.current.dataset.url = upcoming.url;
      nextRef.current.src = upcoming.url;
    }
    if (idx < 0) {
      if (!a.paused) a.pause();
      current.current = -1;
      return;
    }
    const c = clips[idx]!;
    const rate = fitRate(c.dur, c.e - c.s);
    const offset = (v.currentTime - c.s) * rate;
    if (offset >= c.dur - 0.05) {
      if (!a.paused) a.pause();
      return;
    }
    if (current.current !== idx) {
      current.current = idx;
      pendingOffset.current = offset;
      a.src = c.url;
    } else if (pendingOffset.current === null && Math.abs(a.currentTime - offset) > 0.6) {
      a.currentTime = offset;
    }
    a.playbackRate = Math.min(4, rate * (v.playbackRate || 1));
    a.volume = v.volume;
    // Paused, seeking or buffering: the voice waits with the picture.
    if (v.paused || v.seeking || v.readyState < 3) {
      if (!a.paused) a.pause();
    } else if (a.paused && pendingOffset.current === null) {
      void a.play().catch(() => null);
    }
  }, [videoRef, clips]);

  useEffect(() => {
    const a = new Audio();
    a.preload = "auto";
    const n = new Audio();
    n.preload = "auto";
    n.muted = true;
    audioRef.current = a;
    nextRef.current = n;
    const onMeta = () => {
      if (pendingOffset.current !== null) {
        a.currentTime = pendingOffset.current;
        pendingOffset.current = null;
      }
      sync();
    };
    const onErr = () => {
      pendingOffset.current = null;
      current.current = -1;
      onClipError();
    };
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("error", onErr);
    return () => {
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("error", onErr);
      a.pause();
      a.removeAttribute("src");
      n.removeAttribute("src");
    };
  }, [sync, onClipError]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (!clips) {
      audioRef.current?.pause();
      current.current = -1;
      v.muted = false;
      return;
    }
    const events = ["timeupdate", "play", "pause", "seeking", "seeked", "ratechange", "volumechange", "waiting", "playing"] as const;
    events.forEach((e) => v.addEventListener(e, sync));
    // timeupdate fires ~4×/s; a faster tick while playing keeps clip starts tight.
    const tick = setInterval(() => {
      if (!v.paused) sync();
    }, 150);
    sync();
    return () => {
      events.forEach((e) => v.removeEventListener(e, sync));
      clearInterval(tick);
    };
  }, [videoRef, videoSrc, clips, sync]);
}
