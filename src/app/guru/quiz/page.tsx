"use client";

import { useRouter } from "next/navigation";
import { QuizMode } from "@/components/ai-chat/QuizMode";

export default function GuruQuizPage() {
  const router = useRouter();

  return <QuizMode onClose={() => router.push("/guru")} />;
}
