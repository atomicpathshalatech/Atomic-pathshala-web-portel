"use client";

import React from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/Skeleton";

// QuizMode is a ~2k-line client component that also pulls in the PDF
// export stack (jspdf / html2canvas / pdfjs). Load it on demand behind a
// skeleton instead of shipping/parsing it as part of the route entry.
const QuizMode = dynamic(
  () => import("@/components/ai-chat/QuizMode").then((m) => m.QuizMode),
  {
    ssr: false,
    loading: () => (
      <div className="mx-auto max-w-3xl space-y-4 p-4">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-10 w-32" />
      </div>
    ),
  }
);

export default function StudentQuestionPracticePage() {
  const router = useRouter();

  return <QuizMode onClose={() => router.push("/dashboard")} />;
}
