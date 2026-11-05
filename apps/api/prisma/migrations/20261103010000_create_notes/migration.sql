CREATE TABLE "notes" (
    "id" UUID NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "description" TEXT NOT NULL,
    "creatorKey" VARCHAR(50) NOT NULL,
    "creatorId" UUID,
    "creatorName" VARCHAR(100) NOT NULL,
    "creatorRole" "HistoryActorRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "note_participants" (
    "noteId" UUID NOT NULL,
    "participantKey" VARCHAR(50) NOT NULL,
    "userId" UUID,
    "nameSnapshot" VARCHAR(100) NOT NULL,
    "role" "HistoryActorRole" NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "note_participants_pkey" PRIMARY KEY ("noteId", "participantKey")
);

CREATE TABLE "note_comments" (
    "id" UUID NOT NULL,
    "noteId" UUID NOT NULL,
    "authorKey" VARCHAR(50) NOT NULL,
    "authorId" UUID,
    "authorName" VARCHAR(100) NOT NULL,
    "authorRole" "HistoryActorRole" NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "note_comments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notes_creatorKey_updatedAt_idx" ON "notes"("creatorKey", "updatedAt");
CREATE INDEX "notes_updatedAt_idx" ON "notes"("updatedAt");
CREATE INDEX "note_participants_participantKey_noteId_idx" ON "note_participants"("participantKey", "noteId");
CREATE INDEX "note_participants_userId_idx" ON "note_participants"("userId");
CREATE INDEX "note_comments_noteId_createdAt_idx" ON "note_comments"("noteId", "createdAt");
CREATE INDEX "note_comments_authorId_idx" ON "note_comments"("authorId");

ALTER TABLE "notes"
ADD CONSTRAINT "notes_creatorId_fkey"
FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "note_participants"
ADD CONSTRAINT "note_participants_noteId_fkey"
FOREIGN KEY ("noteId") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "note_participants"
ADD CONSTRAINT "note_participants_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "note_comments"
ADD CONSTRAINT "note_comments_noteId_fkey"
FOREIGN KEY ("noteId") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "note_comments"
ADD CONSTRAINT "note_comments_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
