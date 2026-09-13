import type { Metadata } from "next";
import { BookSessionTeacherList } from "@/components/student/BookSessionTeacherList";

export const metadata: Metadata = {
  title: "Book a Session",
};

export default function BookSessionPage() {
  return <BookSessionTeacherList />;
}
