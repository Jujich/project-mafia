import { Clan, NightActionType, Role } from '@prisma/client';

export interface RoleDefinition {
  role: Role;
  label: string;
  clan: Clan;
  /** Can several players share this role in a single game. */
  canHaveMultiple: boolean;
  /** Optional roles are off by default in the setup wizard. */
  optional: boolean;
  /** Has a night action (wakes up and chooses a target). */
  hasNightAction: boolean;
  description: string;
}

export interface ClanDefinition {
  clan: Clan;
  label: string;
  description: string;
}

export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    role: Role.CIVILIAN,
    label: 'Мирный житель',
    clan: Clan.CIVILIANS,
    canHaveMultiple: true,
    optional: false,
    hasNightAction: false,
    description:
      'Обычный игрок без ночного действия. Участвует в обсуждении и голосовании.',
  },
  {
    role: Role.BEAUTY,
    label: 'Красотка',
    clan: Clan.CIVILIANS,
    canHaveMultiple: false,
    optional: false,
    hasNightAction: true,
    description:
      'Просыпается первой и даёт игроку иммунитет на эту ночь и следующий день. Себя выбрать не может.',
  },
  {
    role: Role.DOCTOR,
    label: 'Доктор',
    clan: Clan.CIVILIANS,
    canHaveMultiple: false,
    optional: false,
    hasNightAction: true,
    description:
      'Лечит одного игрока. Может спасти от мафии и маньяка. Себя может лечить один раз за игру.',
  },
  {
    role: Role.COMMISSAR,
    label: 'Комиссар',
    clan: Clan.CIVILIANS,
    canHaveMultiple: false,
    optional: false,
    hasNightAction: true,
    description: 'Проверяет игрока. Видит Мафию и Дона, но не видит Маньяка.',
  },
  {
    role: Role.COP,
    label: 'Коп',
    clan: Clan.CIVILIANS,
    canHaveMultiple: false,
    optional: false,
    hasNightAction: true,
    description:
      'Стреляет в игрока. Убивает Мафию, Дона или Маньяка даже под иммунитетом Красотки. Мирного — нет.',
  },
  {
    role: Role.JOURNALIST,
    label: 'Журналист',
    clan: Clan.CIVILIANS,
    canHaveMultiple: false,
    optional: true,
    hasNightAction: true,
    description:
      'Сравнивает кланы двух игроков: один клан или разные. Результат не объявляется публично.',
  },
  {
    role: Role.WHITE_MARK,
    label: 'Белая метка',
    clan: Clan.CIVILIANS,
    canHaveMultiple: false,
    optional: true,
    hasNightAction: false,
    description:
      'Не просыпается ночью. Гибнет ночью только если мафия и маньяк выбрали её одновременно.',
  },
  {
    role: Role.MAFIA,
    label: 'Мафия',
    clan: Clan.MAFIA,
    canHaveMultiple: true,
    optional: false,
    hasNightAction: true,
    description: 'Выбирает одну цель для убийства. Просыпается после Красотки.',
  },
  {
    role: Role.DON,
    label: 'Дон',
    clan: Clan.MAFIA,
    canHaveMultiple: false,
    optional: false,
    hasNightAction: true,
    description:
      'Ищет Комиссара. Если вся Мафия выбыла, выбирает цель убийства вместо неё и продолжает отдельно искать Комиссара. После того как нашёл Комиссара (или тот погиб), просыпается вместе с мафией.',
  },
  {
    role: Role.MANIAC,
    label: 'Маньяк',
    clan: Clan.MANIAC,
    canHaveMultiple: false,
    optional: false,
    hasNightAction: true,
    description: 'Играет сам за себя. Выбирает одну цель для убийства.',
  },
];

export const CLAN_DEFINITIONS: ClanDefinition[] = [
  {
    clan: Clan.CIVILIANS,
    label: 'Мирные',
    description:
      'Мирный житель, Красотка, Доктор, Комиссар, Коп, Журналист, Белая метка.',
  },
  {
    clan: Clan.MAFIA,
    label: 'Мафия',
    description: 'Мафия и Дон.',
  },
  {
    clan: Clan.MANIAC,
    label: 'Маньяк',
    description: 'Маньяк играет сам за себя.',
  },
];

export const ROLE_TO_CLAN: Record<Role, Clan> = ROLE_DEFINITIONS.reduce(
  (acc, def) => {
    acc[def.role] = def.clan;
    return acc;
  },
  {} as Record<Role, Clan>,
);

