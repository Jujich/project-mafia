import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { SyncService } from '../src/sync/sync.service';

function snapshot(revision: number, id = 'local-game') {
  return {
    schemaVersion: 1,
    revision,
    aggregate: {
      id,
      title: `Revision ${revision}`,
      status: 'SETUP',
      playedAt: '2026-09-02T12:00:00.000Z',
      createdAt: '2026-09-02T12:00:00.000Z',
      currentPhase: 'SETUP',
      currentNightNumber: 0,
      currentDayNumber: 0,
      donFoundCommissar: false,
      donActsWithMafia: false,
      doctorSelfHealUsed: false,
      players: [{
        id: `${id}-player`,
        role: 'CIVILIAN',
        clan: 'CIVILIANS',
        isAlive: true,
        player: { nickname: 'Антон' },
      }],
      nights: [],
      days: [],
    },
  };
}

interface StoredGame {
  id: string;
  clientGameId: string;
  clientRevision: number;
  title: string;
  syncedAt: Date;
}

/** Simulate transaction-scoped locks, and fail if any ORM access precedes them. */
function database() {
  const games = new Map<string, StoredGame>();
  const locks = new Map<string, Promise<void>>();
  const writes: string[] = [];
  let transactions = 0;

  const prisma = {
    async $transaction<T>(
      work: (tx: unknown) => Promise<T>,
      options: { isolationLevel: string; maxWait: number; timeout: number },
    ): Promise<T> {
      transactions++;
      assert.equal(options.isolationLevel, Prisma.TransactionIsolationLevel.ReadCommitted);
      assert.ok(options.timeout <= 30_000);
      let release: (() => void) | undefined;
      let lockedKey: string | undefined;
      const assertLocked = () => assert.ok(lockedKey, 'lock must precede ORM queries');
      const write = async (name: string) => {
        assertLocked();
        writes.push(name);
        return {};
      };
      const childModel = (name: string) => ({
        create: () => write(`${name}.create`),
        deleteMany: () => write(`${name}.deleteMany`),
        findMany: async () => { assertLocked(); return []; },
      });
      const tx = {
        async $executeRaw(strings: TemplateStringsArray, ...values: unknown[]) {
          assert.match(strings.join('?'), /pg_advisory_xact_lock\(hashtextextended\(/);
          assert.equal(values.length, 1, 'client id must be a bound SQL parameter');
          const key = String(values[0]);
          assert.ok(key.startsWith('mafia:offline-sync:'));
          const predecessor = locks.get(key) ?? Promise.resolve();
          const pending = new Promise<void>((resolve) => { release = resolve; });
          locks.set(key, predecessor.then(() => pending));
          await predecessor;
          lockedKey = key;
          return 1;
        },
        game: {
          async findUnique({ where }: { where: { clientGameId: string } }) {
            assert.equal(lockedKey, `mafia:offline-sync:${where.clientGameId}`);
            return games.get(where.clientGameId) ?? null;
          },
          async create({ data }: { data: Omit<StoredGame, 'id'> }) {
            assertLocked();
            assert.ok(!games.has(data.clientGameId), 'cannot create duplicate game');
            writes.push('game.create');
            const game = { ...data, id: `server-${data.clientGameId}` };
            games.set(data.clientGameId, game);
            return game;
          },
          async update({ where, data }: { where: { id: string }; data: Partial<StoredGame> }) {
            assertLocked();
            const current = [...games.values()].find((game) => game.id === where.id);
            assert.ok(current);
            writes.push('game.update');
            const updated = { ...current, ...data };
            games.set(current.clientGameId, updated);
            return updated;
          },
        },
        player: {
          async upsert() { await write('player.upsert'); return { id: 'server-player' }; },
        },
        gamePlayer: childModel('gamePlayer'),
        night: childModel('night'),
        nightAction: childModel('nightAction'),
        day: childModel('day'),
        voteNomination: childModel('voteNomination'),
        dayElimination: childModel('dayElimination'),
        gameEvent: childModel('gameEvent'),
      };
      try {
        return await work(tx);
      } finally {
        release?.();
      }
    },
  };

  return {
    service: new SyncService(prisma as unknown as PrismaService),
    games,
    writes,
    transactionCount: () => transactions,
  };
}

test('simultaneous first imports create once and acknowledge stale/duplicate revisions', async () => {
  const db = database();
  const results = await Promise.all([
    db.service.importGame('local-game', snapshot(9)),
    db.service.importGame('local-game', snapshot(7)),
    db.service.importGame('local-game', snapshot(9)),
  ]);
  assert.deepEqual(results.map(({ status }) => status), ['created', 'duplicate', 'duplicate']);
  assert.deepEqual(results.map(({ acceptedRevision }) => acceptedRevision), [9, 9, 9]);
  assert.equal(db.games.size, 1);
  assert.equal(db.games.get('local-game')?.title, 'Revision 9');
  assert.equal(db.writes.filter((name) => name === 'game.create').length, 1);
  assert.equal(db.writes.filter((name) => name.endsWith('.deleteMany')).length, 0);
});

test('concurrent updates never replace a newer snapshot with a stale one', async () => {
  const db = database();
  await db.service.importGame('local-game', snapshot(1));
  db.writes.length = 0;
  const results = await Promise.all([
    db.service.importGame('local-game', snapshot(3)),
    db.service.importGame('local-game', snapshot(2)),
  ]);
  assert.deepEqual(results.map(({ status }) => status), ['updated', 'duplicate']);
  assert.equal(db.games.get('local-game')?.clientRevision, 3);
  assert.equal(db.games.get('local-game')?.title, 'Revision 3');
  assert.equal(db.writes.filter((name) => name === 'game.update').length, 1);
  assert.equal(db.writes.filter((name) => name === 'gamePlayer.deleteMany').length, 1);
});

test('a newer queued revision is imported after the first snapshot commits', async () => {
  const db = database();
  const results = await Promise.all([
    db.service.importGame('local-game', snapshot(1)),
    db.service.importGame('local-game', snapshot(2)),
  ]);
  assert.deepEqual(results.map(({ status }) => status), ['created', 'updated']);
  assert.equal(db.games.get('local-game')?.clientRevision, 2);
});

test('invalid snapshots do not acquire a connection or a lock', async () => {
  const db = database();
  await assert.rejects(
    db.service.importGame('another-game', snapshot(1)),
    BadRequestException,
  );
  assert.equal(db.transactionCount(), 0);
});
