import { redirect } from "next/navigation";

export default async function ScheduleRedirectPage({
  params,
}: {
  params: { scheduleId: string } | Promise<{ scheduleId: string }>;
}) {
  const resolved = await Promise.resolve(params);
  const scheduleId = resolved?.scheduleId;
  if (!scheduleId) {
    redirect("/schedule");
  }
  redirect(`/live-class/${scheduleId}`);
}
