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
  const whiteMark = first(Role.WHITE_MARK);

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
      selection: 'double',
      allowNoTarget: false,
      requiresAction: true,
      eligibleTargets: aliveExcept(journalist.id),
    });
  }

  // White Mark only wakes on the first night, purely so the host sees who it is.
  if (whiteMark && ctx.nightNumber === 1) {
    steps.push({
      key: 'WHITE_MARK',
      role: Role.WHITE_MARK,
      actionType: NightActionType.WHITE_MARK_WAKE,
      title: 'Белая метка',
      hostText: HOST_TEXTS.WHITE_MARK,
      selection: 'none',
      allowNoTarget: true,
      requiresAction: false,
      eligibleTargets: [],
    });
  }

  return steps;
}
