-- CreateTable
CREATE TABLE "quiz_youtube_votes" (
    "id" TEXT NOT NULL,
    "quizSessionId" TEXT NOT NULL,
    "authorChannelId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorPhotoUrl" TEXT,
    "selectedOption" TEXT NOT NULL,
    "responseTimeMs" INTEGER NOT NULL,
    "isCorrect" BOOLEAN,
    "chatMessageId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quiz_youtube_votes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quiz_youtube_votes_quizSessionId_idx" ON "quiz_youtube_votes"("quizSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "quiz_youtube_votes_quizSessionId_authorChannelId_key" ON "quiz_youtube_votes"("quizSessionId", "authorChannelId");

-- AddForeignKey
ALTER TABLE "quiz_youtube_votes" ADD CONSTRAINT "quiz_youtube_votes_quizSessionId_fkey" FOREIGN KEY ("quizSessionId") REFERENCES "quiz_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
