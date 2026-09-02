import type {
  Clan,
  Day,
  DayCurrent,
  DeathReason,
  Game,
  GameListItem,
  GamePlayer,
  NightActionFull,
  NightActionType,
  NightCurrent,
  NightStep,
  Role,
  SaveActionResponse,
  TargetOption,
} from '../types/game';
import { ROLE_LABELS } from './labels';

export interface LocalCreateGamePayload {
  title: string;
  playedAt?: string;
  players: { nickname: string; role: Role }[];
}

export interface LocalNightActionPayload {
  actionType: string;
  targetGamePlayerId?: string | null;
  secondTargetGamePlayerId?: string | null;
}

export class OfflineGameError extends Error {
  readonly statusCode = 400;
  readonly data: { message: string };

  constructor(message: string) {
    super(message);
    this.name = 'OfflineGameError';
    this.data = { message };
  }
}

const ROLE_TO_CLAN: Record<Role, Clan> = {
  CIVILIAN: 'CIVILIANS',
  BEAUTY: 'CIVILIANS',
  DOCTOR: 'CIVILIANS',
  COMMISSAR: 'CIVILIANS',
  COP: 'CIVILIANS',
  JOURNALIST: 'CIVILIANS',
  WHITE_MARK: 'CIVILIANS',
  MAFIA: 'MAFIA',
  DON: 'MAFIA',
  MANIAC: 'MANIAC',
};

const SINGLE_ROLES = new Set<Role>([
  'BEAUTY',
  'DOCTOR',
  'COMMISSAR',
  'COP',
  'JOURNALIST',
  'WHITE_MARK',
  'DON',
  'MANIAC',
]);

