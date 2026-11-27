import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseAiJson } from "@/lib/ai/latex-json";
import { YoutubeChannelKey } from "@/lib/youtube/channels";
import { studioProviderRouter } from "../router";
import { ChannelVideoMetric, fetchChannelAnalyticsData } from "./youtube-analytics";

export async function generateChannelAnalyticsReport(params: {
  channelKey: YoutubeChannelKey;
  userId: string;
  roleName?: string;
}) {
  const fetched = await fetchChannelAnalyticsData(params.channelKey);
  const sortedByViews = [...fetched.videos].sort((a, b) => b.views - a.views);
  const topVideos = sortedByViews.slice(0, 8);
  const lowVideos = [...sortedByViews].reverse().slice(0, 6);
  const recentVideos = [...fetched.videos].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  ).slice(0, 8);

  const byFormat = {
    LONG: fetched.videos.filter((v) => v.format === "LONG"),
    SHORTS: fetched.videos.filter((v) => v.format === "SHORTS"),
    LIVE: fetched.videos.filter((v) => v.format === "LIVE"),
  };

  let aiInsights: Record<string, unknown> | null = null;

  if (fetched.videos.length > 0) {
    const prompt = [
      `Analyze Atomic Pathshala's actual ${params.channelKey} YouTube channel performance.`,
      `Available Metrics: ${JSON.stringify(fetched.channelMetrics)}`,
      `Data Limitations: ${JSON.stringify(fetched.dataSourcesAvailable.limitations)}`,
      `Top Videos: ${JSON.stringify(topVideos.map((v) => ({ title: v.title, views: v.views, dur: v.durationSec, format: v.format, likes: v.likes, publishedAt: v.publishedAt })))}`,
      `Low-Performing Videos: ${JSON.stringify(lowVideos.map((v) => ({ title: v.title, views: v.views, dur: v.durationSec, format: v.format })))}`,
      "",
      "STRICT HONESTY RULES:",
      "1. Base conclusions ONLY on the provided videos and metrics. Never invent missing metrics.",
      "2. Clearly note small sample size or missing Analytics API data where applicable.",
      "3. Do NOT claim correlation is causation or guarantee future performance.",
      "",
      "Return JSON with keys:",
      "{",
      '  "answers": { "bestTopics": string, "poorTopics": string, "successfulTitleStyles": string, "successfulThumbnailStyles": string, "bestDurations": string, "betterFormats": string, "subscriberDrivers": string, "watchTimeLeaders": string, "videosToImprove": string, "repeatableOpportunities": string },',
      '  "recommendations": Array<{ "type": "TOPIC"|"FORMAT"|"TITLE_STYLE"|"THUMBNAIL"|"DURATION"|"TIMING"|"SERIES", "recommendation": string, "evidence": string }>,',
      '  "dataLimitations": string[]',
      "}",
    ].join("\n");

    const aiRes = await studioProviderRouter.generateText({
      prompt,
      systemPrompt: "You are a cautious, evidence-based YouTube Data Analyst. Output strict valid JSON.",
      taskType: "RESEARCH",
      responseFormat: "json",
      feature: "ANALYTICS_INTELLIGENCE",
      userId: params.userId,
      roleName: params.roleName,
    });

    aiInsights = (parseAiJson(aiRes.text) as Record<string, unknown> | null) || null;
  } else {
    aiInsights = {
      answers: {},
      recommendations: [],
      dataLimitations: fetched.dataSourcesAvailable.limitations,
    };
  }

  const report = await prisma.channelAnalyticsReport.create({
    data: {
      channelKey: params.channelKey,
      dataSourcesAvailable: fetched.dataSourcesAvailable as unknown as Prisma.InputJsonValue,
      channelMetrics: fetched.channelMetrics as unknown as Prisma.InputJsonValue,
      videoSnapshots: {
        totalSampled: fetched.videos.length,
        topVideos,
        lowVideos,
        recentVideos,
        formatCounts: {
          LONG: byFormat.LONG.length,
          SHORTS: byFormat.SHORTS.length,
          LIVE: byFormat.LIVE.length,
        },
        allVideos: fetched.videos,
      } as unknown as Prisma.InputJsonValue,
      aiInsights: aiInsights as Prisma.InputJsonValue,
      createdById: params.userId,
    },
  });

  return report;
}

export async function generateVideoReview(params: {
  channelKey: YoutubeChannelKey;
  video: ChannelVideoMetric;
  userId: string;
  roleName?: string;
}) {
  const prompt = [
    `Review this Atomic Pathshala YouTube video using ONLY its observed metrics:`,
    JSON.stringify(params.video),
    "",
    "Return JSON: { performanceAnalysis: string, packagingAnalysis: string, topicAnalysis: string, improvements: string[], nextVideoRecommendation: string }",
  ].join("\n");

  const aiRes = await studioProviderRouter.generateText({
    prompt,
    systemPrompt: "You are an EdTech YouTube Content Reviewer. Output strict valid JSON.",
    taskType: "RESEARCH",
    responseFormat: "json",
    feature: "VIDEO_REVIEW",
    userId: params.userId,
    roleName: params.roleName,
  });

  const parsed = (parseAiJson(aiRes.text) as Record<string, unknown> | null) || {};

  const review = await prisma.videoReviewReport.create({
    data: {
      videoId: params.video.videoId,
      channelKey: params.channelKey,
      videoTitle: params.video.title,
      metricsSnapshot: params.video as unknown as Prisma.InputJsonValue,
      performanceAnalysis: String(parsed.performanceAnalysis || "Insufficient data"),
      packagingAnalysis: String(parsed.packagingAnalysis || ""),
      topicAnalysis: String(parsed.topicAnalysis || ""),
      improvements: (Array.isArray(parsed.improvements) ? parsed.improvements : []) as Prisma.InputJsonValue,
      nextVideoRecommendation: String(parsed.nextVideoRecommendation || ""),
      createdById: params.userId,
    },
  });

  return review;
}
