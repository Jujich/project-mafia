import { BadRequestException } from '@nestjs/common';
import {
  Clan,
  DayStatus,
  DeathPhase,
  DeathReason,
  EliminationReason,
  GamePhase,
  GameStatus,
  NightActionType,
  NightStatus,
  Role,
} from '@prisma/client';
import { clanForRole } from '../common/game-data';

export interface SyncPlayer {
  id: string;
  nickname: string;
  role: Role;
  clan: Clan;
  isAlive: boolean;
  deathPhase: DeathPhase | null;
  deathReason: DeathReason | null;
  deathNightNumber: number | null;
  deathDayNumber: number | null;
}

export interface SyncAction {
  id: string;
  actionType: NightActionType;
  actorRole: Role;
  actorGamePlayerId: string | null;
  targetGamePlayerId: string | null;
  secondTargetGamePlayerId: string | null;
  result: string | null;
  publicText: string | null;
  privateText: string | null;
}

export interface SyncNight {
  id: string;
  number: number;
  status: NightStatus;
  summaryText: string | null;
  createdAt: Date;
  completedAt: Date | null;
  actions: SyncAction[];
}

export interface SyncNomination {
  id: string;
  nomineeGamePlayerId: string;
  order: number;
}

export interface SyncDay {
  id: string;
  number: number;
  status: DayStatus;
  discussionStartedAt: Date | null;
  discussionEndedAt: Date | null;
  createdAt: Date;
  completedAt: Date | null;
  nominations: SyncNomination[];
  elimination: {
    id: string;
    eliminatedGamePlayerId: string | null;
    reason: EliminationReason;
  } | null;
}

export interface SyncAggregate {
  clientGameId: string;
  title: string;
  status: GameStatus;
  playedAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  winnerClan: Clan | null;
  hostComment: string | null;
  currentPhase: GamePhase;
  currentNightNumber: number;
  currentDayNumber: number;
  donFoundCommissar: boolean;
  donFoundCommissarNightNumber: number | null;
  donActsWithMafia: boolean;
  doctorSelfHealUsed: boolean;
  createdAt: Date;
  players: SyncPlayer[];
  nights: SyncNight[];
  days: SyncDay[];
}

export interface ValidatedSyncSnapshot {
  revision: number;
  aggregate: SyncAggregate;
}

type JsonObject = Record<string, unknown>;

function invalid(message: string): never {
  throw new BadRequestException(`Некорректный снимок игры: ${message}`);
}

function object(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    invalid(`${label} должен быть объектом.`);
  }
  return value as JsonObject;
}

function list(value: unknown, label: string, max: number): unknown[] {
  if (!Array.isArray(value)) invalid(`${label} должен быть массивом.`);
  if (value.length > max) invalid(`${label}: превышен лимит ${max}.`);
  return value;
}

function text(
  value: unknown,
  label: string,
  options: { nullable?: boolean; max?: number } = {},
): string | null {
  if (value == null && options.nullable) return null;
  if (typeof value !== 'string') invalid(`${label} должен быть строкой.`);
  const result = value as string;
  if (!result.trim() && !options.nullable) invalid(`${label} не может быть пустым.`);
  if (result.length > (options.max ?? 10_000)) invalid(`${label} слишком длинный.`);
  return result;
}

function integer(
  value: unknown,
  label: string,
  options: { nullable?: boolean; min?: number } = {},
): number | null {
  if (value == null && options.nullable) return null;
  if (!Number.isInteger(value) || (value as number) < (options.min ?? 0)) {
    invalid(`${label} должен быть целым числом.`);
  }
  return value as number;
}

function bool(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') invalid(`${label} должен быть boolean.`);
  return value as boolean;
}

function enumValue<T extends string>(
  value: unknown,
  values: Record<string, T>,
  label: string,
): T {
  if (typeof value !== 'string' || !Object.values(values).includes(value as T)) {
    invalid(`${label} содержит неизвестное значение.`);
  }
  return value as T;
}

function nullableEnum<T extends string>(
  value: unknown,
  values: Record<string, T>,
  label: string,
): T | null {
  if (value == null) return null;
  return enumValue(value, values, label);
}

function date(
  value: unknown,
  label: string,
  options: { nullable?: boolean; fallback?: Date } = {},
): Date | null {
  if (value == null) {
    if (options.fallback) return options.fallback;
    if (options.nullable) return null;
    invalid(`${label} обязателен.`);
  }
  if (typeof value !== 'string') invalid(`${label} должен быть ISO-датой.`);
  const parsed = new Date(value as string);
  if (Number.isNaN(parsed.getTime())) invalid(`${label} должен быть ISO-датой.`);
  return parsed;
}

