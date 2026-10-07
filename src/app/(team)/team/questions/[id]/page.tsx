import React from "react";
import { redirect } from "next/navigation";

export default function QuestionDetailPage({ params }: { params: { id: string } }) {
  redirect(`/team/questions/${params.id}/review`);
}
