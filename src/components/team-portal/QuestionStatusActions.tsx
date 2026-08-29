"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function QuestionStatusActions({
  questionId,
  isPublished,
}: {
  questionId: string;
  isPublished: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      const res = await fetch(`/api/team/questions/${questionId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: !isPublished }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        toast.error(body.error ?? "Could not update status");
        return;
      }
      toast.success(isPublished ? "Unpublished" : "Published");
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      disabled={loading}
      onClick={toggle}
      className={isPublished ? "p-1 hover:text-error disabled:opacity-50" : "p-1 hover:text-tertiary disabled:opacity-50"}
      title={isPublished ? "Unpublish" : "Publish"}
    >
      <span className="material-symbols-outlined">
        {isPublished ? "unpublished" : "check_circle"}
      </span>
    </button>
  );
}
