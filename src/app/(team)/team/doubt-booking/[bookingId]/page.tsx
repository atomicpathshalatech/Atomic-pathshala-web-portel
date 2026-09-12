import type { Metadata } from "next";
import { requireTeamSession } from "@/lib/auth/session";
import { DoubtBookingJoinScreen } from "@/components/doubt-booking/DoubtBookingJoinScreen";

export const metadata: Metadata = {
  title: "Doubt Session",
};

export default async function TeacherDoubtBookingJoinPage({ params }: { params: { bookingId: string } }) {
  await requireTeamSession();
  return <DoubtBookingJoinScreen bookingId={params.bookingId} backHref="/team/doubt-booking" />;
}
