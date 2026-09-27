import { redirect } from "next/navigation";

/** The old Classroom module is gone; its links (notifications, bookmarks) land in the live class. */
export default function ClassroomRedirectPage({ params }: { params: { scheduleId: string } }) {
  redirect(`/live-class/${encodeURIComponent(params.scheduleId)}`);
}
