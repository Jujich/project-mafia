/**
 * Server-side guard for the data API (the Nitro BFF that proxies to the
 * NestJS backend). Without this, the `/api/*` routes would be reachable
 * directly, bypassing the login page.
 *
 * Left open on purpose:
 *   - `/api/auth/*`  — login / logout / session-check endpoints
 *   - `/api/_*`      — Nuxt internals (e.g. `/api/_nuxt_icon/:collection`)
 *   - everything not under `/api/` (pages, assets) — guarded client-side by
 *     the global route middleware instead.
 */
export default defineEventHandler(async (event) => {
  const path = event.path || '';

  if (!path.startsWith('/api/')) return;
  if (path.startsWith('/api/auth/')) return;
  if (path.startsWith('/api/_')) return;

  if (!(await isAuthenticated(event))) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Требуется авторизация.',
    });
  }
});
