"use client";

import { buildYouTubeEmbedUrl } from "@/lib/live-class/youtube";

export type YouTubeLivePlayerProps = {
  youtubeVideoId: string | null;
  title: string;
  subject?: string | null;
  livePhase: string;
  isTeacher?: boolean;
  onRefresh?: () => void;
};

export function YouTubeLivePlayer({
  youtubeVideoId,
  title,
  subject,
  livePhase,
  isTeacher,
  onRefresh,
}: YouTubeLivePlayerProps) {
  if (!youtubeVideoId || livePhase === "SCHEDULED" || livePhase === "PREPARING") {
    return (
      <div className="w-full aspect-video bg-surface-container-lowest rounded-2xl border border-outline-variant/30 flex flex-col items-center justify-center p-8 text-center space-y-4 shadow-inner">
        <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center">
          <span className="material-symbols-outlined text-3xl animate-pulse">sensors</span>
        </div>
        <div className="max-w-md space-y-1.5">
          <h3 className="font-headline-md text-headline-md font-bold text-on-surface">
            {livePhase === "PREPARING" ? "Class is Preparing..." : "Class Scheduled"}
          </h3>
          <p className="text-xs text-on-surface-variant">
            {isTeacher
              ? "Enter or confirm the YouTube Unlisted Video ID / Stream Key in Broadcast Settings to go LIVE."
              : "The teacher is getting ready to broadcast. The video stream will start automatically once live."}
          </p>
        </div>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="px-4 py-2 rounded-xl bg-surface-container-high text-on-surface text-xs font-semibold hover:bg-surface-container-highest transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            Check Stream Status
          </button>
        )}
      </div>
    );
  }

  if (livePhase === "ENDED") {
    return (
      <div className="w-full aspect-video bg-surface-container-lowest rounded-2xl border border-outline-variant/30 flex flex-col items-center justify-center p-8 text-center space-y-3">
        <div className="w-14 h-14 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center">
          <span className="material-symbols-outlined text-2xl">check_circle</span>
        </div>
        <h3 className="font-headline-md text-headline-md font-bold text-on-surface">Class Completed</h3>
        <p className="text-xs text-on-surface-variant max-w-sm">
          This live class has ended. The recording/replay will be processed and available shortly.
        </p>
      </div>
    );
  }

  const embedUrl = buildYouTubeEmbedUrl(youtubeVideoId, { autoplay: true });

  return (
    <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black border border-outline-variant/40 shadow-2xl group">
      <iframe
        src={embedUrl}
        title={title}
        className="w-full h-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />

      <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none z-10">
        <span className="px-2.5 py-1 rounded-full bg-red-600 text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-lg animate-pulse">
          <span className="w-1.5 h-1.5 rounded-full bg-white" />
          LIVE
        </span>
        {subject && (
          <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white/90 text-[11px] font-semibold shadow">
            {subject}
          </span>
        )}
      </div>
    </div>
  );
}