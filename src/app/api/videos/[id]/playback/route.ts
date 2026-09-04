import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { getVideoProvider } from "@/lib/video";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return apiError("Authentication required for video playback.", 401);
    }

    const videoAsset = await prisma.videoAsset.findUnique({
      where: { id: params.id },
    });

    if (!videoAsset) {
      return apiError("Video asset not found.", 404);
    }

    if (videoAsset.provider === "youtube") {
      return apiSuccess({
        provider: "youtube",
        videoId: videoAsset.providerVideoId,
        embedUrl: `https://www.youtube-nocookie.com/embed/${videoAsset.providerVideoId}`,
      });
    }

    const provider = getVideoProvider();
    const playbackUrl = await provider.getPlaybackUrl(videoAsset.providerVideoId, {
      expiresInSeconds: 3600, // 1 hour token
    });

    return apiSuccess({
      provider: videoAsset.provider,
      providerVideoId: videoAsset.providerVideoId,
      playbackUrl,
      thumbnailUrl: videoAsset.thumbnailUrl,
      durationSeconds: videoAsset.durationSeconds,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
