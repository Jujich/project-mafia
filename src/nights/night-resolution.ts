import { Clan, DeathReason, Role } from '@prisma/client';
import { ROLE_LABEL } from '../common/game-data';

export interface ResolverPlayer {
  id: string; // GamePlayer id
  nickname: string;
  role: Role;
  clan: Clan;
  isAlive: boolean;
}

export interface ResolverActions {
  beautyTargetId?: string | null;
  mafiaTargetId?: string | null;
  maniacTargetId?: string | null;
  doctorTargetId?: string | null;
  copTargetId?: string | null;
  doctorActorId?: string | null;
}

export interface ResolverContext {
  nightNumber: number;
  donFoundCommissar: boolean;
  donFoundCommissarNightNumber: number | null;
  players: ResolverPlayer[];
  actions: ResolverActions;
}

export interface ResolvedDeath {
  gamePlayerId: string;
  reason: DeathReason;
}

export interface ResolverResult {
  deaths: ResolvedDeath[];
  summaryText: string;
  doctorSelfHealUsedNow: boolean;
}

const MAFIA_CLAN_ROLES: Role[] = [Role.MAFIA, Role.DON];

/**
 * Central, authoritative night resolution (spec §17).
 *
 * Privacy rules (spec §9) are enforced here: the summary never reveals
 * Doctor saves, Beauty immunity hits, White Mark deflections, Commissar /
 * Journalist targets, or that the Don found the Commissar.
 */
export function resolveNight(ctx: ResolverContext): ResolverResult {
  const byId = new Map(ctx.players.map((p) => [p.id, p]));
  const get = (id?: string | null) => (id ? byId.get(id) ?? null : null);

  const beautyTarget = get(ctx.actions.beautyTargetId);
  const mafiaTarget = get(ctx.actions.mafiaTargetId);
  const maniacTarget = get(ctx.actions.maniacTargetId);
  const doctorTarget = get(ctx.actions.doctorTargetId);
  const copTarget = get(ctx.actions.copTargetId);

  const isProtectedFromNightKill = (id: string): boolean =>
    (beautyTarget?.id === id) || (doctorTarget?.id === id);

  const isWhiteMark = (p: ResolverPlayer | null) => p?.role === Role.WHITE_MARK;

  // --- Mafia kill ----------------------------------------------------------
  let mafiaKilledId: string | null = null;
  if (mafiaTarget && !isProtectedFromNightKill(mafiaTarget.id)) {
    if (isWhiteMark(mafiaTarget)) {
      // White Mark dies at night only if mafia AND maniac both hit it.
      if (maniacTarget?.id === mafiaTarget.id) {
        mafiaKilledId = mafiaTarget.id;
      }
    } else {
      mafiaKilledId = mafiaTarget.id;
    }
  }

  // --- Maniac kill ---------------------------------------------------------
  let maniacKilledId: string | null = null;
  if (maniacTarget && !isProtectedFromNightKill(maniacTarget.id)) {
    if (isWhiteMark(maniacTarget)) {
      if (mafiaTarget?.id === maniacTarget.id) {
        maniacKilledId = maniacTarget.id;
      }
    } else {
      maniacKilledId = maniacTarget.id;
    }
  }

  // --- Cop shot (ignores Beauty immunity and Doctor) -----------------------
  let copKilledId: string | null = null;
  if (
    copTarget &&
    (MAFIA_CLAN_ROLES.includes(copTarget.role) || copTarget.role === Role.MANIAC)
  ) {
    copKilledId = copTarget.id;
    // Avoid double-attribution in the summary if mafia/maniac also hit them.
    if (mafiaKilledId === copKilledId) mafiaKilledId = null;
    if (maniacKilledId === copKilledId) maniacKilledId = null;
  }

  // --- Delayed Commissar death (Don found him the previous night) ----------
  let donDelayedCommissarId: string | null = null;
  if (
    ctx.donFoundCommissar &&
    ctx.donFoundCommissarNightNumber != null &&
    ctx.nightNumber === ctx.donFoundCommissarNightNumber + 1
  ) {
    const commissar = ctx.players.find(
      (p) => p.role === Role.COMMISSAR && p.isAlive,
    );
    if (commissar) {
      donDelayedCommissarId = commissar.id;
    }
  }

  // --- Aggregate canonical deaths (one reason per player, for stats) -------
  const deaths = new Map<string, DeathReason>();
  if (mafiaKilledId) deaths.set(mafiaKilledId, DeathReason.MAFIA);
  if (maniacKilledId && !deaths.has(maniacKilledId)) {
    deaths.set(maniacKilledId, DeathReason.MANIAC);
  }
  if (copKilledId) deaths.set(copKilledId, DeathReason.COP);
  if (donDelayedCommissarId && !deaths.has(donDelayedCommissarId)) {
    deaths.set(donDelayedCommissarId, DeathReason.DON_DELAYED);
  }

  // --- Summary text (human-readable, no internals) -------------------------
  const lines: string[] = ['Итоги ночи:'];

  lines.push(
    mafiaKilledId
      ? `Мафия убила игрока ${get(mafiaKilledId)!.nickname}.`
      : 'Мафия никого не убила.',
  );

  lines.push(
    maniacKilledId
      ? `Маньяк убил игрока ${get(maniacKilledId)!.nickname}.`
      : 'Маньяк никого не убил.',
  );

  if (copKilledId) {
    const victim = get(copKilledId)!;
    lines.push(
      `Коп убил игрока ${victim.nickname}. Это был ${ROLE_LABEL[victim.role]}.`,
    );
  }

  if (donDelayedCommissarId) {
    lines.push(
      `Комиссар ${get(donDelayedCommissarId)!.nickname} погиб: Дон нашёл его ранее.`,
    );
  }

  const doctorSelfHealUsedNow =
    !!doctorTarget &&
    !!ctx.actions.doctorActorId &&
    doctorTarget.id === ctx.actions.doctorActorId;

  return {
    deaths: Array.from(deaths.entries()).map(([gamePlayerId, reason]) => ({
      gamePlayerId,
      reason,
    })),
    summaryText: lines.join('\n\n'),
    doctorSelfHealUsedNow,
  };
}
