import "server-only";
import { VideoProvider } from "./types";
import { PublitioVideoProvider } from "./publitio";

export * from "./types";
export * from "./publitio";

let cachedProvider: VideoProvider | null = null;

export function getVideoProvider(): VideoProvider {
  if (cachedProvider) return cachedProvider;

  const providerName = (process.env.VIDEO_PROVIDER || "publitio").toLowerCase();

  switch (providerName) {
    case "publitio":
    default:
      cachedProvider = new PublitioVideoProvider();
      break;
  }

  return cachedProvider;
}
