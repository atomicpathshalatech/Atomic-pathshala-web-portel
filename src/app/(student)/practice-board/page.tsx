import type { Metadata } from "next";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { WhiteboardCanvas } from "@/components/shared/WhiteboardCanvas";

export const metadata: Metadata = {
  title: "Practice Board",
};

export default async function PracticeBoardPage() {
  const { student } = await requireStudentSession();

  const boards = await prisma.studentWhiteboardBoard.findMany({
    where: { studentId: student.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, thumbnailDataUrl: true, updatedAt: true },
  });

  return (
    <div className="space-y-stack-md">
      <div>
        <h1 className="font-headline-lg text-headline-lg">Practice Board</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          Your personal scratchpad — work through problems, save what you want to keep.
        </p>
      </div>

      <WhiteboardCanvas
        apiBasePath="/api/student-whiteboard"
        initialBoards={boards.map((b) => ({
          id: b.id,
          title: b.title,
          thumbnailDataUrl: b.thumbnailDataUrl,
          updatedAt: b.updatedAt.toISOString(),
        }))}
      />
    </div>
  );
}
