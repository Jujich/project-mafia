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

  async function call<T>(url: string, opts: any = {}): Promise<T> {
    try {
      return await $fetch<T>(url, opts);
    } catch (err: any) {
      toast.add({
        title: 'Ошибка',
        description: extractMessage(err),
        color: 'red',
        icon: 'i-heroicons-exclamation-triangle',
      });
      throw err;
    }
  }

  return {
    call,

    createGame: (payload: CreateGamePayload) =>
      call<Game>('/api/games', { method: 'POST', body: payload }),

    startGame: (id: string) =>
      call<Game>(`/api/games/${id}/start`, { method: 'PATCH' }),

    finishGame: (id: string, body: { winnerClan: string; comment?: string }) =>
      call<Game>(`/api/games/${id}/finish`, { method: 'PATCH', body }),

    startNight: (id: string) =>
      call<NightCurrent>(`/api/games/${id}/nights/start`, { method: 'POST' }),

    getNightCurrent: (id: string) =>
      call<NightCurrent>(`/api/games/${id}/nights/current`),

    saveNightAction: (
      id: string,
      nightId: string,
      body: {
        actionType: string;
        targetGamePlayerId?: string | null;
        secondTargetGamePlayerId?: string | null;
      },
    ) =>
      call<SaveActionResponse>(
        `/api/games/${id}/nights/${nightId}/actions`,
        { method: 'POST', body },
      ),

    completeNight: (id: string, nightId: string) =>
      call<Game>(`/api/games/${id}/nights/${nightId}/complete`, {
        method: 'POST',
      }),

    startDay: (id: string) =>
      call<DayCurrent>(`/api/games/${id}/days/start`, { method: 'POST' }),

    getDayCurrent: (id: string) =>
      call<DayCurrent>(`/api/games/${id}/days/current`),

    saveNominations: (id: string, dayId: string, nomineeGamePlayerIds: string[]) =>
      call<DayCurrent>(`/api/games/${id}/days/${dayId}/nominations`, {
        method: 'POST',
        body: { nomineeGamePlayerIds },
      }),

    eliminate: (
      id: string,
      dayId: string,
      eliminatedGamePlayerId: string | null,
    ) =>
      call<DayCurrent>(`/api/games/${id}/days/${dayId}/eliminate`, {
        method: 'POST',
        body: { eliminatedGamePlayerId },
      }),

    completeDay: (id: string, dayId: string) =>
      call<Game>(`/api/games/${id}/days/${dayId}/complete`, { method: 'POST' }),
  };
}
