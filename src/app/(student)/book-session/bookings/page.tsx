import type { Metadata } from "next";
import { BookSessionBookingsList } from "@/components/student/BookSessionBookingsList";

export const metadata: Metadata = {
  title: "My Bookings",
};

export default function BookSessionBookingsPage() {
  return <BookSessionBookingsList />;
}
