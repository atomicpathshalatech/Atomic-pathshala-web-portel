import { BoardExamHub } from "@/components/ai-chat/BoardExamHub";

export const metadata = {
  title: "Board Exam Hub | Atomic Pathshala",
  description:
    "Practice Class 10th and 12th Board Exam PYQs, Model Papers, and Chapterwise Blueprint Questions for CBSE and State Boards.",
};

export default function StudentBoardExamPage() {
  return <BoardExamHub backUrl="/practice" backLabel="Return to Practice" />;
}
