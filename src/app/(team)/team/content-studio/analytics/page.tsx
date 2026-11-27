"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  RefreshCw,
  AlertTriangle,
  Sparkles,
  ExternalLink,
  History,
} from "lucide-react";

interface VideoMetric {
  videoId: string;
  title: string;
  publishedAt: string;
  durationSec: number;
  format: "SHORTS" | "LONG" | "LIVE";
  views: number;
  likes: number | null;
  comments: number | null;
  thumbnailUrl: string | null;
  url: string;
}

interface ReportRow {
  id: string;
  channelKey: string;
  dataSourcesAvailable: {
    dataApi: boolean;
    analyticsApi: boolean;
    limitations: string[];
  };
  channelMetrics: {
    channelTitle: string | null;
    subscriberCount: number | null;
    totalViews: number | null;
    videoCount: number | null;
    recent28dViews: number | null;
    estimatedMinutesWatched: number | null;
    averageViewDurationSec: number | null;
    averageViewPercentage: number | null;
    subscribersGained28d: number | null;
    impressions: number | null;
    ctrPercent: number | null;
    returningViewers: number | null;
    trafficSources: Array<{ source: string; views: number }>;
  };
  videoSnapshots: {
    totalSampled: number;
    topVideos: VideoMetric[];
    lowVideos: VideoMetric[];
    recentVideos: VideoMetric[];
    formatCounts: { LONG: number; SHORTS: number; LIVE: number };
  };
  aiInsights: {
    answers?: Record<string, string>;
    recommendations?: Array<{ type: string; recommendation: string; evidence: string }>;
    dataLimitations?: string[];
  } | null;
  createdAt: string;
}

interface VideoReviewRow {
  id: string;
  videoTitle: string;
  performanceAnalysis: string;
  packagingAnalysis: string;
  topicAnalysis: string;
  improvements: string[];
  nextVideoRecommendation: string;
  createdAt: string;
}

