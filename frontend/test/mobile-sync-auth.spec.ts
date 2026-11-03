import { describe, expect, it } from 'vitest';
import {
  authorizeMobileSync,
  isMobileSyncPath,
  mobileSyncCorsHeaders,
} from '../server/utils/mobile-sync';

const expectedToken = 'mobile-only-test-token-not-a-real-secret';

function expectStatus(run: () => unknown, statusCode: number) {
  try {
    run();
    throw new Error('Expected request rejection');
  } catch (error) {
    expect(error).toMatchObject({ statusCode });
  }
}

describe('mobile sync proxy authorization', () => {
  it('exempts only the exact one-game sync path from the session guard', () => {
    expect(isMobileSyncPath('/api/sync/games/local-game')).toBe(true);
    for (const path of [
      '/api/games', '/api/sync/games', '/api/sync/games/',
      '/api/sync/games/local-game/', '/api/sync/games/local-game/extra',
      '/api/sync-other/games/local-game',
    ]) {
      expect(isMobileSyncPath(path)).toBe(false);
    }
  });

  it('requires the dedicated token and fails closed when unconfigured', () => {
    expectStatus(() => authorizeMobileSync({ method: 'PUT', expectedToken: '' }), 503);
    expectStatus(() => authorizeMobileSync({ method: 'PUT', expectedToken }), 401);
    expectStatus(() => authorizeMobileSync({ method: 'PUT', expectedToken, token: 'wrong' }), 401);
    expectStatus(() => authorizeMobileSync({
      method: 'PUT', expectedToken, token: 'x'.repeat(expectedToken.length),
    }), 401);
    expect(authorizeMobileSync({ method: 'PUT', expectedToken, token: expectedToken }))
      .toEqual({ preflight: false, token: expectedToken });
  });

  it('permits only Capacitor origins and never grants cookie credentials', () => {
    for (const origin of ['https://localhost', 'http://localhost']) {
      const headers = mobileSyncCorsHeaders(origin);
      expect(headers['Access-Control-Allow-Origin']).toBe(origin);
      expect(headers['Access-Control-Allow-Credentials']).toBeUndefined();
      expect(headers.Vary).toBe('Origin');
      expect(authorizeMobileSync({ method: 'PUT', expectedToken, token: expectedToken, origin }))
        .toMatchObject({ preflight: false });
    }
    for (const origin of ['null', 'https://evil.example', 'https://localhost.evil.example', 'https://localhost:8080']) {
      expectStatus(() => mobileSyncCorsHeaders(origin), 403);
    }
    expect(mobileSyncCorsHeaders()).toEqual({});
  });

  it('allows a scoped preflight without a cookie or token header', () => {
    expect(authorizeMobileSync({
      method: 'OPTIONS', expectedToken, origin: 'https://localhost',
      requestedMethod: 'PUT', requestedHeaders: 'content-type, X-Mobile-Sync-Token',
    })).toEqual({ preflight: true });
    for (const requestedMethod of ['GET', 'POST', 'DELETE', undefined]) {
      expectStatus(() => authorizeMobileSync({
        method: 'OPTIONS', expectedToken, origin: 'https://localhost', requestedMethod,
      }), 403);
    }
    expectStatus(() => authorizeMobileSync({
      method: 'OPTIONS', expectedToken, origin: 'https://localhost',
      requestedMethod: 'PUT', requestedHeaders: 'authorization',
    }), 403);
    expectStatus(() => authorizeMobileSync({
      method: 'OPTIONS', expectedToken, requestedMethod: 'PUT',
    }), 403);
  });

  it('rejects every other method even with a correct token', () => {
    for (const method of ['GET', 'POST', 'PATCH', 'DELETE', 'HEAD']) {
      expectStatus(() => authorizeMobileSync({ method, expectedToken, token: expectedToken }), 405);
    }
  });
});