export const ROLE_LABEL: Record<Role, string> = ROLE_DEFINITIONS.reduce(
  (acc, def) => {
    acc[def.role] = def.label;
    return acc;
  },
  {} as Record<Role, string>,
);

export const CLAN_LABEL: Record<Clan, string> = CLAN_DEFINITIONS.reduce(
  (acc, def) => {
    acc[def.clan] = def.label;
    return acc;
  },
  {} as Record<Clan, string>,
);

export function clanForRole(role: Role): Clan {
  return ROLE_TO_CLAN[role];
}

/** Canonical night wake-up order (section 8). */
export const NIGHT_ROLE_ORDER: Role[] = [
  Role.BEAUTY,
  Role.MAFIA,
  Role.MANIAC,
  Role.DOCTOR,
  Role.COMMISSAR,
  Role.DON,
  Role.COP,
  Role.JOURNALIST,
];

/** Maps a wake-up step role to its primary night action type. */
export const ROLE_TO_ACTION_TYPE: Partial<Record<Role, NightActionType>> = {
  [Role.BEAUTY]: NightActionType.BEAUTY_IMMUNITY,
  [Role.MAFIA]: NightActionType.MAFIA_KILL,
  [Role.MANIAC]: NightActionType.MANIAC_KILL,
  [Role.DOCTOR]: NightActionType.DOCTOR_HEAL,
  [Role.COMMISSAR]: NightActionType.COMMISSAR_CHECK,
  [Role.DON]: NightActionType.DON_CHECK,
  [Role.COP]: NightActionType.COP_SHOOT,
  [Role.JOURNALIST]: NightActionType.JOURNALIST_COMPARE,
};

/**
 * Host-facing instruction texts (section 18). These are read out loud.
 * `MAFIA_WITH_DON` is the combined step shown once the Don acts with the mafia.
 */
export const HOST_TEXTS: Record<string, string> = {
  BEAUTY: [
    'Просыпается Красотка.',
    'Выбери игрока, которому Красотка даёт иммунитет.',
    'Себя Красотка выбрать не может.',
    'После выбора объяви всем: Красотка дала иммунитет игроку {ник}.',
  ].join('\n\n'),
  MAFIA: [
    'Просыпается Мафия.',
    'Мафия выбирает одного игрока для убийства.',
    'Если мафия не договорилась, выбери вариант «никого не убила».',
  ].join('\n\n'),
  MAFIA_WITH_DON: [
    'Просыпаются Мафия и Дон.',
    'Теперь Дон выбирает цель убийства для мафии.',
    'Отметь игрока, на которого указал Дон.',
  ].join('\n\n'),
  DON_MAFIA_KILL: [
    'Просыпается Дон вместо выбывшей Мафии.',
    'Дон выбирает одного игрока для убийства.',
    'Позже Дон проснётся в свой ход и продолжит искать Комиссара, если тот ещё жив.',
  ].join('\n\n'),
  MANIAC: [
    'Просыпается Маньяк.',
    'Маньяк выбирает одного игрока для убийства.',
  ].join('\n\n'),
  DOCTOR: [
    'Просыпается Доктор.',
    'Доктор выбирает, кого лечит этой ночью.',
    'Себя Доктор может лечить только один раз за игру.',
  ].join('\n\n'),
  COMMISSAR: [
    'Просыпается Комиссар.',
    'Комиссар проверяет одного игрока.',
    'Комиссар видит Мафию и Дона.',
    'Маньяка Комиссар не видит.',
  ].join('\n\n'),
  DON: [
    'Просыпается Дон.',
    'Дон ищет Комиссара.',
    'Если Дон нашёл Комиссара, это объявляется: скажи Дону «Да, это Комиссар».',
    'Комиссар живёт эту ночь, когда его нашли, и ещё одну следующую ночь.',
    'В эту следующую ночь Комиссар просыпается и может сделать ещё одну проверку, а после неё сразу умирает.',
    'В последнем слове Комиссар может рассказать всем мирным жителям всё, что он узнал. Но это только после следующей ночи.',
    'Со следующей ночи Дон просыпается вместе с мафией.',
  ].join('\n\n'),
  COP: [
    'Просыпается Коп.',
    'Коп выбирает одного игрока.',
    'Если это Мафия, Дон или Маньяк — игрок сразу умирает.',
    'Если это мирный игрок — ничего не происходит.',
  ].join('\n\n'),
  JOURNALIST: [
    'Просыпается Журналист.',
    'Журналист выбирает двух игроков и узнаёт: один это клан или разные кланы.',
    'Результат не объявляется публично.',
  ].join('\n\n'),
};
