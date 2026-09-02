import type {
  DayCurrent,
  Game,
  NightCurrent,
  Role,
  SaveActionResponse,
} from '~/types/game';

export interface CreateGamePayload {
  title: string;
  playedAt?: string;
  players: { nickname: string; role: Role }[];
}

function extractMessage(err: any): string {
  const d = err?.data;
  const candidate =
    d?.statusMessage || d?.message || d?.data?.message || err?.statusMessage;
  if (Array.isArray(candidate)) return candidate.join('. ');
  return candidate || 'Произошла ошибка. Попробуйте ещё раз.';
}

export function useGameApi() {
  const toast = useToast();
  const config = useRuntimeConfig();
  const localMode = Boolean(config.public.localGameMode);
  const local = useOfflineGameRepository();
  const sync = useGameSync();

  async function execute<T>(request: () => Promise<T>): Promise<T> {
    try {
      return await request();
    } catch (err: any) {
      const status = err?.statusCode || err?.response?.status;
      if (status === 401) {
        // Session expired / not authorized — back to the login gate.
        useAuth().loggedIn.value = false;
        await navigateTo('/login');
        throw err;
      }
      toast.add({
        title: 'Ошибка',
        description: extractMessage(err),
        color: 'red',
        icon: 'i-heroicons-exclamation-triangle',
      });
      throw err;
    }
  }

  async function call<T>(url: string, opts: any = {}): Promise<T> {
    return execute(() => $fetch(url, opts) as Promise<T>);
  }

  async function localMutation<T>(request: () => Promise<T>): Promise<T> {
    const result = await execute(request);
    void sync.syncPending();
    return result;
  }

  return {
    call,

    createGame: (payload: CreateGamePayload) => localMode
      ? localMutation(() => local.createGame(payload))
      : call<Game>('/api/games', { method: 'POST', body: payload }),

    startGame: (id: string) => localMode
      ? localMutation(() => local.startGame(id))
      : call<Game>(`/api/games/${id}/start`, { method: 'PATCH' }),

    finishGame: (id: string, body: { winnerClan: string; comment?: string }) => localMode
      ? localMutation(() => local.finishGame(id, body))
      : call<Game>(`/api/games/${id}/finish`, { method: 'PATCH', body }),

    startNight: (id: string) => localMode
      ? localMutation(() => local.startNight(id))
      : call<NightCurrent>(`/api/games/${id}/nights/start`, { method: 'POST' }),

    getNightCurrent: (id: string) => localMode
      ? execute(() => local.getNightCurrent(id))
      : call<NightCurrent>(`/api/games/${id}/nights/current`),

    saveNightAction: (
      id: string,
      nightId: string,
      body: {
        actionType: string;
        targetGamePlayerId?: string | null;
        secondTargetGamePlayerId?: string | null;
      },
    ) => localMode
      ? localMutation(() => local.saveNightAction(id, nightId, body))
      : call<SaveActionResponse>(
        `/api/games/${id}/nights/${nightId}/actions`,
        { method: 'POST', body },
      ),

    completeNight: (id: string, nightId: string) => localMode
      ? localMutation(() => local.completeNight(id, nightId))
      : call<Game>(`/api/games/${id}/nights/${nightId}/complete`, {
        method: 'POST',
      }),

    startDay: (id: string) => localMode
      ? localMutation(() => local.startDay(id))
      : call<DayCurrent>(`/api/games/${id}/days/start`, { method: 'POST' }),

    getDayCurrent: (id: string) => localMode
      ? execute(() => local.getDayCurrent(id))
      : call<DayCurrent>(`/api/games/${id}/days/current`),

    saveNominations: (id: string, dayId: string, nomineeGamePlayerIds: string[]) => localMode
      ? localMutation(() => local.saveNominations(id, dayId, nomineeGamePlayerIds))
      : call<DayCurrent>(`/api/games/${id}/days/${dayId}/nominations`, {
        method: 'POST',
        body: { nomineeGamePlayerIds },
      }),

    eliminate: (
      id: string,
      dayId: string,
      eliminatedGamePlayerId: string | null,
    ) => localMode
      ? localMutation(() => local.eliminate(id, dayId, eliminatedGamePlayerId))
      : call<DayCurrent>(`/api/games/${id}/days/${dayId}/eliminate`, {
        method: 'POST',
        body: { eliminatedGamePlayerId },
      }),

    completeDay: (id: string, dayId: string) => localMode
      ? localMutation(() => local.completeDay(id, dayId))
      : call<Game>(`/api/games/${id}/days/${dayId}/complete`, { method: 'POST' }),
  };
}
