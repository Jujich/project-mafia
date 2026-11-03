export default defineEventHandler(async (event) => {
  // Set exclusively by the dedicated token guard. Never forward a session,
  // caller-supplied arbitrary headers, or a token from public runtime config.
  const token = event.context.mobileSyncAuthorizedToken;
  if (typeof token !== 'string' || !token) {
    throw createError({ statusCode: 401, message: 'Требуется токен мобильной синхронизации.' });
  }
  const config = useRuntimeConfig(event);
  const base = String(config.backendApiUrl || '').replace(/\/$/, '');
  if (!base) {
    throw createError({ statusCode: 503, message: 'Сервер синхронизации не настроен.' });
  }
  const path = getRequestURL(event).pathname;
  const body = await readBody(event);
  try {
    return await $fetch(`${base}${path}`, {
      method: 'PUT',
      headers: { 'X-Mobile-Sync-Token': token },
      body,
      timeout: 40_000,
      retry: 0,
    });
  } catch (error: any) {
    const statusCode = error?.statusCode || error?.response?.status || 502;
    const candidate = error?.data?.message;
    throw createError({
      statusCode,
      message: Array.isArray(candidate)
        ? candidate.join('. ')
        : typeof candidate === 'string'
          ? candidate
          : 'Ошибка обращения к серверу синхронизации.',
    });
  }
});
