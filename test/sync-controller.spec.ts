import assert from 'node:assert/strict';
import test from 'node:test';
import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { SyncController } from '../src/sync/sync.controller';
import { SyncService } from '../src/sync/sync.service';

test('mobile sync fails closed without its dedicated token', () => {
  const original = process.env.MOBILE_SYNC_TOKEN;
  let imports = 0;
  const controller = new SyncController({
    importGame: () => { imports += 1; return 'accepted'; },
  } as unknown as SyncService);
  try {
    delete process.env.MOBILE_SYNC_TOKEN;
    assert.throws(() => controller.importGame('game-1', undefined, {}), ServiceUnavailableException);
    process.env.MOBILE_SYNC_TOKEN = 'test-mobile-sync-secret';
    assert.throws(() => controller.importGame('game-1', undefined, {}), UnauthorizedException);
    assert.throws(() => controller.importGame('game-1', 'wrong', {}), UnauthorizedException);
    assert.equal(imports, 0);
    assert.equal(controller.importGame('game-1', 'test-mobile-sync-secret', {}), 'accepted');
    assert.equal(imports, 1);
  } finally {
    if (original === undefined) delete process.env.MOBILE_SYNC_TOKEN;
    else process.env.MOBILE_SYNC_TOKEN = original;
  }
});
