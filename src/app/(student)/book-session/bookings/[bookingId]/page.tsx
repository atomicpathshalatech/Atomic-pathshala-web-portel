import type { Metadata } from "next";
import { DoubtBookingJoinScreen } from "@/components/doubt-booking/DoubtBookingJoinScreen";

export const metadata: Metadata = {
  title: "Doubt Session",
};

export default function StudentDoubtBookingJoinPage({ params }: { params: { bookingId: string } }) {
  return <DoubtBookingJoinScreen bookingId={params.bookingId} backHref="/book-session/bookings" />;
}
