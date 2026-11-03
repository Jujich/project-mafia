-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('SETUP', 'IN_PROGRESS', 'FINISHED');

-- CreateEnum
CREATE TYPE "GamePhase" AS ENUM ('SETUP', 'NIGHT', 'DAY', 'FINISHED');

-- CreateEnum
CREATE TYPE "Clan" AS ENUM ('CIVILIANS', 'MAFIA', 'MANIAC');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CIVILIAN', 'MAFIA', 'DON', 'MANIAC', 'DOCTOR', 'COMMISSAR', 'BEAUTY', 'COP', 'JOURNALIST', 'WHITE_MARK');

-- CreateEnum
CREATE TYPE "DeathPhase" AS ENUM ('NIGHT', 'DAY');

-- CreateEnum
CREATE TYPE "DeathReason" AS ENUM ('MAFIA', 'MANIAC', 'COP', 'DON_DELAYED', 'VOTE');

-- CreateEnum
CREATE TYPE "NightStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "DayStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "NightActionType" AS ENUM ('BEAUTY_IMMUNITY', 'MAFIA_KILL', 'MANIAC_KILL', 'DOCTOR_HEAL', 'COMMISSAR_CHECK', 'DON_CHECK', 'COP_SHOOT', 'JOURNALIST_COMPARE', 'WHITE_MARK_WAKE', 'DON_DELAYED_KILL');

-- CreateEnum
CREATE TYPE "EliminationReason" AS ENUM ('VOTE', 'NO_ELIMINATION');

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "GameStatus" NOT NULL DEFAULT 'SETUP',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "winnerClan" "Clan",
    "hostComment" TEXT,
    "currentPhase" "GamePhase" NOT NULL DEFAULT 'SETUP',
    "currentNightNumber" INTEGER NOT NULL DEFAULT 0,
    "currentDayNumber" INTEGER NOT NULL DEFAULT 0,
    "donFoundCommissar" BOOLEAN NOT NULL DEFAULT false,
    "donFoundCommissarNightNumber" INTEGER,
    "donActsWithMafia" BOOLEAN NOT NULL DEFAULT false,
    "doctorSelfHealUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GamePlayer" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "clan" "Clan" NOT NULL,
    "isAlive" BOOLEAN NOT NULL DEFAULT true,
    "deathPhase" "DeathPhase",
    "deathReason" "DeathReason",
    "deathNightNumber" INTEGER,
    "deathDayNumber" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GamePlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Night" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "NightStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "summaryText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Night_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NightAction" (
    "id" TEXT NOT NULL,
    "nightId" TEXT NOT NULL,
    "actorRole" "Role" NOT NULL,
    "actionType" "NightActionType" NOT NULL,
    "actorGamePlayerId" TEXT,
    "targetGamePlayerId" TEXT,
    "secondTargetGamePlayerId" TEXT,
    "result" TEXT,
    "publicText" TEXT,
    "privateText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NightAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Day" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "DayStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "discussionStartedAt" TIMESTAMP(3),
    "discussionEndedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Day_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoteNomination" (
    "id" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "nomineeGamePlayerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoteNomination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DayElimination" (
    "id" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "eliminatedGamePlayerId" TEXT,
    "reason" "EliminationReason" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DayElimination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameEvent" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "phase" "GamePhase" NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_nickname_key" ON "Player"("nickname");

-- CreateIndex
CREATE UNIQUE INDEX "GamePlayer_gameId_playerId_key" ON "GamePlayer"("gameId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "Night_gameId_number_key" ON "Night"("gameId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Day_gameId_number_key" ON "Day"("gameId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "VoteNomination_dayId_nomineeGamePlayerId_key" ON "VoteNomination"("dayId", "nomineeGamePlayerId");

-- CreateIndex
CREATE UNIQUE INDEX "DayElimination_dayId_key" ON "DayElimination"("dayId");

-- AddForeignKey
ALTER TABLE "GamePlayer" ADD CONSTRAINT "GamePlayer_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamePlayer" ADD CONSTRAINT "GamePlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Night" ADD CONSTRAINT "Night_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NightAction" ADD CONSTRAINT "NightAction_nightId_fkey" FOREIGN KEY ("nightId") REFERENCES "Night"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NightAction" ADD CONSTRAINT "NightAction_actorGamePlayerId_fkey" FOREIGN KEY ("actorGamePlayerId") REFERENCES "GamePlayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NightAction" ADD CONSTRAINT "NightAction_targetGamePlayerId_fkey" FOREIGN KEY ("targetGamePlayerId") REFERENCES "GamePlayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NightAction" ADD CONSTRAINT "NightAction_secondTargetGamePlayerId_fkey" FOREIGN KEY ("secondTargetGamePlayerId") REFERENCES "GamePlayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Day" ADD CONSTRAINT "Day_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoteNomination" ADD CONSTRAINT "VoteNomination_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "Day"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoteNomination" ADD CONSTRAINT "VoteNomination_nomineeGamePlayerId_fkey" FOREIGN KEY ("nomineeGamePlayerId") REFERENCES "GamePlayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayElimination" ADD CONSTRAINT "DayElimination_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "Day"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayElimination" ADD CONSTRAINT "DayElimination_eliminatedGamePlayerId_fkey" FOREIGN KEY ("eliminatedGamePlayerId") REFERENCES "GamePlayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameEvent" ADD CONSTRAINT "GameEvent_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

