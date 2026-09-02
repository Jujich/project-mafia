import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as h3 from 'h3';

const mobileToken = 'test-mobile-token-not-a-real-secret';
const webSession = vi.fn(async () => false);
const backendFetch = vi.fn(async () => ({ acceptedRevision: 7 }));
let serve: ReturnType<typeof h3.toWebHandler>;
let configuredToken = mobileToken;

beforeAll(async () => {
  for (const name of [
    'defineEventHandler', 'getRequestURL', 'getHeader', 'setHeaders', 'setHeader',
    'sendNoContent', 'createError', 'readBody',
  ] as const) {
    vi.stubGlobal(name, h3[name]);
  }
  vi.stubGlobal('useRuntimeConfig', () => ({
    backendApiUrl: 'http://mafia-backend:3000', mobileSyncToken: configuredToken,
  }));
  vi.stubGlobal('isAuthenticated', webSession);
  vi.stubGlobal('$fetch', backendFetch);
  const { default: guard } = await import('../server/middleware/auth');
  const { default: proxy } = await import('../server/api/sync/games/[clientGameId].put');
  const app = h3.createApp();
  app.use(guard);
  app.use(proxy);
  serve = h3.toWebHandler(app);
});

beforeEach(() => {
  configuredToken = mobileToken;
  webSession.mockReset().mockResolvedValue(false);
  backendFetch.mockClear();
});

afterAll(() => vi.unstubAllGlobals());

function request(method: string, headers: Record<string, string> = {}, body?: unknown) {
  return new Request('https://mafia.example/api/sync/games/test-game', {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('mobile sync Nitro middleware/proxy', () => {
  it('answers the scoped preflight without checking a web session or touching backend', async () => {
    const response = await serve(request('OPTIONS', {
      Origin: 'https://localhost',
      'Access-Control-Request-Method': 'PUT',
      'Access-Control-Request-Headers': 'content-type,x-mobile-sync-token',
    }));
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://localhost');
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBeNull();
    expect(webSession).not.toHaveBeenCalled();
    expect(backendFetch).not.toHaveBeenCalled();
  });

  it('forwards only exact path, body and validated token with a finite timeout', async () => {
    const body = { schemaVersion: 1, revision: 7, aggregate: { id: 'test-game' } };
    const response = await serve(request('PUT', {
      Origin: 'https://localhost',
      'Content-Type': 'application/json',
      'X-Mobile-Sync-Token': mobileToken,
      Cookie: 'mafia_session=must-not-be-forwarded',
      Authorization: 'must-not-be-forwarded',
    }, body));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ acceptedRevision: 7 });
    expect(backendFetch).toHaveBeenCalledWith('http://mafia-backend:3000/api/sync/games/test-game', {
      method: 'PUT', headers: { 'X-Mobile-Sync-Token': mobileToken },
      body, timeout: 40_000, retry: 0,
    });
    expect(webSession).not.toHaveBeenCalled();
  });

  it('does not let a web session bypass mobile token auth, and keeps CORS on auth errors', async () => {
    webSession.mockResolvedValue(true);
    const response = await serve(request('PUT', { Origin: 'https://localhost' }, {}));
    expect(response.status).toBe(401);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://localhost');
    expect(backendFetch).not.toHaveBeenCalled();
  });

  it('fails closed without server token and rejects unrelated methods/origins', async () => {
    configuredToken = '';
    expect((await serve(request('PUT', { 'X-Mobile-Sync-Token': mobileToken }, {}))).status).toBe(503);
    configuredToken = mobileToken;
    expect((await serve(request('DELETE', { 'X-Mobile-Sync-Token': mobileToken }))).status).toBe(405);
    const foreign = await serve(request('PUT', {
      Origin: 'https://elsewhere.example', 'X-Mobile-Sync-Token': mobileToken,
    }, {}));
    expect(foreign.status).toBe(403);
    expect(foreign.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(backendFetch).not.toHaveBeenCalled();
  });

  it('keeps other data API paths behind the web session guard', async () => {
    const response = await serve(new Request('https://mafia.example/api/games', {
      headers: { 'X-Mobile-Sync-Token': mobileToken },
    }));
    expect(response.status).toBe(401);
    expect(webSession).toHaveBeenCalledTimes(1);
    expect(backendFetch).not.toHaveBeenCalled();
  });
});
