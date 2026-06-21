-- Add explicit nomination order so the host can see the order players were put up for the vote.
ALTER TABLE "VoteNomination" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;
