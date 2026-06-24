import type { UseFetchOptions } from 'nuxt/app';

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
) {
  return useFetch<T>(url, {
    ...options,
    headers: {
      ...useRequestHeaders(['cookie']),
      ...(options.headers as Record<string, string> | undefined),
    },
  });
}