function uniqueId(value: unknown, label: string, used: Set<string>): string {
  const result = text(value, label, { max: 200 }) as string;
  if (used.has(result)) invalid(`${label} повторяется.`);
  used.add(result);
  return result;
}

function playerRef(
  value: unknown,
  label: string,
  playerIds: Set<string>,
  nullable = true,
): string | null {
  if (value == null && nullable) return null;
  const result = text(value, label, { max: 200 }) as string;
  if (!playerIds.has(result)) invalid(`${label} ссылается на неизвестного игрока.`);
  return result;
}

/** Parse and copy only the fields understood by schema version 1. */
export function parseSyncSnapshot(
  clientGameId: string,
  body: unknown,
): ValidatedSyncSnapshot {
  const root = object(body, 'body');
  if (root.schemaVersion !== 1) invalid('поддерживается только schemaVersion=1.');
  const revision = integer(root.revision, 'revision', { min: 1 }) as number;
  const raw = object(root.aggregate, 'aggregate');
  const aggregateId = text(raw.id, 'aggregate.id', { max: 200 }) as string;
  if (aggregateId !== clientGameId) invalid('aggregate.id не совпадает с clientGameId.');

  const createdAt = date(raw.createdAt, 'aggregate.createdAt') as Date;
  const playerRows = list(raw.players, 'aggregate.players', 100);
  if (playerRows.length === 0) invalid('в игре должен быть хотя бы один игрок.');
  const playerIds = new Set<string>();
  const nicknames = new Set<string>();
  const players = playerRows.map((value, index): SyncPlayer => {
    const row = object(value, `players[${index}]`);
    const player = object(row.player, `players[${index}].player`);
    const nickname = (text(player.nickname, `players[${index}].nickname`, { max: 200 }) as string).trim();
    const normalizedNickname = nickname.toLocaleLowerCase('ru-RU');
    if (nicknames.has(normalizedNickname)) invalid(`ник игрока «${nickname}» повторяется.`);
    nicknames.add(normalizedNickname);
    const role = enumValue(row.role, Role, `players[${index}].role`);
    const clan = enumValue(row.clan, Clan, `players[${index}].clan`);
    if (clanForRole(role) !== clan) invalid(`players[${index}].clan не соответствует роли.`);
    return {
      id: uniqueId(row.id, `players[${index}].id`, playerIds),
      nickname,
      role,
      clan,
      isAlive: bool(row.isAlive, `players[${index}].isAlive`),
      deathPhase: nullableEnum(row.deathPhase, DeathPhase, `players[${index}].deathPhase`),
      deathReason: nullableEnum(row.deathReason, DeathReason, `players[${index}].deathReason`),
      deathNightNumber: integer(row.deathNightNumber, `players[${index}].deathNightNumber`, { nullable: true, min: 1 }),
      deathDayNumber: integer(row.deathDayNumber, `players[${index}].deathDayNumber`, { nullable: true, min: 1 }),
    };
  });

  const nightIds = new Set<string>();
  const actionIds = new Set<string>();
  const nightNumbers = new Set<number>();
  const nights = list(raw.nights, 'aggregate.nights', 1_000).map((value, nightIndex): SyncNight => {
    const row = object(value, `nights[${nightIndex}]`);
    const number = integer(row.number, `nights[${nightIndex}].number`, { min: 1 }) as number;
    if (nightNumbers.has(number)) invalid(`номер ночи ${number} повторяется.`);
    nightNumbers.add(number);
    const nightCreatedAt = date(row.createdAt, `nights[${nightIndex}].createdAt`, { fallback: createdAt }) as Date;
    const actions = list(row.actions, `nights[${nightIndex}].actions`, 100).map((value, actionIndex): SyncAction => {
      const action = object(value, `nights[${nightIndex}].actions[${actionIndex}]`);
      return {
        id: uniqueId(action.id, `actions[${actionIndex}].id`, actionIds),
        actionType: enumValue(action.actionType, NightActionType, `actions[${actionIndex}].actionType`),
        actorRole: enumValue(action.actorRole, Role, `actions[${actionIndex}].actorRole`),
        actorGamePlayerId: playerRef(action.actorGamePlayerId, `actions[${actionIndex}].actorGamePlayerId`, playerIds),
        targetGamePlayerId: playerRef(action.targetGamePlayerId, `actions[${actionIndex}].targetGamePlayerId`, playerIds),
        secondTargetGamePlayerId: playerRef(action.secondTargetGamePlayerId, `actions[${actionIndex}].secondTargetGamePlayerId`, playerIds),
        result: text(action.result, `actions[${actionIndex}].result`, { nullable: true, max: 200 }),
        publicText: text(action.publicText, `actions[${actionIndex}].publicText`, { nullable: true }),
        privateText: text(action.privateText, `actions[${actionIndex}].privateText`, { nullable: true }),
      };
    });
    return {
      id: uniqueId(row.id, `nights[${nightIndex}].id`, nightIds),
      number,
      status: enumValue(row.status, NightStatus, `nights[${nightIndex}].status`),
      summaryText: text(row.summaryText, `nights[${nightIndex}].summaryText`, { nullable: true }),
      createdAt: nightCreatedAt,
      completedAt: date(row.completedAt, `nights[${nightIndex}].completedAt`, { nullable: true }),
      actions,
    };
  });

  const dayIds = new Set<string>();
  const nominationIds = new Set<string>();
  const eliminationIds = new Set<string>();
  const dayNumbers = new Set<number>();
  const days = list(raw.days, 'aggregate.days', 1_000).map((value, dayIndex): SyncDay => {
    const row = object(value, `days[${dayIndex}]`);
    const number = integer(row.number, `days[${dayIndex}].number`, { min: 1 }) as number;
    if (dayNumbers.has(number)) invalid(`номер дня ${number} повторяется.`);
    dayNumbers.add(number);
    const nominations = list(row.nominations, `days[${dayIndex}].nominations`, 5).map((value, nominationIndex): SyncNomination => {
      const nomination = object(value, `days[${dayIndex}].nominations[${nominationIndex}]`);
      return {
        id: uniqueId(nomination.id, `nominations[${nominationIndex}].id`, nominationIds),
        nomineeGamePlayerId: playerRef(nomination.nomineeGamePlayerId, `nominations[${nominationIndex}].nomineeGamePlayerId`, playerIds, false) as string,
        order: integer(nomination.order, `nominations[${nominationIndex}].order`, { min: 1 }) as number,
      };
    });
    const rawElimination = row.elimination == null ? null : object(row.elimination, `days[${dayIndex}].elimination`);
    return {
      id: uniqueId(row.id, `days[${dayIndex}].id`, dayIds),
      number,
      status: enumValue(row.status, DayStatus, `days[${dayIndex}].status`),
      discussionStartedAt: date(row.discussionStartedAt, `days[${dayIndex}].discussionStartedAt`, { nullable: true }),
      discussionEndedAt: date(row.discussionEndedAt, `days[${dayIndex}].discussionEndedAt`, { nullable: true }),
      createdAt: date(row.createdAt, `days[${dayIndex}].createdAt`, { fallback: createdAt }) as Date,
      completedAt: date(row.completedAt, `days[${dayIndex}].completedAt`, { nullable: true }),
      nominations,
      elimination: rawElimination ? {
        id: uniqueId(rawElimination.id, `days[${dayIndex}].elimination.id`, eliminationIds),
        eliminatedGamePlayerId: playerRef(rawElimination.eliminatedGamePlayerId, `days[${dayIndex}].elimination.eliminatedGamePlayerId`, playerIds),
        reason: enumValue(rawElimination.reason, EliminationReason, `days[${dayIndex}].elimination.reason`),
      } : null,
    };
  });

  return {
    revision,
    aggregate: {
      clientGameId,
      title: (text(raw.title, 'aggregate.title', { max: 500 }) as string).trim(),
      status: enumValue(raw.status, GameStatus, 'aggregate.status'),
      playedAt: date(raw.playedAt, 'aggregate.playedAt', { fallback: createdAt }) as Date,
      startedAt: date(raw.startedAt, 'aggregate.startedAt', { nullable: true }),
      finishedAt: date(raw.finishedAt, 'aggregate.finishedAt', { nullable: true }),
      winnerClan: nullableEnum(raw.winnerClan, Clan, 'aggregate.winnerClan'),
      hostComment: text(raw.hostComment, 'aggregate.hostComment', { nullable: true }),
      currentPhase: enumValue(raw.currentPhase, GamePhase, 'aggregate.currentPhase'),
      currentNightNumber: integer(raw.currentNightNumber, 'aggregate.currentNightNumber') as number,
      currentDayNumber: integer(raw.currentDayNumber, 'aggregate.currentDayNumber') as number,
      donFoundCommissar: bool(raw.donFoundCommissar, 'aggregate.donFoundCommissar'),
      donFoundCommissarNightNumber: integer(raw.donFoundCommissarNightNumber, 'aggregate.donFoundCommissarNightNumber', { nullable: true, min: 1 }),
      donActsWithMafia: bool(raw.donActsWithMafia, 'aggregate.donActsWithMafia'),
      doctorSelfHealUsed: bool(raw.doctorSelfHealUsed, 'aggregate.doctorSelfHealUsed'),
      createdAt,
      players,
      nights,
      days,
    },
  };
}
