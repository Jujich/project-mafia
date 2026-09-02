import { Network } from '@capacitor/network';

export default defineNuxtPlugin(async (nuxtApp) => {
  const config = useRuntimeConfig();
  if (!config.public.localGameMode) return;

  const repository = useOfflineGameRepository();
  const sync = useGameSync();
  let disposed = false;
  await repository.load();
  await sync.refreshNetworkStatus();

  function resumeWhenAvailable() {
    if (disposed) return;
    const active = document.visibilityState === 'visible' && sync.online.value;
    sync.setSyncActive(active);
    if (active) void sync.syncPending({ force: true });
  }

  const networkListener = await Network.addListener('networkStatusChange', (status) => {
    sync.online.value = status.connected;
    resumeWhenAvailable();
  });

  async function onVisibilityChange() {
    if (document.visibilityState === 'visible') await sync.refreshNetworkStatus();
    resumeWhenAvailable();
  }

  document.addEventListener('visibilitychange', onVisibilityChange);
  resumeWhenAvailable();

  function cleanup() {
    if (disposed) return;
    disposed = true;
    document.removeEventListener('visibilitychange', onVisibilityChange);
    void networkListener.remove();
    sync.disposeSync();
  }
  nuxtApp.vueApp.onUnmount(cleanup);
  if (import.meta.hot) import.meta.hot.dispose(cleanup);
});
