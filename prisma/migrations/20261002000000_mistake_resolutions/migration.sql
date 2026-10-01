-- Mistake Book: questions a student marked as understood ("Solved").
CREATE TABLE "mistake_resolutions" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mistake_resolutions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mistake_resolutions_studentId_key_key" ON "mistake_resolutions"("studentId", "key");
CREATE INDEX "mistake_resolutions_studentId_idx" ON "mistake_resolutions"("studentId");

ALTER TABLE "mistake_resolutions" ADD CONSTRAINT "mistake_resolutions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
