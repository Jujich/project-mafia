import { Clan, NightActionType, Role } from '@prisma/client';
import { HOST_TEXTS, ROLE_LABEL } from '../common/game-data';

export interface StepPlayer {
  id: string; // GamePlayer id
  nickname: string;
  role: Role;
  clan: Clan;
  isAlive: boolean;
}

export interface TargetOption {
  gamePlayerId: string;
  nickname: string;
  role: Role;
  roleLabel: string;
}

export type TargetSelection = 'single' | 'double' | 'none';

export interface NightStep {
  key: string;
  role: Role;
  actionType: NightActionType;
  title: string;
  hostText: string;
  /** Nickname of the player acting on this step (for the night review). */
  actorNickname: string | null;
  selection: TargetSelection;
  allowNoTarget: boolean;
  /** Must be addressed (an action saved) before the night can be completed. */
  requiresAction: boolean;
  eligibleTargets: TargetOption[];
}

export interface NightStepContext {
  nightNumber: number;
  donActsWithMafia: boolean;
  doctorSelfHealUsed: boolean;
}

const toOption = (p: StepPlayer): TargetOption => ({
  gamePlayerId: p.id,
  nickname: p.nickname,
  role: p.role,
  roleLabel: ROLE_LABEL[p.role],
});

/**
 * Builds the ordered list of night wake-ups for the given night (spec §8),
 * skipping roles whose players are dead and merging the Don into the mafia
 * step once he acts with them.
 */
export function buildNightSteps(
  players: StepPlayer[],
  ctx: NightStepContext,
): NightStep[] {
  const alive = players.filter((p) => p.isAlive);
  const aliveOf = (role: Role) => alive.filter((p) => p.role === role);
  const first = (role: Role) => aliveOf(role)[0];

  const beauty = first(Role.BEAUTY);
  const hasAliveMafia = aliveOf(Role.MAFIA).length > 0;
  const don = first(Role.DON);
  const maniac = first(Role.MANIAC);
  const doctor = first(Role.DOCTOR);
  const commissar = first(Role.COMMISSAR);
  const cop = first(Role.COP);
  const journalist = first(Role.JOURNALIST);

  // Don only acts with the mafia if he is still alive.
  const donActsWithMafia = ctx.donActsWithMafia && !!don;

  const allAlive = alive.map(toOption);
  const aliveExcept = (id: string) =>
    alive.filter((p) => p.id !== id).map(toOption);

  const steps: NightStep[] = [];

  if (beauty) {
    steps.push({
      key: 'BEAUTY',
      role: Role.BEAUTY,
      actionType: NightActionType.BEAUTY_IMMUNITY,
      title: 'Красотка',
      hostText: HOST_TEXTS.BEAUTY,
      actorNickname: beauty.nickname,
      selection: 'single',
      allowNoTarget: false,
      requiresAction: true,
      eligibleTargets: aliveExcept(beauty.id),
    });
  }

  if (hasAliveMafia || donActsWithMafia) {
    steps.push({
      key: 'MAFIA',
      role: Role.MAFIA,
      actionType: NightActionType.MAFIA_KILL,
      title: donActsWithMafia ? 'Мафия и Дон' : 'Мафия',
      hostText: donActsWithMafia ? HOST_TEXTS.MAFIA_WITH_DON : HOST_TEXTS.MAFIA,
      actorNickname: donActsWithMafia
        ? don?.nickname ?? null
        : aliveOf(Role.MAFIA)[0]?.nickname ?? null,
      selection: 'single',
      allowNoTarget: true,
      requiresAction: true,
      eligibleTargets: allAlive,
    });
  }

  if (maniac) {
    steps.push({
      key: 'MANIAC',
      role: Role.MANIAC,
      actionType: NightActionType.MANIAC_KILL,
      title: 'Маньяк',
      hostText: HOST_TEXTS.MANIAC,
      actorNickname: maniac.nickname,
      selection: 'single',
      allowNoTarget: true,
      requiresAction: true,
      eligibleTargets: allAlive,
    });
  }

  if (doctor) {
    // Doctor cannot pick himself again once the one-time self-heal is used.
    const targets = ctx.doctorSelfHealUsed
      ? aliveExcept(doctor.id)
      : allAlive;
    steps.push({
      key: 'DOCTOR',
      role: Role.DOCTOR,
      actionType: NightActionType.DOCTOR_HEAL,
      title: 'Доктор',
      hostText: HOST_TEXTS.DOCTOR,
      actorNickname: doctor.nickname,
      selection: 'single',
      allowNoTarget: true,
      requiresAction: true,
      eligibleTargets: targets,
    });
  }

  if (commissar) {
    steps.push({
      key: 'COMMISSAR',
      role: Role.COMMISSAR,
      actionType: NightActionType.COMMISSAR_CHECK,
      title: 'Комиссар',
      hostText: HOST_TEXTS.COMMISSAR,
      actorNickname: commissar.nickname,
      selection: 'single',
      allowNoTarget: false,
      requiresAction: true,
      eligibleTargets: aliveExcept(commissar.id),
    });
  }

  // Separate Don step only while he still acts alone (searching the Commissar).
  if (don && !donActsWithMafia) {
    steps.push({
      key: 'DON',
      role: Role.DON,
      actionType: NightActionType.DON_CHECK,
      title: 'Дон',
      hostText: HOST_TEXTS.DON,
      actorNickname: don.nickname,
      selection: 'single',
      allowNoTarget: true,
      requiresAction: true,
      eligibleTargets: aliveExcept(don.id),
    });
  }

  if (cop) {
    steps.push({
      key: 'COP',
      role: Role.COP,
      actionType: NightActionType.COP_SHOOT,
      title: 'Коп',
      hostText: HOST_TEXTS.COP,
      actorNickname: cop.nickname,
      selection: 'single',
      allowNoTarget: true,
      requiresAction: true,
      eligibleTargets: aliveExcept(cop.id),
    });
  }

  if (journalist) {
    steps.push({
      key: 'JOURNALIST',
      role: Role.JOURNALIST,
      actionType: NightActionType.JOURNALIST_COMPARE,
      title: 'Журналист',
      hostText: HOST_TEXTS.JOURNALIST,
      actorNickname: journalist.nickname,
      selection: 'double',
      allowNoTarget: false,
      requiresAction: true,
      eligibleTargets: aliveExcept(journalist.id),
    });
  }

  return steps;
}
