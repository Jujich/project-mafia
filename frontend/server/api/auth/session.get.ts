export default defineEventHandler(async (event) => {
  const session = await getAuthSession(event);
  const login = session.data?.login ?? null;
  return { loggedIn: Boolean(login), login };
});
