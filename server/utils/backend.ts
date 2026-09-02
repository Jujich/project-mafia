import type { H3Event } from 'h3';

/**
 * Forwards the current request to the NestJS backend.
 *
 * The frontend never talks to the backend directly — every `/api/*` call
 * lands on a Nitro route which calls this proxy. The backend path mirrors the
 * incoming path (both live under `/api`), so we simply replay method, query
 * and body and bubble up the backend's status code + error payload.
 */
export async function proxyToBackend<T = unknown>(event: H3Event): Promise<T> {
  const config = useRuntimeConfig();
  const base = (config.backendApiUrl as string)?.replace(/\/$/, '');

  const path = event.path || event.node.req.url || '/';
  const method = (event.node.req.method || 'GET').toUpperCase();

  const init: Record<string, unknown> = { method };

  if (method !== 'GET' && method !== 'HEAD') {
    init.body = await readBody(event).catch(() => undefined);
  }

  try {
    return (await $fetch(`${base}${path}`, init)) as T;
  } catch (err: any) {
    const statusCode = err?.statusCode || err?.response?.status || 502;
    const data = err?.data;
    throw createError({
      statusCode,
      statusMessage:
        data?.message ||
        err?.statusMessage ||
        'Ошибка обращения к серверу.',
      data,
    });
  }
}
