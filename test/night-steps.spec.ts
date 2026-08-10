import assert from 'node:assert/strict';
import test from 'node:test';
import { Clan, NightActionType, Role } from '@prisma/client';
import { buildNightSteps, StepPlayer } from '../src/nights/night-steps';

const player = (
  id: string,
  nickname: string,
  role: Role,
  clan: Clan,
  isAlive = true,
): StepPlayer => ({ id, nickname, role, clan, isAlive });

const mafia = player('mafia', 'Мафия', Role.MAFIA, Clan.MAFIA);
const don = player('don', 'Дон', Role.DON, Clan.MAFIA);
const commissar = player(
  'commissar',
  'Комиссар',
  Role.COMMISSAR,
  Clan.CIVILIANS,
);
const civilian = player(
  'civilian',
  'Мирный',
  Role.CIVILIAN,
  Clan.CIVILIANS,
);

const build = (players: StepPlayer[], donActsWithMafia = false) =>
  buildNightSteps(players, {
    nightNumber: 2,
    donActsWithMafia,
    doctorSelfHealUsed: false,
  });

test('Don kills for dead Mafia and still searches for the Commissar', () => {
  const steps = build([
    { ...mafia, isAlive: false },
    don,
    commissar,
    civilian,
  ]);

  const mafiaKill = steps.find(
    (step) => step.actionType === NightActionType.MAFIA_KILL,
  );
  const donCheck = steps.find(
    (step) => step.actionType === NightActionType.DON_CHECK,
  );

  assert.ok(mafiaKill);
  assert.equal(mafiaKill.title, 'Дон (убийство)');
  assert.equal(mafiaKill.actorNickname, don.nickname);
  assert.ok(donCheck);
  assert.equal(donCheck.actorNickname, don.nickname);
  assert.ok(steps.indexOf(mafiaKill) < steps.indexOf(donCheck));
});

test('regular Mafia keeps the kill while Don has a separate search', () => {
  const steps = build([mafia, don, commissar, civilian]);
  const mafiaKill = steps.find(
    (step) => step.actionType === NightActionType.MAFIA_KILL,
  );

  assert.equal(mafiaKill?.title, 'Мафия');
  assert.equal(mafiaKill?.actorNickname, mafia.nickname);
  assert.ok(
    steps.some((step) => step.actionType === NightActionType.DON_CHECK),
  );
});

test('Don permanently acting with Mafia does not get a separate search', () => {
  const steps = build(
    [{ ...mafia, isAlive: false }, don, commissar, civilian],
    true,
  );

  assert.equal(
    steps.find((step) => step.actionType === NightActionType.MAFIA_KILL)
      ?.actorNickname,
    don.nickname,
  );
  assert.ok(
    !steps.some((step) => step.actionType === NightActionType.DON_CHECK),
  );
});

test('Mafia kill is skipped when both Mafia and Don are dead', () => {
  const steps = build([
    { ...mafia, isAlive: false },
    { ...don, isAlive: false },
    commissar,
    civilian,
  ]);

  assert.ok(
    !steps.some((step) => step.actionType === NightActionType.MAFIA_KILL),
  );
});
