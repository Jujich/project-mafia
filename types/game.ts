// Shared types mirroring the backend API responses.

export type Role =
  | 'CIVILIAN'
  | 'MAFIA'
  | 'DON'
  | 'MANIAC'
  | 'DOCTOR'
  | 'COMMISSAR'
  | 'BEAUTY'
  | 'COP'
  | 'JOURNALIST'
  | 'WHITE_MARK';

export type Clan = 'CIVILIANS' | 'MAFIA' | 'MANIAC';
export type GameStatus = 'SETUP' | 'IN_PROGRESS' | 'FINISHED';
export type GamePhase = 'SETUP' | 'NIGHT' | 'DAY' | 'FINISHED';
export type DeathPhase = 'NIGHT' | 'DAY';
export type DeathReason = 'MAFIA' | 'MANIAC' | 'COP' | 'DON_DELAYED' | 'VOTE';

export type NightActionType =
  | 'BEAUTY_IMMUNITY'
  | 'MAFIA_KILL'
  | 'MANIAC_KILL'
  | 'DOCTOR_HEAL'
  | 'COMMISSAR_CHECK'
  | 'DON_CHECK'
  | 'COP_SHOOT'
  | 'JOURNALIST_COMPARE'
  | 'WHITE_MARK_WAKE'
  | 'DON_DELAYED_KILL';

export interface RoleDefinition {
  role: Role;
  label: string;
  clan: Clan;
  canHaveMultiple: boolean;
  optional: boolean;
  hasNightAction: boolean;
  description: string;
}

export interface ClanDefinition {
  clan: Clan;
  label: string;
  description: string;
}

export interface PlayerRef {
  id: string;
  nickname: string;
}

export interface GamePlayer {
  id: string;
  gameId: string;
  playerId: string;
  role: Role;
  clan: Clan;
  isAlive: boolean;
  deathPhase: DeathPhase | null;
  deathReason: DeathReason | null;
  deathNightNumber: number | null;
  deathDayNumber: number | null;
  player: PlayerRef;
}

export interface NightActionFull {
  id: string;
  actionType: NightActionType;
  actorRole: Role;
  targetGamePlayerId: string | null;
  secondTargetGamePlayerId: string | null;
  result: string | null;
  publicText: string | null;
  privateText: string | null;
  target?: GamePlayer | null;
  secondTarget?: GamePlayer | null;
}

export interface Night {
  id: string;
  number: number;
  status: 'IN_PROGRESS' | 'COMPLETED';
  summaryText: string | null;
  actions: NightActionFull[];
}

export interface VoteNomination {
  id: string;
  nomineeGamePlayerId: string;
  nominee: GamePlayer;
}

export interface DayElimination {
  id: string;
  eliminatedGamePlayerId: string | null;
  reason: 'VOTE' | 'NO_ELIMINATION';
  eliminated?: GamePlayer | null;
}

export interface Day {
  id: string;
  number: number;
  status: 'IN_PROGRESS' | 'COMPLETED';
  discussionStartedAt: string | null;
  discussionEndedAt: string | null;
  nominations: VoteNomination[];
  elimination: DayElimination | null;
}

export interface Game {
  id: string;
  title: string;
  status: GameStatus;
  startedAt: string | null;
  finishedAt: string | null;
  winnerClan: Clan | null;
  hostComment: string | null;
  currentPhase: GamePhase;
  currentNightNumber: number;
  currentDayNumber: number;
  donFoundCommissar: boolean;
  donFoundCommissarNightNumber: number | null;
  donActsWithMafia: boolean;
  doctorSelfHealUsed: boolean;
  createdAt: string;
  updatedAt: string;
  players: GamePlayer[];
  nights: Night[];
  days: Day[];
}

export interface GameListItem {
  id: string;
  title: string;
  status: GameStatus;
  currentPhase: GamePhase;
  startedAt: string | null;
  finishedAt: string | null;
  winnerClan: Clan | null;
  playersCount: number;
  createdAt: string;
}

export interface TargetOption {
  gamePlayerId: string;
  nickname: string;
  role: Role;
  roleLabel: string;
}

export interface SavedNightAction {
  id: string;
  targetGamePlayerId: string | null;
  secondTargetGamePlayerId: string | null;
  result: string | null;
  publicText: string | null;
  privateText: string | null;
}

export interface NightStep {
  key: string;
  role: Role;
  actionType: NightActionType;
  title: string;
  hostText: string;
  selection: 'single' | 'double' | 'none';
  allowNoTarget: boolean;
  requiresAction: boolean;
  eligibleTargets: TargetOption[];
  savedAction: SavedNightAction | null;
}

export interface NightCurrent {
  night: {
    id: string;
    number: number;
    status: 'IN_PROGRESS' | 'COMPLETED';
    summaryText: string | null;
  };
  donActsWithMafia: boolean;
  steps: NightStep[];
}

export interface SaveActionResponse {
  action: SavedNightAction & { actionType: NightActionType };
  feedback: {
    result: string | null;
    publicText: string | null;
    privateText: string | null;
  };
}

export interface DayDeath {
  gamePlayerId: string;
  nickname: string;
  role: Role;
  roleLabel: string;
  deathReason: DeathReason | null;
}

export interface DayCurrent {
  day: {
    id: string;
    number: number;
    status: 'IN_PROGRESS' | 'COMPLETED';
    discussionStartedAt: string | null;
    discussionEndedAt: string | null;
  };
  nightSummary: string | null;
  deathsLastNight: DayDeath[];
  immunePlayer: { gamePlayerId: string; nickname: string } | null;
  nominationCandidates: TargetOption[];
  nominations: { gamePlayerId: string; nickname: string }[];
  elimination: {
    eliminatedGamePlayerId: string | null;
    nickname: string | null;
    reason: 'VOTE' | 'NO_ELIMINATION';
  } | null;
}
