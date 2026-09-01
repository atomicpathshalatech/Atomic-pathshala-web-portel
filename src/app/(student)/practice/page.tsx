"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { QuizMode } from "@/components/ai-chat/QuizMode";

export default function StudentQuestionPracticePage() {
  const router = useRouter();

  return <QuizMode onClose={() => router.push("/dashboard")} />;
}
