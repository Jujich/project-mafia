/**
 * Gates the whole app behind the login page.
 *
 * On the server (initial load / hard refresh) the real session is resolved
 * from the sealed cookie and stored in `useState`, which is serialized into
 * the payload — so client-side navigations reuse it without refetching.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const { loggedIn, refresh } = useAuth();

  if (import.meta.server) {
    await refresh();
  }

  const isLoginPage = to.path === '/login';

  if (!loggedIn.value && !isLoginPage) {
    return navigateTo('/login');
  }

  if (loggedIn.value && isLoginPage) {
    return navigateTo('/');
  }
});
