import { Preferences } from '@capacitor/preferences';
import type { Game, GameListItem } from '~/types/game';
import {
  completeLocalDay,
  completeLocalNight,
  createLocalGame,
  finishLocalGame,
  getLocalDayCurrent,
  getLocalNightCurrent,
  saveLocalElimination,
  saveLocalNightAction,
  saveLocalNominations,
  startLocalDay,
  startLocalGame,
  startLocalNight,
  toLocalGameListItem,
  type LocalCreateGamePayload,
  type LocalNightActionPayload,
} from '~/utils/offline-game-engine';

export interface OfflineGameRecord {
  schemaVersion: 1;
  revision: number;
  syncedRevision: number;
  aggregate: Game;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
}

export interface PendingGameSnapshot {
  clientGameId: string;
  revision: number;
  aggregate: Game;
}

const KEY_PREFIX = 'mafia.offline.game.v1.';
let loadPromise: Promise<void> | null = null;
let mutationTail: Promise<void> = Promise.resolve();

function clone<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Неизвестная ошибка синхронизации.';
}

export function useOfflineGameRepository() {
  const records = useState<Record<string, OfflineGameRecord>>(
    'offline:games',
    () => ({}),
  );
  const loaded = useState<boolean>('offline:games:loaded', () => false);

  async function load(): Promise<void> {
    if (loaded.value) return;
    if (!import.meta.client) return;
    if (!loadPromise) {
      loadPromise = (async () => {
        const { keys } = await Preferences.keys();
        const next: Record<string, OfflineGameRecord> = {};
        for (const key of keys.filter((item) => item.startsWith(KEY_PREFIX))) {
          const { value } = await Preferences.get({ key });
          if (!value) continue;
          try {
            const record = JSON.parse(value) as OfflineGameRecord;
            if (
              record?.schemaVersion === 1 &&
              record.aggregate?.id &&
              Number.isInteger(record.revision)
            ) {
              next[record.aggregate.id] = record;
            }
          } catch {
            // Keep the rest of the local history usable if one record is corrupt.
          }
        }
        records.value = next;
        loaded.value = true;
      })().catch((error) => {
        loadPromise = null;
        throw error;
      });
    }
    await loadPromise;
  }

  async function persist(record: OfflineGameRecord): Promise<void> {
    await Preferences.set({
      key: `${KEY_PREFIX}${record.aggregate.id}`,
      value: JSON.stringify(record),
    });
  }

  async function exclusive<T>(work: () => Promise<T>): Promise<T> {
    const previous = mutationTail;
    let release!: () => void;
    mutationTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await work();
    } finally {
      release();
    }
  }

  function recordFor(gameId: string): OfflineGameRecord {
    const record = records.value[gameId];
    if (!record) {
      const error = new Error('Игра не найдена на этом устройстве.') as Error & {
        statusCode: number;
        data: { message: string };
      };
      error.statusCode = 404;
      error.data = { message: error.message };
      throw error;
    }
    return record;
  }

  async function mutate<T>(
    gameId: string,
    command: (game: Game) => T,
  ): Promise<T> {
    return exclusive(async () => {
      await load();
      const current = recordFor(gameId);
      const game = clone(current.aggregate);
      const result = command(game);
      const next: OfflineGameRecord = {
        ...current,
        revision: current.revision + 1,
        aggregate: game,
        lastSyncError: null,
      };
      await persist(next);
      records.value = { ...records.value, [gameId]: next };
      return clone(result);
    });
  }

  async function createGame(payload: LocalCreateGamePayload): Promise<Game> {
    return exclusive(async () => {
      await load();
      const game = createLocalGame(payload);
      const record: OfflineGameRecord = {
        schemaVersion: 1,
        revision: 1,
        syncedRevision: 0,
        aggregate: game,
        lastSyncedAt: null,
        lastSyncError: null,
      };
      await persist(record);
      records.value = { ...records.value, [game.id]: record };
      return clone(game);
    });
  }

  async function getGame(gameId: string): Promise<Game> {
    await load();
    return clone(recordFor(gameId).aggregate);
  }

  async function listGames(): Promise<GameListItem[]> {
    await load();
    return Object.values(records.value)
      .map((record) => toLocalGameListItem(record.aggregate))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async function pendingSnapshots(): Promise<PendingGameSnapshot[]> {
    await load();
    return Object.values(records.value)
      .filter((record) => record.syncedRevision < record.revision)
      .map((record) => ({
        clientGameId: record.aggregate.id,
        revision: record.revision,
        aggregate: clone(record.aggregate),
      }));
  }

  async function acknowledge(gameId: string, revision: number): Promise<void> {
    await exclusive(async () => {
      await load();
      const current = records.value[gameId];
      if (!current) return;
      const next: OfflineGameRecord = {
        ...current,
        syncedRevision: Math.max(current.syncedRevision, revision),
        lastSyncedAt: new Date().toISOString(),
        lastSyncError: current.revision <= revision ? null : current.lastSyncError,
      };
      await persist(next);
      records.value = { ...records.value, [gameId]: next };
    });
  }

  async function markSyncError(gameId: string, error: unknown): Promise<void> {
    await exclusive(async () => {
      await load();
      const current = records.value[gameId];
      if (!current) return;
      const next = { ...current, lastSyncError: messageOf(error) };
      await persist(next);
      records.value = { ...records.value, [gameId]: next };
    });
  }

  const pendingCount = computed(() =>
    Object.values(records.value).filter(
      (record) => record.syncedRevision < record.revision,
    ).length,
  );

  return {
    records,
    loaded,
    pendingCount,
    load,
    listGames,
    getGame,
    createGame,
    startGame: (gameId: string) => mutate(gameId, startLocalGame),
    finishGame: (gameId: string, body: { winnerClan: string; comment?: string }) =>
      mutate(gameId, (game) => finishLocalGame(game, body)),
    startNight: (gameId: string) => mutate(gameId, startLocalNight),
    getNightCurrent: async (gameId: string) => getLocalNightCurrent(await getGame(gameId)),
    saveNightAction: (
      gameId: string,
      nightId: string,
      body: LocalNightActionPayload,
    ) => mutate(gameId, (game) => saveLocalNightAction(game, nightId, body)),
    completeNight: (gameId: string, nightId: string) =>
      mutate(gameId, (game) => completeLocalNight(game, nightId)),
    startDay: (gameId: string) => mutate(gameId, startLocalDay),
    getDayCurrent: async (gameId: string) => getLocalDayCurrent(await getGame(gameId)),
    saveNominations: (gameId: string, dayId: string, playerIds: string[]) =>
      mutate(gameId, (game) => saveLocalNominations(game, dayId, playerIds)),
    eliminate: (gameId: string, dayId: string, playerId: string | null) =>
      mutate(gameId, (game) => saveLocalElimination(game, dayId, playerId)),
    completeDay: (gameId: string, dayId: string) =>
      mutate(gameId, (game) => completeLocalDay(game, dayId)),
    pendingSnapshots,
    acknowledge,
    markSyncError,
  };
}