export default function YouTubeAnalyticsAiPage() {
  const [channelKey, setChannelKey] = useState<"MAIN" | "APP">("MAIN");
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [reviews, setReviews] = useState<VideoReviewRow[]>([]);
  const [channelStatus, setChannelStatus] = useState<{ MAIN: boolean; APP: boolean }>({ MAIN: false, APP: false });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/team/content-studio/analytics?channelKey=${channelKey}`);
      const json = await res.json();
      if (json.success) {
        setReports(json.data.reports || []);
        setReviews(json.data.reviews || []);
        setChannelStatus(json.data.channelStatus || { MAIN: false, APP: false });
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelKey]);

  const handleSync = async () => {
    setSyncing(true);
    setErr(null);
    try {
      const res = await fetch("/api/team/content-studio/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SYNC_CHANNEL", channelKey }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Sync failed");
      await loadData();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleReviewVideo = async (video: VideoMetric) => {
    setReviewingId(video.videoId);
    setErr(null);
    try {
      const res = await fetch("/api/team/content-studio/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REVIEW_VIDEO", channelKey, video }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Video review failed");
      await loadData();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Video review failed");
    } finally {
      setReviewingId(null);
    }
  };

  const latest = reports[0];

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/team/content-studio" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Content Studio
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-on-surface flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" /> YouTube Analytics Intelligence
          </h1>
          <p className="text-sm text-on-surface-variant">
            Authorized channel metrics, honest data-source separation, and AI-assisted content recommendations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select value={channelKey} onChange={(e) => setChannelKey(e.target.value as "MAIN" | "APP")} className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-xs font-semibold">
            <option value="MAIN">MAIN Channel {channelStatus.MAIN ? "✓" : "(Not Configured)"}</option>
            <option value="APP">APP Channel {channelStatus.APP ? "✓" : "(Not Configured)"}</option>
          </select>
          <button onClick={handleSync} disabled={syncing} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-on-primary disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} /> {syncing ? "Syncing & Analyzing..." : "Sync Channel & Generate Report"}
          </button>
        </div>
      </div>

      {err && <div className="rounded-lg bg-error-container px-4 py-2 text-sm text-on-error-container">{err}</div>}

      {loading && !latest ? (
        <div className="p-8 text-center text-sm text-on-surface-variant">Loading analytics reports...</div>
      ) : !latest ? (
        <div className="rounded-xl border border-outline-variant/60 bg-surface p-8 text-center text-sm text-on-surface-variant">
          No analytics report generated for <strong>{channelKey}</strong> yet. Click &ldquo;Sync Channel & Generate Report&rdquo; above.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Data Source & Limitations Banner */}
          <div className="rounded-xl border border-outline-variant/60 bg-surface-container-low p-4 text-xs space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 font-semibold ${latest.dataSourcesAvailable.dataApi ? "bg-tertiary-fixed text-on-tertiary-fixed" : "bg-error-container text-on-error-container"}`}>
                Data API v3: {latest.dataSourcesAvailable.dataApi ? "Authorized" : "Unavailable"}
              </span>
              <span className={`rounded-full px-2.5 py-0.5 font-semibold ${latest.dataSourcesAvailable.analyticsApi ? "bg-tertiary-fixed text-on-tertiary-fixed" : "bg-surface-container-high text-on-surface-variant"}`}>
                Analytics API v2: {latest.dataSourcesAvailable.analyticsApi ? "Authorized" : "Unavailable"}
              </span>
              <span className="ml-auto text-on-surface-variant">
                Synced: {new Date(latest.createdAt).toLocaleString()}
              </span>
            </div>
            {latest.dataSourcesAvailable.limitations.length > 0 && (
              <div className="flex items-start gap-2 text-on-surface-variant pt-1">
                <AlertTriangle className="h-4 w-4 text-secondary shrink-0 mt-0.5" />
                <ul className="list-disc pl-4 space-y-0.5">
                  {latest.dataSourcesAvailable.limitations.map((lim, i) => (
                    <li key={i}>{lim}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Channel KPIs (never fabricated — shows — when null) */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {[
              { label: "Subscribers", val: latest.channelMetrics.subscriberCount?.toLocaleString() ?? "—", tag: "Data API" },
              { label: "Total Views", val: latest.channelMetrics.totalViews?.toLocaleString() ?? "—", tag: "Data API" },
              { label: "28d Views", val: latest.channelMetrics.recent28dViews?.toLocaleString() ?? "—", tag: "Analytics API" },
              { label: "Watch Time (min)", val: latest.channelMetrics.estimatedMinutesWatched?.toLocaleString() ?? "—", tag: "Analytics API" },
              { label: "Avg View %", val: latest.channelMetrics.averageViewPercentage !== null ? `${latest.channelMetrics.averageViewPercentage}%` : "—", tag: "Analytics API" },
              { label: "CTR / Impressions", val: latest.channelMetrics.ctrPercent !== null ? `${latest.channelMetrics.ctrPercent}%` : "—", tag: "Unavailable" },
            ].map((k) => (
              <div key={k.label} className="rounded-xl border border-outline-variant/60 bg-surface p-3.5 shadow-sm">
                <div className="text-[11px] text-on-surface-variant">{k.label}</div>
                <div className="mt-1 text-lg font-bold text-on-surface">{k.val}</div>
                <div className="mt-0.5 text-[10px] text-primary">{k.tag}</div>
              </div>
            ))}
          </div>

          {/* AI Insights & Recommendations */}
          {latest.aiInsights && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-outline-variant/60 bg-surface p-4 shadow-sm space-y-2.5 text-xs">
                <div className="font-bold text-sm text-on-surface flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-primary" /> AI Channel Intelligence (AI Estimate)
                </div>
                {Object.entries(latest.aiInsights.answers || {}).map(([q, a]) => (
                  <div key={q} className="border-b border-outline-variant/30 pb-2">
                    <div className="font-semibold text-primary capitalize">{q.replace(/([A-Z])/g, " $1")}</div>
                    <div className="text-on-surface-variant mt-0.5">{a}</div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-outline-variant/60 bg-surface p-4 shadow-sm space-y-2.5 text-xs">
                <div className="font-bold text-sm text-on-surface">Evidence-Based Recommendations</div>
                {(latest.aiInsights.recommendations || []).map((rec, i) => (
                  <div key={i} className="rounded-lg bg-surface-container-low p-3 space-y-1">
                    <span className="rounded bg-primary-fixed px-1.5 py-0.5 text-[10px] font-bold text-on-primary-fixed">{rec.type}</span>
                    <div className="font-semibold text-on-surface">{rec.recommendation}</div>
                    <div className="text-on-surface-variant">Evidence: {rec.evidence}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Videos + Single Video Review */}
          <div className="rounded-xl border border-outline-variant/60 bg-surface shadow-sm overflow-hidden">
            <div className="border-b border-outline-variant/50 px-4 py-3 text-sm font-semibold">
              Top Channel Videos ({latest.videoSnapshots.topVideos?.length || 0}) — Click &ldquo;AI Review&rdquo; for Deep Dive
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-container uppercase text-on-surface-variant">
                  <tr>
                    <th className="px-4 py-2.5">Title</th>
                    <th className="px-4 py-2.5">Format</th>
                    <th className="px-4 py-2.5">Views</th>
                    <th className="px-4 py-2.5">Likes</th>
                    <th className="px-4 py-2.5">Duration</th>
                    <th className="px-4 py-2.5">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/40">
                  {(latest.videoSnapshots.topVideos || []).map((v) => (
                    <tr key={v.videoId}>
                      <td className="px-4 py-2.5 font-medium max-w-xs truncate">
                        <a href={v.url} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                          {v.title} <ExternalLink className="h-3 w-3" />
                        </a>
                      </td>
                      <td className="px-4 py-2.5">{v.format}</td>
                      <td className="px-4 py-2.5">{v.views.toLocaleString()}</td>
                      <td className="px-4 py-2.5">{v.likes?.toLocaleString() ?? "—"}</td>
                      <td className="px-4 py-2.5">{v.durationSec}s</td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => handleReviewVideo(v)}
                          disabled={reviewingId === v.videoId}
                          className="rounded bg-primary-fixed px-2.5 py-1 font-semibold text-on-primary-fixed"
                        >
                          {reviewingId === v.videoId ? "Reviewing..." : "AI Review"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Saved Video Reviews & Historical Learning */}
          {reviews.length > 0 && (
            <div className="rounded-xl border border-outline-variant/60 bg-surface p-4 shadow-sm space-y-3 text-xs">
              <div className="font-bold text-sm flex items-center gap-1.5">
                <History className="h-4 w-4 text-secondary" /> Saved Video Reviews & Historical Recommendations
              </div>
              {reviews.map((r) => (
                <div key={r.id} className="rounded-lg border border-outline-variant/50 bg-surface-container-low p-3 space-y-1">
                  <div className="font-bold text-on-surface">{r.videoTitle}</div>
                  <p><strong>Performance:</strong> {r.performanceAnalysis}</p>
                  <p><strong>Packaging:</strong> {r.packagingAnalysis}</p>
                  <p><strong>Next Video Recommendation:</strong> {r.nextVideoRecommendation}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
