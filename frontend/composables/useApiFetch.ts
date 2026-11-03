import type { AsyncData, UseFetchOptions } from 'nuxt/app';

/**
 * `useFetch` for our protected `/api/*` routes.
 *
 * During SSR, internal `$fetch` does NOT forward the browser cookies, so the
 * server-side auth middleware would reject the data request with 401. We
 * forward the incoming `cookie` header explicitly. On the client the header
 * is empty here and the browser attaches the (httpOnly) session cookie itself.
 */
export function useApiFetch<T>(
  url: string | (() => string),
  options: UseFetchOptions<T> = {},
): AsyncData<T, Error> {
  const config = useRuntimeConfig();
  if (config.public.localGameMode) {
    const repository = useOfflineGameRepository();
    const resolvedUrl = () => (typeof url === 'function' ? url() : url);
    return useAsyncData<T>(
      `offline:${resolvedUrl()}`,
      async () => {
        const path = resolvedUrl();
        if (path === '/api/games') {
          return (await repository.listGames()) as unknown as T;
        }
        const night = path.match(/^\/api\/games\/([^/]+)\/nights\/current$/);
        if (night) {
          return (await repository.getNightCurrent(decodeURIComponent(night[1]))) as unknown as T;
        }
        const day = path.match(/^\/api\/games\/([^/]+)\/days\/current$/);
        if (day) {
          return (await repository.getDayCurrent(decodeURIComponent(day[1]))) as unknown as T;
        }
        const game = path.match(/^\/api\/games\/([^/]+)$/);
        if (game) {
          return (await repository.getGame(decodeURIComponent(game[1]))) as unknown as T;
        }
        throw new Error(`Локальный маршрут не поддерживается: ${path}`);
      },
      { server: false },
    ) as AsyncData<T, Error>;
  }

  return useFetch<T>(url, {
    ...options,
    headers: {
      ...useRequestHeaders(['cookie']),
      ...(options.headers as Record<string, string> | undefined),
    },
  } as any) as unknown as AsyncData<T, Error>;
}
