import { timingSafeEqual } from 'node:crypto';
import { createError } from 'h3';

const CAPACITOR_ORIGINS = new Set(['https://localhost', 'http://localhost']);
const PREFLIGHT_HEADERS = new Set(['content-type', 'x-mobile-sync-token']);

/** Only this exact endpoint is exempt from the web-session gate. */
export function isMobileSyncPath(path: string): boolean {
  return /^\/api\/sync\/games\/[^/]+$/.test(path);
}

export function mobileSyncCorsHeaders(origin?: string): Record<string, string> {
  if (!origin) return {};
  if (!CAPACITOR_ORIGINS.has(origin)) {
    throw createError({ statusCode: 403, message: 'Источник синхронизации не разрешён.' });
  }
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Mobile-Sync-Token',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
    // Intentionally no Allow-Credentials: this endpoint never uses cookies.
  };
}

export function authorizeMobileSync(request: {
  method: string;
  expectedToken: string;
  token?: string;
  origin?: string;
  requestedMethod?: string;
  requestedHeaders?: string;
}): { preflight: true } | { preflight: false; token: string } {
  mobileSyncCorsHeaders(request.origin);
  if (!request.expectedToken) {
    throw createError({ statusCode: 503, message: 'Мобильная синхронизация не настроена.' });
  }
  if (request.method !== 'PUT' && request.method !== 'OPTIONS') {
    throw createError({ statusCode: 405, message: 'Метод синхронизации не разрешён.' });
  }
  if (request.method === 'OPTIONS') {
    const headers = (request.requestedHeaders || '')
      .split(',')
      .map((header) => header.trim().toLowerCase())
      .filter(Boolean);
    if (
      !request.origin ||
      request.requestedMethod !== 'PUT' ||
      headers.some((header) => !PREFLIGHT_HEADERS.has(header))
    ) {
      throw createError({ statusCode: 403, message: 'CORS-запрос не разрешён.' });
    }
    return { preflight: true };
  }
  const actual = Buffer.from(request.token || '', 'utf8');
  const expected = Buffer.from(request.expectedToken, 'utf8');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw createError({ statusCode: 401, message: 'Неверный токен мобильной синхронизации.' });
  }
  return { preflight: false, token: request.expectedToken };
}
