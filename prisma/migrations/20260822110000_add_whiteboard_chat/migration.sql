-- AlterTable
ALTER TABLE "whiteboard_sessions" ADD COLUMN "chatEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "whiteboard_messages" (
    "id" TEXT NOT NULL,
    "whiteboardSessionId" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whiteboard_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "whiteboard_messages_whiteboardSessionId_createdAt_idx" ON "whiteboard_messages"("whiteboardSessionId", "createdAt");

-- AddForeignKey
ALTER TABLE "whiteboard_messages" ADD CONSTRAINT "whiteboard_messages_whiteboardSessionId_fkey" FOREIGN KEY ("whiteboardSessionId") REFERENCES "whiteboard_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
