export type SyncOutcome = 'success' | 'retry' | 'blocked' | 'offline';

export const SYNC_REQUEST_TIMEOUT_MS = 45_000;

/** Transport failures, rate limits and temporary server failures can recover. */
export function isRetryableSyncError(error: unknown): boolean {
  const response = error as {
    statusCode?: number;
    response?: { status?: number };
  } | null;
  const status = response?.statusCode || response?.response?.status;
  return !status || status === 408 || status === 425 || status === 429 || status >= 500;
}

/**
 * A single-flight queue with a trailing pass for changes made during an upload.
 * Backoff is kept across ordinary mutation triggers, but connectivity changes
 * and explicit retries may force an immediate attempt. No timer runs while the
 * app is hidden/disconnected, or after a permanent HTTP error.
 */
export function createOfflineSyncRunner(options: {
  run: () => Promise<SyncOutcome>;
  onUnexpectedError?: (error: unknown) => void;
  initiallyActive?: boolean;
  initialDelayMs?: number;
  maxDelayMs?: number;
}) {
  const initialDelay = options.initialDelayMs ?? 2_000;
  const maxDelay = options.maxDelayMs ?? 60_000;
  let active = options.initiallyActive ?? true;
  let disposed = false;
  let requested = false;
  let running: Promise<void> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let failures = 0;

  function clearRetry() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }

  function scheduleRetry() {
    requested = true;
    if (!active || disposed) return;
    // Cap the exponent as well, so an indefinitely unavailable server cannot
    // overflow the timer into an immediate retry loop.
    const delay = Math.min(maxDelay, initialDelay * 2 ** Math.min(failures, 20));
    failures += 1;
    timer = setTimeout(() => {
      timer = null;
      void request();
    }, delay);
  }

  async function drain() {
    while (requested && active && !disposed) {
      requested = false;
      let outcome: SyncOutcome;
      try {
        outcome = await options.run();
      } catch (error) {
        options.onUnexpectedError?.(error);
        outcome = 'retry';
      }
      if (disposed) return;
      if (outcome === 'retry') {
        scheduleRetry();
        return;
      }
      failures = 0;
      if (outcome === 'offline' || outcome === 'blocked') {
        // A lifecycle/user trigger can try again; a permanent failure must not
        // spin on a coalesced request from this same batch.
        requested = false;
        return;
      }
    }
  }

  function request({ force = false }: { force?: boolean } = {}): Promise<void> {
    if (disposed) return Promise.resolve();
    requested = true;
    if (force) {
      clearRetry();
      failures = 0;
    }
    if (!active || timer !== null) return running ?? Promise.resolve();
    if (!running) {
      running = drain().finally(() => {
        running = null;
        // Covers a trigger delivered between drain's final check and this
        // promise's cleanup microtask.
        if (requested && active && !disposed && timer === null) void request();
      });
    }
    return running;
  }

  function setActive(next: boolean) {
    active = next;
    if (!active) clearRetry();
  }

  function dispose() {
    disposed = true;
    requested = false;
    clearRetry();
  }

  return { request, setActive, dispose };
}
