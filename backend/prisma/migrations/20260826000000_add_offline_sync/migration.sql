ALTER TABLE "Game"
ADD COLUMN "clientGameId" TEXT,
ADD COLUMN "clientRevision" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "playedAt" TIMESTAMP(3),
ADD COLUMN "syncedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Game_clientGameId_key" ON "Game"("clientGameId");
