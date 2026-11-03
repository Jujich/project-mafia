import { Network } from '@capacitor/network';
import {
  createOfflineSyncRunner,
  isRetryableSyncError,
  SYNC_REQUEST_TIMEOUT_MS,
  type SyncOutcome,
} from '~/utils/offline-sync-runner';

interface SyncAck {
  clientGameId: string;
  acceptedRevision: number;
  status: 'created' | 'updated' | 'duplicate';
  syncedAt: string;
}

let syncRunner: ReturnType<typeof createOfflineSyncRunner> | null = null;

function errorMessage(error: any): string {
  const candidate =
    error?.data?.message ||
    error?.data?.statusMessage ||
    error?.statusMessage ||
    error?.message;
  return Array.isArray(candidate)
    ? candidate.join('. ')
    : candidate || 'Сервер синхронизации недоступен.';
}

export function useGameSync() {
  const config = useRuntimeConfig();
  const repository = useOfflineGameRepository();
  const online = useState<boolean>('offline:online', () => true);
  const syncing = useState<boolean>('offline:syncing', () => false);
  const lastError = useState<string | null>('offline:sync:error', () => null);
  const lastSuccessAt = useState<string | null>(
    'offline:sync:success',
    () => null,
  );

  const publicConfig = config.public as typeof config.public & {
    localGameMode?: boolean;
    syncApiBase?: string;
    mobileSyncToken?: string;
  };
  const enabled = computed(() => Boolean(publicConfig.localGameMode));

  async function refreshNetworkStatus(): Promise<boolean> {
    if (!import.meta.client) return false;
    try {
      const status = await Network.getStatus();
      online.value = status.connected;
    } catch {
      online.value = navigator.onLine;
    }
    return online.value;
  }

  async function doSync(): Promise<SyncOutcome> {
    if (!enabled.value || !import.meta.client) return 'blocked';
    const snapshots = await repository.pendingSnapshots();
    if (!snapshots.length) {
      lastError.value = null;
      return 'success';
    }
    const base = String(publicConfig.syncApiBase || '').replace(/\/$/, '');
    if (!base) {
      lastError.value = 'Не задан адрес сервера синхронизации.';
      return 'blocked';
    }
    if (!(await refreshNetworkStatus())) return 'offline';
    syncing.value = true;
    lastError.value = null;
    let outcome: SyncOutcome = 'success';
    try {
      for (const snapshot of snapshots) {
        try {
          const headers: Record<string, string> = {};
          if (publicConfig.mobileSyncToken) {
            headers['X-Mobile-Sync-Token'] = String(
              publicConfig.mobileSyncToken,
            );
          }
          const ack = (await $fetch(
            `${base}/api/sync/games/${encodeURIComponent(snapshot.clientGameId)}`,
            {
              method: 'PUT',
              headers,
              timeout: SYNC_REQUEST_TIMEOUT_MS,
              // The queue owns retries and backoff, including PUT requests.
              retry: 0,
              body: {
                schemaVersion: 1,
                revision: snapshot.revision,
                aggregate: snapshot.aggregate,
              },
            },
          )) as SyncAck;
          if (
            ack.clientGameId !== snapshot.clientGameId ||
            !Number.isSafeInteger(ack.acceptedRevision) ||
            ack.acceptedRevision < snapshot.revision
          ) {
            throw new Error('Сервер не подтвердил сохранение снимка игры.');
          }
          await repository.acknowledge(
            snapshot.clientGameId,
            ack.acceptedRevision,
          );
          lastSuccessAt.value = ack.syncedAt;
        } catch (error: any) {
          const message = errorMessage(error);
          await repository.markSyncError(snapshot.clientGameId, error);
          lastError.value = message;
          if (isRetryableSyncError(error)) {
            // Network availability and backend health are different: leave
            // online tied to Network.getStatus(), then retry with backoff.
            return 'retry';
          }
          // One rejected aggregate must not block unrelated games. Keep the
          // failed record pending, but do not automatically retry permanent 4xx.
          outcome = 'blocked';
        }
      }
    } finally {
      syncing.value = false;
    }
    return outcome;
  }

  function runner() {
    if (!syncRunner) {
      syncRunner = createOfflineSyncRunner({
        run: doSync,
        initiallyActive: document.visibilityState === 'visible',
        onUnexpectedError: (error) => {
          lastError.value = errorMessage(error);
        },
      });
    }
    return syncRunner;
  }

  function syncPending(options: { force?: boolean } = {}): Promise<void> {
    if (!enabled.value || !import.meta.client) return Promise.resolve();
    return runner().request(options);
  }

  function setSyncActive(active: boolean) {
    if (enabled.value && import.meta.client) runner().setActive(active);
  }

  function disposeSync() {
    syncRunner?.dispose();
    syncRunner = null;
  }

  return {
    enabled,
    online,
    syncing,
    lastError,
    lastSuccessAt,
    pendingCount: repository.pendingCount,
    refreshNetworkStatus,
    syncPending,
    setSyncActive,
    disposeSync,
  };
}
