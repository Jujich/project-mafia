import {
  authorizeMobileSync,
  isMobileSyncPath,
  mobileSyncCorsHeaders,
} from '../utils/mobile-sync';

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
 *
 * The exact PUT /api/sync/games/:clientGameId endpoint uses a separate mobile
 * token, not a web session. Its scoped OPTIONS preflight carries no cookies.
 */
export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname;

  if (!path.startsWith('/api/')) return;
  if (path.startsWith('/api/auth/')) return;
  if (path.startsWith('/api/_')) return;

  if (isMobileSyncPath(path)) {
    const origin = getHeader(event, 'origin');
    setHeaders(event, mobileSyncCorsHeaders(origin));
    setHeader(event, 'Allow', 'PUT, OPTIONS');
    const config = useRuntimeConfig(event);
    const authorization = authorizeMobileSync({
      method: event.method,
      expectedToken: String(config.mobileSyncToken || ''),
      token: getHeader(event, 'x-mobile-sync-token'),
      origin,
      requestedMethod: getHeader(event, 'access-control-request-method'),
      requestedHeaders: getHeader(event, 'access-control-request-headers'),
    });
    if (authorization.preflight) return sendNoContent(event, 204);
    event.context.mobileSyncAuthorizedToken = authorization.token;
    return;
  }

  if (!(await isAuthenticated(event))) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Требуется авторизация.',
    });
  }
});
