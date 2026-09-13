import type { Metadata } from "next";
import { BookSessionSlotPicker } from "@/components/student/BookSessionSlotPicker";

export const metadata: Metadata = {
  title: "Book a Session",
};

export default function BookSessionTeacherSlotsPage({ params }: { params: { teacherId: string } }) {
  return <BookSessionSlotPicker teacherId={params.teacherId} />;
}
