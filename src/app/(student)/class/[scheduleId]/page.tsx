import { redirect } from "next/navigation";

export default async function ClassRedirectPage({
  params,
}: {
  params: { scheduleId: string } | Promise<{ scheduleId: string }>;
}) {
  const resolved = await Promise.resolve(params);
  const scheduleId = resolved?.scheduleId;
  if (!scheduleId) {
    redirect("/live-class");
  }
  redirect(`/live-class/${scheduleId}`);
}
