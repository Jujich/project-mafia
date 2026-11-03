import { Injectable } from '@nestjs/common';
import { GamePhase, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { parseSyncSnapshot } from './sync-snapshot';

@Injectable()
export class SyncService {
  constructor(private readonly prisma: PrismaService) {}

  async importGame(clientGameId: string, body: unknown) {
    const snapshot = parseSyncSnapshot(clientGameId, body);

    return this.prisma.$transaction(
      async (tx) => {
        // Lock before looking up the row: this also serializes simultaneous first
        // uploads, when SELECT FOR UPDATE cannot lock a not-yet-existing game.
        // PostgreSQL releases the lock on commit/rollback, across all API replicas.
        await tx.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtextextended(${`mafia:offline-sync:${clientGameId}`}, 0))
        `;
        const syncedAt = new Date();
        const existing = await tx.game.findUnique({
          where: { clientGameId },
          select: {
            id: true,
            clientRevision: true,
            syncedAt: true,
          },
        });

        if (existing && existing.clientRevision >= snapshot.revision) {
          return {
            clientGameId,
            acceptedRevision: existing.clientRevision,
            status: 'duplicate' as const,
            syncedAt: (existing.syncedAt ?? syncedAt).toISOString(),
          };
        }

        const aggregate = snapshot.aggregate;
        let gameId: string;
        let status: 'created' | 'updated';

        if (existing) {
          gameId = existing.id;
          status = 'updated';
          const nights = await tx.night.findMany({
            where: { gameId },
            select: { id: true },
          });
          const days = await tx.day.findMany({
            where: { gameId },
            select: { id: true },
          });
          const nightIds = nights.map((night) => night.id);
          const dayIds = days.map((day) => day.id);

          if (nightIds.length) {
            await tx.nightAction.deleteMany({
              where: { nightId: { in: nightIds } },
            });
          }
          if (dayIds.length) {
            await tx.voteNomination.deleteMany({
              where: { dayId: { in: dayIds } },
            });
            await tx.dayElimination.deleteMany({
              where: { dayId: { in: dayIds } },
            });
          }
          await tx.night.deleteMany({ where: { gameId } });
          await tx.day.deleteMany({ where: { gameId } });
          await tx.gamePlayer.deleteMany({ where: { gameId } });
          await tx.gameEvent.deleteMany({ where: { gameId } });

          await tx.game.update({
            where: { id: gameId },
            data: {
              title: aggregate.title,
              status: aggregate.status,
              clientRevision: snapshot.revision,
              playedAt: aggregate.playedAt,
              syncedAt,
              startedAt: aggregate.startedAt,
              finishedAt: aggregate.finishedAt,
              winnerClan: aggregate.winnerClan,
              hostComment: aggregate.hostComment,
              currentPhase: aggregate.currentPhase,
              currentNightNumber: aggregate.currentNightNumber,
              currentDayNumber: aggregate.currentDayNumber,
              donFoundCommissar: aggregate.donFoundCommissar,
              donFoundCommissarNightNumber:
                aggregate.donFoundCommissarNightNumber,
              donActsWithMafia: aggregate.donActsWithMafia,
              doctorSelfHealUsed: aggregate.doctorSelfHealUsed,
            },
          });
        } else {
          status = 'created';
          const game = await tx.game.create({
            data: {
              title: aggregate.title,
              status: aggregate.status,
              clientGameId,
              clientRevision: snapshot.revision,
              playedAt: aggregate.playedAt,
              syncedAt,
              startedAt: aggregate.startedAt,
              finishedAt: aggregate.finishedAt,
              winnerClan: aggregate.winnerClan,
              hostComment: aggregate.hostComment,
              currentPhase: aggregate.currentPhase,
              currentNightNumber: aggregate.currentNightNumber,
              currentDayNumber: aggregate.currentDayNumber,
              donFoundCommissar: aggregate.donFoundCommissar,
              donFoundCommissarNightNumber:
                aggregate.donFoundCommissarNightNumber,
              donActsWithMafia: aggregate.donActsWithMafia,
              doctorSelfHealUsed: aggregate.doctorSelfHealUsed,
              createdAt: aggregate.createdAt,
            },
            select: { id: true },
          });
          gameId = game.id;
        }

        for (const localPlayer of aggregate.players) {
          const player = await tx.player.upsert({
            where: { nickname: localPlayer.nickname },
            create: { nickname: localPlayer.nickname },
            update: {},
            select: { id: true },
          });
          await tx.gamePlayer.create({
            data: {
              id: localPlayer.id,
              gameId,
              playerId: player.id,
              role: localPlayer.role,
              clan: localPlayer.clan,
              isAlive: localPlayer.isAlive,
              deathPhase: localPlayer.deathPhase,
              deathReason: localPlayer.deathReason,
              deathNightNumber: localPlayer.deathNightNumber,
              deathDayNumber: localPlayer.deathDayNumber,
            },
          });
        }

        for (const night of aggregate.nights) {
          await tx.night.create({
            data: {
              id: night.id,
              gameId,
              number: night.number,
              status: night.status,
              summaryText: night.summaryText,
              createdAt: night.createdAt,
              completedAt: night.completedAt,
            },
          });
          for (const action of night.actions) {
            await tx.nightAction.create({
              data: {
                id: action.id,
                nightId: night.id,
                actorRole: action.actorRole,
                actionType: action.actionType,
                actorGamePlayerId: action.actorGamePlayerId,
                targetGamePlayerId: action.targetGamePlayerId,
                secondTargetGamePlayerId: action.secondTargetGamePlayerId,
                result: action.result,
                publicText: action.publicText,
                privateText: action.privateText,
              },
            });
          }
        }

        for (const day of aggregate.days) {
          await tx.day.create({
            data: {
              id: day.id,
              gameId,
              number: day.number,
              status: day.status,
              discussionStartedAt: day.discussionStartedAt,
              discussionEndedAt: day.discussionEndedAt,
              createdAt: day.createdAt,
              completedAt: day.completedAt,
            },
          });
          for (const nomination of day.nominations) {
            await tx.voteNomination.create({
              data: {
                id: nomination.id,
                dayId: day.id,
                nomineeGamePlayerId: nomination.nomineeGamePlayerId,
                order: nomination.order,
              },
            });
          }
          if (day.elimination) {
            await tx.dayElimination.create({
              data: {
                id: day.elimination.id,
                dayId: day.id,
                eliminatedGamePlayerId:
                  day.elimination.eliminatedGamePlayerId,
                reason: day.elimination.reason,
              },
            });
          }
        }

        await tx.gameEvent.create({
          data: {
            gameId,
            phase: aggregate.currentPhase as GamePhase,
            type: 'OFFLINE_SNAPSHOT_SYNCED',
            payload: {
              clientGameId,
              revision: snapshot.revision,
              schemaVersion: 1,
            } satisfies Prisma.JsonObject,
          },
        });

        return {
          clientGameId,
          acceptedRevision: snapshot.revision,
          status,
          syncedAt: syncedAt.toISOString(),
        };
      },
      {
        // The lookup after a lock wait must see the previous import's commit,
        // even if the database's default isolation level changes.
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 5_000,
        timeout: 30_000,
      },
    );
  }
}
