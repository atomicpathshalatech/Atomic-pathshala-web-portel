import { redirect } from "next/navigation";

/** The old Classroom module is gone; its links land in the teacher's live-class room. */
export default function TeacherClassroomRedirectPage({ params }: { params: { scheduleId: string } }) {
  redirect(`/team/live-class/${encodeURIComponent(params.scheduleId)}`);
}
