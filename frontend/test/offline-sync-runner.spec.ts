import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createOfflineSyncRunner,
  isRetryableSyncError,
  SYNC_REQUEST_TIMEOUT_MS,
} from '../utils/offline-sync-runner';

afterEach(() => vi.useRealTimers());

describe('offline sync runner', () => {
  it('coalesces in-flight requests and uploads the newest revision in a trailing pass', async () => {
    let revision = 1;
    let release!: () => void;
    const sent: number[] = [];
    const firstUpload = new Promise<void>((resolve) => { release = resolve; });
    const runner = createOfflineSyncRunner({
      run: async () => {
        sent.push(revision);
        if (sent.length === 1) await firstUpload;
        return 'success';
      },
    });
    const first = runner.request();
    revision = 2;
    expect(runner.request()).toBe(first);
    revision = 3;
    expect(runner.request()).toBe(first);
    release();
    await first;
    expect(sent).toEqual([1, 3]);
    runner.dispose();
  });

  it('retries transient failures with capped backoff, without mutation-triggered hammering', async () => {
    vi.useFakeTimers();
    const run = vi.fn(async () => 'retry' as const);
    const runner = createOfflineSyncRunner({ run, initialDelayMs: 100, maxDelayMs: 400 });
    await runner.request();
    await runner.request();
    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(100);
    expect(run).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(199);
    expect(run).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(400);
    expect(run).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(400);
    expect(run).toHaveBeenCalledTimes(5);
    runner.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('pauses retries when hidden/disconnected, resumes immediately, and cleans up timers', async () => {
    vi.useFakeTimers();
    const run = vi.fn(async () => 'retry' as const);
    const runner = createOfflineSyncRunner({ run, initialDelayMs: 100 });
    await runner.request();
    runner.setActive(false);
    await vi.advanceTimersByTimeAsync(5_000);
    await runner.request();
    expect(run).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    runner.setActive(true);
    await runner.request({ force: true });
    expect(run).toHaveBeenCalledTimes(2);
    runner.dispose();
    await vi.advanceTimersByTimeAsync(5_000);
    await runner.request({ force: true });
    expect(run).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not automatically retry permanent errors or lack of connectivity', async () => {
    vi.useFakeTimers();
    for (const outcome of ['blocked', 'offline'] as const) {
      const run = vi.fn(async () => outcome);
      const runner = createOfflineSyncRunner({ run });
      await runner.request();
      await vi.advanceTimersByTimeAsync(300_000);
      expect(run).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
      runner.dispose();
    }
  });

  it('recovers after a temporary failure and resets the backoff', async () => {
    vi.useFakeTimers();
    const run = vi.fn()
      .mockResolvedValueOnce('retry')
      .mockResolvedValueOnce('success')
      .mockResolvedValue('retry');
    const runner = createOfflineSyncRunner({ run, initialDelayMs: 100 });
    await runner.request();
    await vi.advanceTimersByTimeAsync(100);
    expect(run).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
    await runner.request();
    await vi.advanceTimersByTimeAsync(100);
    expect(run).toHaveBeenCalledTimes(4);
    runner.dispose();
  });

  it('has a finite timeout and retries only recoverable HTTP/network failures', () => {
    expect(SYNC_REQUEST_TIMEOUT_MS).toBeGreaterThan(0);
    expect(SYNC_REQUEST_TIMEOUT_MS).toBeLessThanOrEqual(60_000);
    expect(isRetryableSyncError(new Error('timeout'))).toBe(true);
    for (const status of [408, 425, 429, 500, 502, 503]) {
      expect(isRetryableSyncError({ response: { status } })).toBe(true);
    }
    for (const statusCode of [400, 401, 403, 404, 413, 422]) {
      expect(isRetryableSyncError({ statusCode })).toBe(false);
    }
  });
});
