import "server-only";
import { OpportunityType, Prisma, ResearchCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseAiJson } from "@/lib/ai/latex-json";
import { studioProviderRouter } from "../router";
import {
  FetchedSourceItem,
  fetchEducationNewsRss,
  fetchGoogleTrendsIndia,
  searchYouTubeTrends,
} from "./sources";

const CATEGORY_QUERIES: Record<ResearchCategory, { yt: string; news: string }> = {
  NEET: { yt: "NEET 2026 chemistry physics biology NCERT PYQ", news: "NEET UG NTA NCERT syllabus 2026" },
  JEE: { yt: "JEE Main Advanced physics chemistry maths PYQ", news: "JEE Main NTA 2026 update" },
  BOARDS: { yt: "Class 12 10 CBSE board exam NCERT revision", news: "CBSE board exam Class 12 10 NCERT update" },
  MOTIVATIONAL: { yt: "NEET JEE student motivation discipline study routine", news: "NEET JEE student exam stress study motivation" },
  EDUCATIONAL_NEWS: { yt: "NTA NEET JEE NCERT official update syllabus", news: "NTA official NEET JEE NCERT syllabus announcement" },
};

interface SynthesizedOpportunity {
  topic: string;
  opportunityType: OpportunityType;
  recommendedFormat: "LONG_VIDEO" | "SHORTS" | "REEL" | "LIVE_SESSION" | "LECTURE";
  scoreBreakdown: {
    topicDemand: number;
    recency: number;
    audienceRelevance: number;
    competitorActivity: number;
    performanceSignals: number;
    contentGap: number;
    competitionLevel: number;
    historicalPerformance: number;
    languageOpportunity: number;
    formatOpportunity: number;
  };
  whyThisTopic: string;
  researchSummary: string;
  suggestedAngle: string;
  suggestedTitles: string[];
  audienceFit: string;
  publishingTiming: string;
  sourceIndices: number[];
}

