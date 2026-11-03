import type {
  Clan,
  DeathReason,
  GamePhase,
  GameStatus,
  Role,
} from '~/types/game';

export const ROLE_LABELS: Record<Role, string> = {
  CIVILIAN: 'Мирный житель',
  MAFIA: 'Мафия',
  DON: 'Дон',
  MANIAC: 'Маньяк',
  DOCTOR: 'Доктор',
  COMMISSAR: 'Комиссар',
  BEAUTY: 'Красотка',
  COP: 'Коп',
  JOURNALIST: 'Журналист',
  WHITE_MARK: 'Белая метка',
};

export const CLAN_LABELS: Record<Clan, string> = {
  CIVILIANS: 'Мирные',
  MAFIA: 'Мафия',
  MANIAC: 'Маньяк',
};

/** NuxtUI badge color per clan. */
export const CLAN_COLOR: Record<Clan, string> = {
  CIVILIANS: 'green',
  MAFIA: 'red',
  MANIAC: 'orange',
};

export const STATUS_LABELS: Record<GameStatus, string> = {
  SETUP: 'Подготовка',
  IN_PROGRESS: 'Идёт игра',
  FINISHED: 'Завершена',
};

export const STATUS_COLOR = {
  SETUP: 'gray',
  IN_PROGRESS: 'green',
  FINISHED: 'primary',
} as const satisfies Record<GameStatus, 'gray' | 'green' | 'primary'>;

export const PHASE_LABELS: Record<GamePhase, string> = {
  SETUP: 'Подготовка',
  NIGHT: 'Ночь',
  DAY: 'День',
  FINISHED: 'Завершена',
};

export const DEATH_REASON_LABELS: Record<DeathReason, string> = {
  MAFIA: 'Убит мафией',
  MANIAC: 'Убит маньяком',
  COP: 'Застрелен Копом',
  DON_DELAYED: 'Найден Доном',
  VOTE: 'Вынесен голосованием',
};

export function roleLabel(role: Role): string {
  return ROLE_LABELS[role] ?? role;
}

export function clanLabel(clan: Clan): string {
  return CLAN_LABELS[clan] ?? clan;
}
