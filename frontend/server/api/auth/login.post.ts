export default defineEventHandler(async (event) => {
  const body = await readBody<{ login?: string; password?: string }>(event).catch(
    () => ({}) as { login?: string; password?: string },
  );

  const login = (body?.login ?? '').trim();
  const password = body?.password ?? '';

  if (!isAuthConfigured()) {
    throw createError({
      statusCode: 500,
      statusMessage:
        'Авторизация не настроена на сервере (нет ADMIN_LOGIN / ADMIN_PASSWORD).',
    });
  }

  const admin = getAdminCredentials();
  const ok =
    safeEqual(login, admin.login) && safeEqual(password, admin.password);

  if (!ok) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Неверный логин или пароль.',
    });
  }

  const session = await getAuthSession(event);
  await session.update({ login, loggedInAt: Date.now() });

  return { ok: true, login };
});
