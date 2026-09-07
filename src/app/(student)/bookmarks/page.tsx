import type { Metadata } from "next";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { BookmarkCard } from "@/components/student/BookmarkCard";

export const metadata: Metadata = {
  title: "My Bookmarks",
};

export default async function BookmarksPage() {
  const { student } = await requireStudentSession();

  const bookmarks = await prisma.bookmark.findMany({
    where: { studentId: student.id },
    orderBy: { createdAt: "desc" },
    include: { question: { include: { translations: true } } },
  });

  return (
    <div className="space-y-stack-lg max-w-6xl">
      <header>
        <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg text-on-surface">My Bookmarks</h1>
        <p className="text-body-lg text-on-surface-variant mt-2">
          Questions you&apos;ve saved from tests, DPPs and the Question Bank for later revision.
        </p>
      </header>

      {bookmarks.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center text-on-surface-variant font-body-md">
          You haven&apos;t bookmarked any questions yet. Look for the bookmark icon while solving a test or DPP.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
          {bookmarks.map((bookmark) => (
            <BookmarkCard
              key={bookmark.id}
              questionId={bookmark.questionId}
              subject={bookmark.question.subject}
              chapter={bookmark.question.chapter}
              topic={bookmark.question.topic}
              difficulty={bookmark.question.difficulty}
              statement={bookmark.question.translations[0]?.statement ?? null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
