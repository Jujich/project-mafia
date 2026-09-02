import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { parseSyncSnapshot } from '../src/sync/sync-snapshot';

function body() {
  return {
    schemaVersion: 1,
    revision: 7,
    aggregate: {
      id: 'client-game-1',
      title: 'Игра без сети',
      status: 'IN_PROGRESS',
      playedAt: '2026-08-26T12:00:00.000Z',
      startedAt: '2026-08-26T12:01:00.000Z',
      finishedAt: null,
      winnerClan: null,
      hostComment: null,
      currentPhase: 'NIGHT',
      currentNightNumber: 1,
      currentDayNumber: 0,
      donFoundCommissar: false,
      donFoundCommissarNightNumber: null,
      donActsWithMafia: false,
      doctorSelfHealUsed: false,
      createdAt: '2026-08-26T12:00:00.000Z',
      updatedAt: '2026-08-26T12:02:00.000Z',
      players: [
        {
          id: 'game-player-1',
          role: 'CIVILIAN',
          clan: 'CIVILIANS',
          isAlive: true,
          deathPhase: null,
          deathReason: null,
          deathNightNumber: null,
          deathDayNumber: null,
          player: { id: 'player-1', nickname: 'Антон' },
        },
      ],
      nights: [],
      days: [],
    },
  };
}

test('offline snapshot parser accepts and normalizes schema v1', () => {
  const parsed = parseSyncSnapshot('client-game-1', body());
  assert.equal(parsed.revision, 7);
  assert.equal(parsed.aggregate.players[0].nickname, 'Антон');
  assert.equal(parsed.aggregate.playedAt.toISOString(), '2026-08-26T12:00:00.000Z');
});

test('offline snapshot parser rejects a mismatched client id', () => {
  assert.throws(
    () => parseSyncSnapshot('another-game', body()),
    BadRequestException,
  );
});

test('offline snapshot parser rejects a role/clan mismatch', () => {
  const payload = body();
  payload.aggregate.players[0].clan = 'MAFIA';
  assert.throws(
    () => parseSyncSnapshot('client-game-1', payload),
    BadRequestException,
  );
});
