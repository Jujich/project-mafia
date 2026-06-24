interface SessionResponse {
  loggedIn: boolean;
  login: string | null;
}

/**
 * Client-facing auth state. The actual session lives in a sealed, httpOnly
 * cookie set by the server; this composable mirrors its status into shared
 * `useState` so the UI and route middleware can react to it.
 */
export function useAuth() {
  const loggedIn = useState<boolean>('auth:loggedIn', () => false);
  const login = useState<string | null>('auth:login', () => null);

  async function refresh(): Promise<boolean> {
    try {
      // `useRequestFetch` forwards the incoming cookie during SSR so the
      // session check resolves correctly on a hard refresh / first load.
      const data = await useRequestFetch()<SessionResponse>('/api/auth/session');
      loggedIn.value = !!data.loggedIn;
      login.value = data.login;
    } catch {
      loggedIn.value = false;
      login.value = null;
    }
    return loggedIn.value;
  }

  async function signIn(credentials: { login: string; password: string }) {
    const data = await $fetch<{ ok: boolean; login: string }>(
      '/api/auth/login',
      { method: 'POST', body: credentials },
    );
    loggedIn.value = true;
    login.value = data.login;
    return data;
  }

  async function signOut() {
    await $fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    loggedIn.value = false;
    login.value = null;
    await navigateTo('/login');
  }

  return { loggedIn, login, refresh, signIn, signOut };
}
