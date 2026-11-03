import { describe, expect, it } from 'vitest';
import type { Game, NightCurrent, Role } from '../types/game';
import {
  completeLocalDay,
  completeLocalNight,
  createLocalGame,
  getLocalDayCurrent,
  getLocalNightCurrent,
  saveLocalElimination,
  saveLocalNightAction,
  saveLocalNominations,
  startLocalDay,
  startLocalGame,
  startLocalNight,
} from '../utils/offline-game-engine';

function gameWith(roles: Role[]): Game {
  const game = createLocalGame({
    title: 'Офлайн-тест',
    playedAt: '2026-08-26T12:00:00.000Z',
    players: roles.map((role, index) => ({ nickname: `${role}-${index}`, role })),
  });
  return startLocalGame(game);
}

function saveRequiredActions(
  game: Game,
  current: NightCurrent,
  targets: Partial<Record<string, string | null>> = {},
) {
  for (const step of current.steps) {
    const desired = targets[step.actionType];
    const target = desired !== undefined
      ? desired
      : step.allowNoTarget
        ? null
        : step.eligibleTargets[0]?.gamePlayerId ?? null;
    const second = step.selection === 'double'
      ? step.eligibleTargets.find((item) => item.gamePlayerId !== target)?.gamePlayerId
      : undefined;
    saveLocalNightAction(game, current.night.id, {
      actionType: step.actionType,
      targetGamePlayerId: target,
      secondTargetGamePlayerId: second,
    });
  }
}

describe('offline game engine', () => {
  it('runs a complete night/day cycle without a backend', () => {
    const game = gameWith([
      'CIVILIAN', 'MAFIA', 'DON', 'MANIAC', 'DOCTOR',
      'COMMISSAR', 'BEAUTY', 'COP', 'JOURNALIST',
    ]);
    const night = startLocalNight(game);
    const civilian = game.players.find((player) => player.role === 'CIVILIAN')!;
    const commissar = game.players.find((player) => player.role === 'COMMISSAR')!;
    const mafia = game.players.find((player) => player.role === 'MAFIA')!;

    saveRequiredActions(game, night, {
      BEAUTY_IMMUNITY: mafia.id,
      MAFIA_KILL: civilian.id,
      MANIAC_KILL: null,
      DON_CHECK: commissar.id,
    });

    const donFeedback = getLocalNightCurrent(game).steps.find(
      (step) => step.actionType === 'DON_CHECK',
    )?.savedAction;
    expect(donFeedback?.result).toBe('FOUND');

    completeLocalNight(game, night.night.id);
    expect(civilian.isAlive).toBe(false);
    expect(civilian.deathReason).toBe('MAFIA');

    const day = startLocalDay(game);
    expect(day.deathsLastNight.map((death) => death.gamePlayerId)).toContain(civilian.id);
    const nominees = day.nominationCandidates.slice(0, 2).map((item) => item.gamePlayerId);
    saveLocalNominations(game, day.day.id, nominees);
    saveLocalElimination(game, day.day.id, nominees[0]);
    expect(getLocalDayCurrent(game).elimination?.eliminatedGamePlayerId).toBe(nominees[0]);
    saveLocalElimination(game, day.day.id, null);
    expect(game.players.find((player) => player.id === nominees[0])?.isAlive).toBe(true);
    completeLocalDay(game, day.day.id);
    expect(game.days[0].status).toBe('COMPLETED');
  });

  it('applies the delayed Don death on the following night', () => {
    const game = gameWith(['MAFIA', 'DON', 'COMMISSAR', 'CIVILIAN']);
    const firstNight = startLocalNight(game);
    const commissar = game.players.find((player) => player.role === 'COMMISSAR')!;
    saveRequiredActions(game, firstNight, { DON_CHECK: commissar.id });
    completeLocalNight(game, firstNight.night.id);

    const day = startLocalDay(game);
    const candidate = day.nominationCandidates[0].gamePlayerId;
    saveLocalNominations(game, day.day.id, [candidate]);
    saveLocalElimination(game, day.day.id, null);
    completeLocalDay(game, day.day.id);

    const secondNight = startLocalNight(game);
    saveRequiredActions(game, secondNight);
    completeLocalNight(game, secondNight.night.id);
    expect(commissar.isAlive).toBe(false);
    expect(commissar.deathReason).toBe('DON_DELAYED');
  });

  it('kills White Mark only when Mafia and Maniac choose it together', () => {
    const game = gameWith(['MAFIA', 'MANIAC', 'WHITE_MARK', 'CIVILIAN']);
    const whiteMark = game.players.find((player) => player.role === 'WHITE_MARK')!;
    const night = startLocalNight(game);
    saveRequiredActions(game, night, {
      MAFIA_KILL: whiteMark.id,
      MANIAC_KILL: whiteMark.id,
    });
    completeLocalNight(game, night.night.id);
    expect(whiteMark.isAlive).toBe(false);
    expect(whiteMark.deathReason).toBe('MAFIA');
  });
});
