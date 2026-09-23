import { BroadcastStage } from "@/components/live-class/BroadcastStage";

/**
 * Zero-chrome page meant to be added as an OBS "Browser Source" — captures
 * board + camera composited into one frame so the teacher never has to
 * manually window-capture and crop their own authoring UI. Authenticated by
 * a signed token in the URL (see src/lib/live-class/broadcast-token.ts), not
 * a session cookie, since OBS's Browser Source carries none.
 */
export default function ObsStagePage({
  params,
  searchParams,
}: {
  params: { scheduleId: string };
  searchParams: { token?: string };
}) {
  const token = searchParams.token || "";
  return <BroadcastStage scheduleId={params.scheduleId} token={token} />;
}
