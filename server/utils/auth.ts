import type { H3Event } from 'h3';
import { useSession } from 'h3';
import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Simple single-admin authorization for the host panel.
 *
 * Credentials come from environment variables `ADMIN_LOGIN` / `ADMIN_PASSWORD`.
 * They are read from `process.env` directly (not Nuxt `runtimeConfig`) on
 * purpose: `runtimeConfig` env defaults are frozen at *build* time and only
 * `NUXT_`-prefixed vars override at runtime, whereas these are injected into
 * the container at runtime via docker-compose / CI variables.
 */
export interface AuthSessionData {
  login?: string;
  loggedInAt?: number;
}

const SESSION_COOKIE = 'mafia_session';
// Keep the session alive across reloads / restarts (30 days).
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export function getAdminCredentials() {
  return {
    login: process.env.ADMIN_LOGIN ?? '',
    password: process.env.ADMIN_PASSWORD ?? '',
  };
}

export function isAuthConfigured(): boolean {
  const { login, password } = getAdminCredentials();
  return Boolean(login && password);
}

/**
 * The password used to seal the session cookie. Prefer an explicit
 * `SESSION_PASSWORD`, otherwise derive a stable 64-char secret from the admin
 * credentials so the panel works with just ADMIN_LOGIN/ADMIN_PASSWORD set.
 * (Deriving from the password means changing it invalidates old sessions.)
 */
function getSealPassword(): string {
  const explicit = process.env.SESSION_PASSWORD ?? '';
  if (explicit.length >= 32) return explicit;

  const { login, password } = getAdminCredentials();
  const raw = explicit || `mafia-session::${login}::${password}`;
  return createHash('sha256').update(raw).digest('hex');
}

export function getAuthSession(event: H3Event) {
  return useSession<AuthSessionData>(event, {
    name: SESSION_COOKIE,
    password: getSealPassword(),
    maxAge: SESSION_MAX_AGE,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      // h3 defaults `secure: true`, which a browser drops over plain HTTP.
      // The panel is served over HTTP on the LAN, so default to insecure and
      // let HTTPS deployments opt back in with SESSION_COOKIE_SECURE=true.
      secure: process.env.SESSION_COOKIE_SECURE === 'true',
    },
  });
}

export async function isAuthenticated(event: H3Event): Promise<boolean> {
  const session = await getAuthSession(event);
  return Boolean(session.data?.login);
}

/** Constant-time string comparison to avoid leaking length/content via timing. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