const HOST_TEXTS: Record<string, string> = {
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
  MANIAC: 'Просыпается Маньяк.\n\nМаньяк выбирает одну цель для убийства.',
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

function fail(message: string): never {
  throw new OfflineGameError(message);
}

function id(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function now(): string {
  return new Date().toISOString();
}

function touch(game: Game): void {
  game.updatedAt = now();
}

function stepPlayers(game: Game) {
  return game.players.map((player) => ({
    id: player.id,
    nickname: player.player.nickname,
    role: player.role,
    clan: player.clan,
    isAlive: player.isAlive,
  }));
}

type StepPlayer = ReturnType<typeof stepPlayers>[number];

function toTarget(player: StepPlayer): TargetOption {
  return {
    gamePlayerId: player.id,
    nickname: player.nickname,
    role: player.role,
    roleLabel: ROLE_LABELS[player.role],
  };
}

export function buildLocalNightSteps(game: Game): NightStep[] {
  const alive = stepPlayers(game).filter((player) => player.isAlive);
  const aliveOf = (role: Role) => alive.filter((player) => player.role === role);
  const first = (role: Role) => aliveOf(role)[0];

  const beauty = first('BEAUTY');
  const hasAliveMafia = aliveOf('MAFIA').length > 0;
  const don = first('DON');
  const maniac = first('MANIAC');
  const doctor = first('DOCTOR');
  const commissar = first('COMMISSAR');
  const cop = first('COP');
  const journalist = first('JOURNALIST');
  const donActsWithMafia = game.donActsWithMafia && !!don;
  const donReplacesMafia = !!don && !hasAliveMafia;
  const donPerformsMafiaKill = donActsWithMafia || donReplacesMafia;
  const allAlive = alive.map(toTarget);
  const aliveExcept = (playerId: string) =>
    alive.filter((player) => player.id !== playerId).map(toTarget);
  const steps: NightStep[] = [];

  if (beauty) {
    steps.push({
      key: 'BEAUTY', role: 'BEAUTY', actionType: 'BEAUTY_IMMUNITY',
      title: 'Красотка', hostText: HOST_TEXTS.BEAUTY,
      actorNickname: beauty.nickname, selection: 'single', allowNoTarget: false,
      requiresAction: true, eligibleTargets: aliveExcept(beauty.id), savedAction: null,
    });
  }
  if (hasAliveMafia || donPerformsMafiaKill) {
    steps.push({
      key: 'MAFIA', role: 'MAFIA', actionType: 'MAFIA_KILL',
      title: donReplacesMafia ? 'Дон (убийство)' : donActsWithMafia ? 'Мафия и Дон' : 'Мафия',
      hostText: donReplacesMafia ? HOST_TEXTS.DON_MAFIA_KILL : donActsWithMafia ? HOST_TEXTS.MAFIA_WITH_DON : HOST_TEXTS.MAFIA,
      actorNickname: donPerformsMafiaKill ? don?.nickname ?? null : aliveOf('MAFIA')[0]?.nickname ?? null,
      selection: 'single', allowNoTarget: true, requiresAction: true,
      eligibleTargets: allAlive, savedAction: null,
    });
  }
  if (maniac) {
    steps.push({
      key: 'MANIAC', role: 'MANIAC', actionType: 'MANIAC_KILL', title: 'Маньяк',
      hostText: HOST_TEXTS.MANIAC, actorNickname: maniac.nickname,
      selection: 'single', allowNoTarget: true, requiresAction: true,
      eligibleTargets: allAlive, savedAction: null,
    });
  }
  if (doctor) {
    steps.push({
      key: 'DOCTOR', role: 'DOCTOR', actionType: 'DOCTOR_HEAL', title: 'Доктор',
      hostText: HOST_TEXTS.DOCTOR, actorNickname: doctor.nickname,
      selection: 'single', allowNoTarget: true, requiresAction: true,
      eligibleTargets: game.doctorSelfHealUsed ? aliveExcept(doctor.id) : allAlive,
      savedAction: null,
    });
  }
  if (commissar) {
    steps.push({
      key: 'COMMISSAR', role: 'COMMISSAR', actionType: 'COMMISSAR_CHECK',
      title: 'Комиссар', hostText: HOST_TEXTS.COMMISSAR,
      actorNickname: commissar.nickname, selection: 'single', allowNoTarget: false,
      requiresAction: true, eligibleTargets: aliveExcept(commissar.id), savedAction: null,
    });
  }
  if (don && !donActsWithMafia) {
    steps.push({
      key: 'DON', role: 'DON', actionType: 'DON_CHECK', title: 'Дон',
      hostText: HOST_TEXTS.DON, actorNickname: don.nickname,
      selection: 'single', allowNoTarget: true, requiresAction: true,
      eligibleTargets: aliveExcept(don.id), savedAction: null,
    });
  }
  if (cop) {
    steps.push({
      key: 'COP', role: 'COP', actionType: 'COP_SHOOT', title: 'Коп',
      hostText: HOST_TEXTS.COP, actorNickname: cop.nickname,
      selection: 'single', allowNoTarget: true, requiresAction: true,
      eligibleTargets: aliveExcept(cop.id), savedAction: null,
    });
  }
  if (journalist) {
    steps.push({
      key: 'JOURNALIST', role: 'JOURNALIST', actionType: 'JOURNALIST_COMPARE',
      title: 'Журналист', hostText: HOST_TEXTS.JOURNALIST,
      actorNickname: journalist.nickname, selection: 'double', allowNoTarget: false,
      requiresAction: true, eligibleTargets: aliveExcept(journalist.id), savedAction: null,
    });
  }
  return steps;
}

function activeNight(game: Game) {
  const night = [...game.nights].reverse().find((item) => item.status === 'IN_PROGRESS');
  if (!night) fail('Нет активной ночи.');
  return night;
}

function activeDay(game: Game) {
  const day = [...game.days].reverse().find((item) => item.status === 'IN_PROGRESS');
  if (!day) fail('Нет активного дня.');
  return day;
}

function actorId(step: NightStep, players: StepPlayer[]): string | null {
  const alive = players.filter((player) => player.isAlive);
  if (step.actionType === 'MAFIA_KILL') {
    const don = alive.find((player) => player.role === 'DON');
    if (step.title.includes('Дон') && don) return don.id;
    return alive.find((player) => player.role === 'MAFIA')?.id ?? don?.id ?? null;
  }
  return alive.find((player) => player.role === step.role)?.id ?? null;
}

function actionFeedback(
  actionType: NightActionType,
  target: StepPlayer | null,
  secondTarget: StepPlayer | null,
) {
  if (actionType === 'BEAUTY_IMMUNITY') {
    return {
      result: null,
      publicText: target
        ? `Красотка дала иммунитет игроку ${target.nickname}. Этого игрока нельзя убить этой ночью, нельзя выставить и вынести днём. Игрок молчит в обсуждении, но может выставить другого игрока.`
        : null,
      privateText: null,
    };
  }
  if (actionType === 'COMMISSAR_CHECK') {
    if (!target) return { result: null, publicText: null, privateText: null };
    const mafia = target.clan === 'MAFIA';
    return {
      result: mafia ? 'MAFIA' : 'NOT_MAFIA',
      publicText: mafia ? 'Комиссар нашёл мафию.' : null,
      privateText: mafia ? 'Это мафия.' : 'Это не мафия.',
    };
  }
  if (actionType === 'DON_CHECK') {
    if (!target) return { result: 'NONE', publicText: null, privateText: null };
    const found = target.role === 'COMMISSAR';
    return {
      result: found ? 'FOUND' : 'NOT_FOUND', publicText: null,
      privateText: found
        ? 'Дон нашёл Комиссара. Комиссар живёт эту ночь и ещё одну следующую ночь; после неё сразу умирает. Со следующей ночи Дон просыпается вместе с мафией.'
        : 'Это не Комиссар.',
    };
  }
  if (actionType === 'JOURNALIST_COMPARE') {
    if (!target || !secondTarget) return { result: null, publicText: null, privateText: null };
    const same = target.clan === secondTarget.clan;
    return {
      result: same ? 'SAME_CLAN' : 'DIFFERENT_CLAN', publicText: null,
      privateText: same
        ? 'Скажи Журналисту: эти игроки из одного клана.'
        : 'Скажи Журналисту: эти игроки из разных кланов.',
    };
  }
  if (actionType === 'COP_SHOOT') {
    if (!target) return { result: 'NONE', publicText: null, privateText: null };
    const hit = target.role === 'MAFIA' || target.role === 'DON' || target.role === 'MANIAC';
    return {
      result: hit ? 'HIT' : 'MISS', publicText: null,
      privateText: hit
        ? `Коп попал в игрока ${target.nickname}. Объяви, что Коп попал.`
        : 'Коп выбрал мирного игрока. Ничего не произойдёт.',
    };
  }
  return { result: null, publicText: null, privateText: null };
}

export function createLocalGame(payload: LocalCreateGamePayload): Game {
  const title = payload.title.trim();
  if (!title) fail('Название игры не может быть пустым.');
  if (!payload.players.length) fail('Нельзя создать игру без игроков.');
  const seen = new Set<string>();
  const roleCounts = new Map<Role, number>();
  for (const assignment of payload.players) {
    const nickname = assignment.nickname.trim().toLowerCase();
    if (!nickname) fail('Ник игрока не может быть пустым.');
    if (seen.has(nickname)) fail(`Ник «${assignment.nickname.trim()}» повторяется.`);
    seen.add(nickname);
    roleCounts.set(assignment.role, (roleCounts.get(assignment.role) ?? 0) + 1);
  }
  for (const role of SINGLE_ROLES) {
    if ((roleCounts.get(role) ?? 0) > 1) {
      fail(`Роль «${ROLE_LABELS[role]}» может быть только у одного игрока.`);
    }
  }
  const gameId = id();
  const createdAt = now();
  return {
    id: gameId,
    title,
    status: 'SETUP',
    startedAt: null,
    finishedAt: null,
    winnerClan: null,
    hostComment: null,
    currentPhase: 'SETUP',
    currentNightNumber: 0,
    currentDayNumber: 0,
    donFoundCommissar: false,
    donFoundCommissarNightNumber: null,
    donActsWithMafia: false,
    doctorSelfHealUsed: false,
    createdAt,
    updatedAt: createdAt,
    playedAt: payload.playedAt ?? createdAt,
    players: payload.players.map((assignment) => {
      const playerId = id();
      return {
        id: id(), gameId, playerId,
        role: assignment.role,
        clan: ROLE_TO_CLAN[assignment.role],
        isAlive: true,
        deathPhase: null,
        deathReason: null,
        deathNightNumber: null,
        deathDayNumber: null,
        player: { id: playerId, nickname: assignment.nickname.trim() },
      } satisfies GamePlayer;
    }),
    nights: [],
    days: [],
  };
}

export function startLocalGame(game: Game): Game {
  if (game.status !== 'SETUP') fail('Игра уже запущена или завершена.');
  game.status = 'IN_PROGRESS';
  game.startedAt = now();
  touch(game);
  return game;
}

export function finishLocalGame(
  game: Game,
  body: { winnerClan: string; comment?: string },
): Game {
  if (game.status === 'FINISHED') fail('Игра уже завершена.');
  if (!['CIVILIANS', 'MAFIA', 'MANIAC'].includes(body.winnerClan)) {
    fail('Некорректный победивший клан.');
  }
  game.status = 'FINISHED';
  game.currentPhase = 'FINISHED';
  game.finishedAt = now();
  game.winnerClan = body.winnerClan as Clan;
  game.hostComment = body.comment?.trim() || null;
  touch(game);
  return game;
}

export function startLocalNight(game: Game): NightCurrent {
  if (game.status !== 'IN_PROGRESS') fail('Игра должна быть запущена, чтобы начать ночь.');
  if (game.nights.some((night) => night.status === 'IN_PROGRESS')) {
    fail('Предыдущая ночь ещё не завершена.');
  }
  if (game.currentNightNumber !== game.currentDayNumber) {
    fail('Сначала завершите текущий день, затем начинайте следующую ночь.');
  }
  const nextNumber = game.currentNightNumber + 1;
  const commissar = game.players.find((player) => player.role === 'COMMISSAR');
  const commissarDead = !!commissar && !commissar.isAlive;
  const donFoundEarlier = game.donFoundCommissar &&
    game.donFoundCommissarNightNumber != null &&
    nextNumber > game.donFoundCommissarNightNumber;
  game.donActsWithMafia = game.donActsWithMafia || donFoundEarlier || commissarDead;
  game.currentPhase = 'NIGHT';
  game.currentNightNumber = nextNumber;
  game.nights.push({
    id: id(), number: nextNumber, status: 'IN_PROGRESS', summaryText: null,
    actions: [], createdAt: now(), completedAt: null,
  });
  touch(game);
  return getLocalNightCurrent(game);
}

export function getLocalNightCurrent(game: Game): NightCurrent {
  const night = activeNight(game);
  const savedByType = new Map(night.actions.map((action) => [action.actionType, action]));
  return {
    night: { id: night.id, number: night.number, status: night.status, summaryText: night.summaryText },
    donActsWithMafia: game.donActsWithMafia,
    steps: buildLocalNightSteps(game).map((step) => {
      const action = savedByType.get(step.actionType);
      return {
        ...step,
        savedAction: action ? {
          id: action.id,
          targetGamePlayerId: action.targetGamePlayerId,
          secondTargetGamePlayerId: action.secondTargetGamePlayerId,
          result: action.result,
          publicText: action.publicText,
          privateText: action.privateText,
        } : null,
      };
    }),
  };
}

export function saveLocalNightAction(
  game: Game,
  nightId: string,
  body: LocalNightActionPayload,
): SaveActionResponse {
  const night = activeNight(game);
  if (night.id !== nightId) fail('Ночь не найдена.');
  const actionType = body.actionType as NightActionType;
  const steps = buildLocalNightSteps(game);
  const step = steps.find((item) => item.actionType === actionType);
  if (!step) fail('Эта роль сейчас не просыпается и не может действовать.');
  const players = stepPlayers(game);
  let target: StepPlayer | null = null;
  if (body.targetGamePlayerId) {
    if (!step.eligibleTargets.some((item) => item.gamePlayerId === body.targetGamePlayerId)) {
      fail('Нельзя выбрать этого игрока: он недоступен как цель действия.');
    }
    target = players.find((player) => player.id === body.targetGamePlayerId) ?? null;
  } else if (!step.allowNoTarget && step.selection !== 'none') {
    fail(`Для шага «${step.title}» нужно выбрать игрока.`);
  }
  let secondTarget: StepPlayer | null = null;
  if (step.selection === 'double') {
    if (!body.targetGamePlayerId || !body.secondTargetGamePlayerId) {
      fail('Журналист должен выбрать двух игроков.');
    }
    if (body.targetGamePlayerId === body.secondTargetGamePlayerId) {
      fail('Журналист должен выбрать двух разных игроков.');
    }
    if (!step.eligibleTargets.some((item) => item.gamePlayerId === body.secondTargetGamePlayerId)) {
      fail('Вторая цель недоступна для проверки Журналиста.');
    }
    secondTarget = players.find((player) => player.id === body.secondTargetGamePlayerId) ?? null;
  }
  const actingId = actorId(step, players);
  if (actionType === 'DOCTOR_HEAL' && target?.id === actingId && game.doctorSelfHealUsed) {
    fail('Доктор уже использовал самолечение в этой игре.');
  }
  const feedback = actionFeedback(actionType, target, secondTarget);
  if (actionType === 'DON_CHECK') {
    if (feedback.result === 'FOUND') {
      game.donFoundCommissar = true;
      game.donFoundCommissarNightNumber = night.number;
    } else if (game.donFoundCommissarNightNumber === night.number) {
      game.donFoundCommissar = false;
      game.donFoundCommissarNightNumber = null;
    }
  }
  const action: NightActionFull = {
    id: id(), actionType, actorRole: step.role, actorGamePlayerId: actingId,
    targetGamePlayerId: target?.id ?? null,
    secondTargetGamePlayerId: secondTarget?.id ?? null,
    result: feedback.result,
    publicText: feedback.publicText,
    privateText: feedback.privateText,
  };
  night.actions = night.actions.filter((item) => item.actionType !== actionType);
  night.actions.push(action);
  touch(game);
  return {
    action: {
      id: action.id, actionType,
      targetGamePlayerId: action.targetGamePlayerId,
      secondTargetGamePlayerId: action.secondTargetGamePlayerId,
      result: action.result, publicText: action.publicText, privateText: action.privateText,
    },
    feedback,
  };
}

function resolveLocalNight(game: Game, night: Game['nights'][number]) {
  const byType = (type: NightActionType) =>
    night.actions.find((action) => action.actionType === type) ?? null;
  const players = stepPlayers(game);
  const byId = new Map(players.map((player) => [player.id, player]));
  const get = (playerId?: string | null) => playerId ? byId.get(playerId) ?? null : null;
  const beauty = get(byType('BEAUTY_IMMUNITY')?.targetGamePlayerId);
  const mafia = get(byType('MAFIA_KILL')?.targetGamePlayerId);
  const maniac = get(byType('MANIAC_KILL')?.targetGamePlayerId);
  const doctorAction = byType('DOCTOR_HEAL');
  const doctor = get(doctorAction?.targetGamePlayerId);
  const cop = get(byType('COP_SHOOT')?.targetGamePlayerId);
  const protectedFromKill = (playerId: string) => beauty?.id === playerId || doctor?.id === playerId;
  let mafiaKilled: string | null = null;
  if (mafia && !protectedFromKill(mafia.id)) {
    if (mafia.role !== 'WHITE_MARK' || maniac?.id === mafia.id) mafiaKilled = mafia.id;
  }
  let maniacKilled: string | null = null;
  if (maniac && !protectedFromKill(maniac.id)) {
    if (maniac.role !== 'WHITE_MARK' || mafia?.id === maniac.id) maniacKilled = maniac.id;
  }
  let copKilled: string | null = null;
  if (cop && (cop.role === 'MAFIA' || cop.role === 'DON' || cop.role === 'MANIAC')) {
    copKilled = cop.id;
    if (mafiaKilled === copKilled) mafiaKilled = null;
    if (maniacKilled === copKilled) maniacKilled = null;
  }
  let delayed: string | null = null;
  if (game.donFoundCommissar && game.donFoundCommissarNightNumber != null &&
      night.number === game.donFoundCommissarNightNumber + 1) {
    delayed = players.find((player) => player.role === 'COMMISSAR' && player.isAlive)?.id ?? null;
  }
  const deaths = new Map<string, DeathReason>();
  if (mafiaKilled) deaths.set(mafiaKilled, 'MAFIA');
  if (maniacKilled && !deaths.has(maniacKilled)) deaths.set(maniacKilled, 'MANIAC');
  if (copKilled) deaths.set(copKilled, 'COP');
  if (delayed && !deaths.has(delayed)) deaths.set(delayed, 'DON_DELAYED');
  const lines = ['Итоги ночи:'];
  lines.push(mafiaKilled ? `Мафия убила игрока ${get(mafiaKilled)!.nickname}.` : 'Мафия никого не убила.');
  lines.push(maniacKilled ? `Маньяк убил игрока ${get(maniacKilled)!.nickname}.` : 'Маньяк никого не убил.');
  if (copKilled) lines.push(`Коп убил игрока ${get(copKilled)!.nickname}. Это был ${ROLE_LABELS[get(copKilled)!.role]}.`);
  if (delayed) lines.push(`Комиссар ${get(delayed)!.nickname} погиб: Дон нашёл его ранее.`);
  return {
    deaths,
    summaryText: lines.join('\n\n'),
    doctorSelfHealUsedNow: !!doctor && !!doctorAction?.actorGamePlayerId && doctor.id === doctorAction.actorGamePlayerId,
  };
}

export function completeLocalNight(game: Game, nightId: string): Game {
  const night = activeNight(game);
  if (night.id !== nightId) fail('Ночь не найдена.');
  const steps = buildLocalNightSteps(game);
  const saved = new Set(night.actions.map((action) => action.actionType));
  const missing = steps.filter((step) => step.requiresAction && !saved.has(step.actionType)).map((step) => step.title);
  if (missing.length) fail(`Заполните действия ролей перед завершением ночи: ${missing.join(', ')}.`);
  const result = resolveLocalNight(game, night);
  for (const [playerId, reason] of result.deaths) {
    const player = game.players.find((item) => item.id === playerId)!;
    player.isAlive = false;
    player.deathPhase = 'NIGHT';
    player.deathReason = reason;
    player.deathNightNumber = night.number;
    if (reason === 'DON_DELAYED') {
      night.actions.push({
        id: id(), actionType: 'DON_DELAYED_KILL', actorRole: 'DON',
        actorGamePlayerId: game.players.find((item) => item.role === 'DON')?.id ?? null,
        targetGamePlayerId: playerId, secondTargetGamePlayerId: null,
        result: 'KILLED', publicText: null, privateText: null,
      });
    }
  }
  if (result.doctorSelfHealUsedNow) game.doctorSelfHealUsed = true;
  night.status = 'COMPLETED';
  night.summaryText = result.summaryText;
  night.completedAt = now();
  touch(game);
  return game;
}

export function startLocalDay(game: Game): DayCurrent {
  if (game.status !== 'IN_PROGRESS') fail('Игра должна быть запущена.');
  if (game.days.some((day) => day.status === 'IN_PROGRESS')) fail('Текущий день ещё не завершён.');
  if (game.currentDayNumber >= game.currentNightNumber) {
    fail('Сначала проведите и завершите ночь, затем начинайте день.');
  }
  const lastNight = game.nights.find((night) => night.number === game.currentNightNumber);
  if (!lastNight || lastNight.status !== 'COMPLETED') fail('Завершите ночь перед началом дня.');
  const timestamp = now();
  game.currentPhase = 'DAY';
  game.currentDayNumber = game.currentNightNumber;
  game.days.push({
    id: id(), number: game.currentDayNumber, status: 'IN_PROGRESS',
    discussionStartedAt: timestamp, discussionEndedAt: null,
    nominations: [], elimination: null, createdAt: timestamp, completedAt: null,
  });
  touch(game);
  return getLocalDayCurrent(game);
}

export function getLocalDayCurrent(game: Game): DayCurrent {
  const day = activeDay(game);
  const night = game.nights.find((item) => item.number === day.number);
  const immuneId = night?.actions.find((action) => action.actionType === 'BEAUTY_IMMUNITY')?.targetGamePlayerId ?? null;
  const immune = immuneId ? game.players.find((player) => player.id === immuneId) : null;
  return {
    day: {
      id: day.id, number: day.number, status: day.status,
      discussionStartedAt: day.discussionStartedAt,
      discussionEndedAt: day.discussionEndedAt,
    },
    nightSummary: night?.summaryText ?? null,
    deathsLastNight: game.players
      .filter((player) => player.deathPhase === 'NIGHT' && player.deathNightNumber === day.number)
      .map((player) => ({
        gamePlayerId: player.id, nickname: player.player.nickname,
        role: player.role, roleLabel: ROLE_LABELS[player.role], deathReason: player.deathReason,
      })),
    immunePlayer: immune?.isAlive ? { gamePlayerId: immune.id, nickname: immune.player.nickname } : null,
    nominationCandidates: game.players
      .filter((player) => player.isAlive && player.id !== immuneId)
      .map((player) => ({
        gamePlayerId: player.id, nickname: player.player.nickname,
        role: player.role, roleLabel: ROLE_LABELS[player.role],
      })),
    nominations: day.nominations
      .slice()
      .sort((a, b) => ((a as any).order ?? 0) - ((b as any).order ?? 0))
      .map((nomination) => ({
        gamePlayerId: nomination.nomineeGamePlayerId,
        nickname: nomination.nominee.player.nickname,
        order: (nomination as any).order ?? day.nominations.indexOf(nomination) + 1,
      })),
    elimination: day.elimination ? {
      eliminatedGamePlayerId: day.elimination.eliminatedGamePlayerId,
      nickname: day.elimination.eliminated?.player.nickname ?? null,
      reason: day.elimination.reason,
    } : null,
  };
}

export function saveLocalNominations(game: Game, dayId: string, ids: string[]): DayCurrent {
  const day = activeDay(game);
  if (day.id !== dayId) fail('День не найден.');
  const unique = [...new Set(ids)];
  if (!unique.length) fail('Выберите хотя бы одного кандидата.');
  if (unique.length > 5) fail('Можно выставить не более 5 кандидатов.');
  const night = game.nights.find((item) => item.number === day.number);
  const immuneId = night?.actions.find((action) => action.actionType === 'BEAUTY_IMMUNITY')?.targetGamePlayerId ?? null;
  day.nominations = unique.map((playerId, index) => {
    const player = game.players.find((item) => item.id === playerId);
    if (!player) fail('Игрок не найден в этой игре.');
    if (!player.isAlive) fail(`Нельзя выставить выбывшего игрока (${player.player.nickname}).`);
    if (playerId === immuneId) fail(`Игрок ${player.player.nickname} под иммунитетом Красотки.`);
    return {
      id: id(), nomineeGamePlayerId: playerId, nominee: player, order: index + 1,
    } as Day['nominations'][number];
  });
  touch(game);
  return getLocalDayCurrent(game);
}

export function saveLocalElimination(
  game: Game,
  dayId: string,
  eliminatedGamePlayerId: string | null,
): DayCurrent {
  const day = activeDay(game);
  if (day.id !== dayId) fail('День не найден.');
  const existingId = day.elimination?.eliminatedGamePlayerId;
  if (existingId) {
    const previous = game.players.find((player) => player.id === existingId);
    if (previous) {
      previous.isAlive = true;
      previous.deathPhase = null;
      previous.deathReason = null;
      previous.deathDayNumber = null;
    }
  }
  const eliminated = eliminatedGamePlayerId
    ? game.players.find((player) => player.id === eliminatedGamePlayerId) ?? null
    : null;
  if (eliminatedGamePlayerId) {
    if (!day.nominations.some((nomination) => nomination.nomineeGamePlayerId === eliminatedGamePlayerId)) {
      fail('Вынести можно только игрока из списка кандидатов.');
    }
    if (!eliminated?.isAlive) fail('Этот игрок уже выбыл.');
  }
  day.elimination = {
    id: day.elimination?.id ?? id(),
    eliminatedGamePlayerId,
    reason: eliminatedGamePlayerId ? 'VOTE' : 'NO_ELIMINATION',
    eliminated,
  };
  if (eliminated) {
    eliminated.isAlive = false;
    eliminated.deathPhase = 'DAY';
    eliminated.deathReason = 'VOTE';
    eliminated.deathDayNumber = day.number;
  }
  touch(game);
  return getLocalDayCurrent(game);
}

export function completeLocalDay(game: Game, dayId: string): Game {
  const day = activeDay(game);
  if (day.id !== dayId) fail('День не найден.');
  if (!day.elimination) fail('Сначала отметьте результат голосования (или «никого не вынесли»).');
  const timestamp = now();
  day.status = 'COMPLETED';
  day.discussionEndedAt ||= timestamp;
  day.completedAt = timestamp;
  touch(game);
  return game;
}

export function toLocalGameListItem(game: Game): GameListItem {
  return {
    id: game.id, title: game.title, status: game.status,
    currentPhase: game.currentPhase, startedAt: game.startedAt,
    finishedAt: game.finishedAt, winnerClan: game.winnerClan,
    playersCount: game.players.length, createdAt: game.createdAt,
  };
}