export async function runOpportunityResearch(params: {
  category: ResearchCategory;
  language?: string;
  userId: string;
  roleName?: string;
}) {
  const queries = CATEGORY_QUERIES[params.category];
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const [ytTrends, newsItems, googleTrends, competitorVideos, ownStats] = await Promise.all([
    searchYouTubeTrends(queries.yt, 8),
    fetchEducationNewsRss(queries.news),
    params.category === "EDUCATIONAL_NEWS" ? fetchGoogleTrendsIndia() : Promise.resolve([]),
    prisma.competitorVideo.findMany({
      where: { category: params.category, publishedAt: { gte: cutoff } },
      include: { competitorChannel: { select: { name: true, language: true } } },
      orderBy: [{ viewVelocity: "desc" }, { publishedAt: "desc" }],
      take: 15,
    }),
    prisma.youtubeVideoStat.findMany({
      orderBy: { fetchedAt: "desc" },
      take: 10,
      select: { videoId: true, viewCount: true, title: true },
    }),
  ]);

  const sourcePool: Array<FetchedSourceItem & { channelName?: string }> = [
    ...ytTrends,
    ...newsItems,
    ...googleTrends,
    ...competitorVideos.map((v) => ({
      title: v.title,
      url: v.url,
      publishedAt: v.publishedAt.toISOString(),
      sourceType: "YOUTUBE_RSS" as const,
      channelName: v.competitorChannel.name,
      videoId: v.videoId,
      views: v.views,
      likes: v.likes,
      comments: v.comments,
      durationSec: v.durationSec,
    })),
  ];

  if (sourcePool.length === 0) {
    return {
      opportunities: [],
      sourceCount: 0,
      message: "No external RSS/YouTube sources returned data. Add competitor channels or check network/YouTube API config.",
    };
  }

  const numberedSources = sourcePool.slice(0, 30).map((s, idx) => ({
    index: idx,
    title: s.title,
    url: s.url,
    publishedAt: s.publishedAt,
    sourceType: s.sourceType,
    channelName: s.channelName ?? null,
    views: s.views ?? null,
  }));

  const prompt = [
    `Analyze ONLY the following real fetched sources for Atomic Pathshala (Indian NEET/JEE/Boards EdTech platform) in category "${params.category}" (language preference: "${params.language || "hi/en"}").`,
    `Platform historical YouTube sample count: ${ownStats.length} recent videos.`,
    "",
    "REAL FETCHED SOURCES (JSON):",
    JSON.stringify(numberedSources),
    "",
    "Return a JSON object with key `opportunities` containing 3 to 5 high-signal content opportunities.",
    "STRICT RULES:",
    "1. Every opportunity MUST reference real source indices from `sourceIndices` above. Never invent URLs, views, or dates.",
    "2. Each scoreBreakdown factor must be an integer 1..10.",
    "3. opportunityType must be one of: TRENDING_TOPIC, BREAKING_UPDATE, CONTENT_GAP, COMPETITOR_BREAKOUT, SEARCH_OPPORTUNITY, EVERGREEN_OPPORTUNITY, SEASONAL_OPPORTUNITY, SHORTS_OPPORTUNITY.",
    "4. recommendedFormat must be one of: LONG_VIDEO, SHORTS, REEL, LIVE_SESSION, LECTURE.",
    "5. Schema per item: { topic, opportunityType, recommendedFormat, scoreBreakdown: { topicDemand, recency, audienceRelevance, competitorActivity, performanceSignals, contentGap, competitionLevel, historicalPerformance, languageOpportunity, formatOpportunity }, whyThisTopic, researchSummary, suggestedAngle, suggestedTitles: string[], audienceFit, publishingTiming, sourceIndices: number[] }",
  ].join("\n");

  const aiRes = await studioProviderRouter.generateText({
    prompt,
    systemPrompt:
      "You are an EdTech Content Strategist. Synthesize only from provided sources. Output strict valid JSON.",
    taskType: "RESEARCH",
    responseFormat: "json",
    feature: "RESEARCH_OPPORTUNITIES",
    userId: params.userId,
    roleName: params.roleName,
  });

  const parsed = parseAiJson(aiRes.text) as { opportunities?: SynthesizedOpportunity[] } | null;
  const items = Array.isArray(parsed?.opportunities) ? parsed!.opportunities : [];

  const created = [];
  for (const item of items.slice(0, 6)) {
    const sb = item.scoreBreakdown || {
      topicDemand: 6,
      recency: 6,
      audienceRelevance: 7,
      competitorActivity: 5,
      performanceSignals: 5,
      contentGap: 6,
      competitionLevel: 5,
      historicalPerformance: 5,
      languageOpportunity: 6,
      formatOpportunity: 6,
    };
    const vals = Object.values(sb).map((n) => Math.max(0, Math.min(10, Number(n) || 0)));
    const compositeScore = Number(
      ((vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length)) * 10).toFixed(1)
    );

    const matchedSources = (item.sourceIndices || [])
      .map((idx) => numberedSources[idx])
      .filter((s): s is (typeof numberedSources)[number] => Boolean(s));

    const finalSources = matchedSources.length > 0 ? matchedSources : numberedSources.slice(0, 2);

    const competitorRefs = finalSources
      .filter((s) => s.sourceType === "YOUTUBE_RSS" || s.sourceType === "YOUTUBE_API")
      .map((s) => ({
        title: s.title,
        channelName: s.channelName,
        url: s.url,
        views: s.views,
        publishedAt: s.publishedAt,
      }));

    const opp = await prisma.contentOpportunity.create({
      data: {
        topic: item.topic,
        category: params.category,
        opportunityType: item.opportunityType || "TRENDING_TOPIC",
        recommendedFormat: item.recommendedFormat || "LONG_VIDEO",
        opportunityScore: compositeScore,
        scoreBreakdown: sb as unknown as Prisma.InputJsonValue,
        whyThisTopic: item.whyThisTopic,
        researchSummary: item.researchSummary,
        suggestedAngle: item.suggestedAngle ?? null,
        suggestedTitles: (item.suggestedTitles ?? []) as Prisma.InputJsonValue,
        audienceFit: item.audienceFit ?? null,
        publishingTiming: item.publishingTiming ?? null,
        sources: finalSources as unknown as Prisma.InputJsonValue,
        competitorRefs: competitorRefs as unknown as Prisma.InputJsonValue,
        researchedAt: new Date(),
        createdById: params.userId,
      },
    });
    created.push(opp);
  }

  return {
    opportunities: created,
    sourceCount: sourcePool.length,
    providerUsed: aiRes.provider,
    modelUsed: aiRes.model,
  };
}
