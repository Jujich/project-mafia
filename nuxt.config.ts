// Capacitor embeds static files and has no Nitro process. The regular web
// deployment remains SSR-enabled and continues using the existing BFF.
const capacitorBuild = process.env.NUXT_CAPACITOR === 'true';

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-09-01',
  modules: ['@nuxt/ui'],
  devtools: { enabled: false },
  ssr: !capacitorBuild,

  css: ['~/assets/css/main.css'],

  // Always-dark premium club theme.
  colorMode: {
    preference: 'dark',
    fallback: 'dark',
  },

  runtimeConfig: {
    // Server-only: where the Nitro BFF forwards requests. Never exposed to client.
    backendApiUrl: process.env.NUXT_BACKEND_API_URL || 'http://localhost:3000',
    // Private Nitro proxy credential, overridden at runtime by
    // NUXT_MOBILE_SYNC_TOKEN. Never copied to public runtime config.
    mobileSyncToken: process.env.NUXT_MOBILE_SYNC_TOKEN || '',
    public: {
      localGameMode: capacitorBuild,
      syncApiBase: process.env.NUXT_PUBLIC_SYNC_API_URL || '',
      // Shared mobile-only token. It is only a deployment barrier (an APK can be
      // inspected), not a replacement for per-user mobile authentication.
      mobileSyncToken: capacitorBuild ? process.env.NUXT_PUBLIC_MOBILE_SYNC_TOKEN || '' : '',
    },
  },

  app: {
    head: {
      title: 'Деловая Мафия — Панель ведущего',
      htmlAttrs: { lang: 'ru', class: 'dark' },
      meta: [
        { charset: 'utf-8' },
        {
          name: 'viewport',
          content: 'width=device-width, initial-scale=1, viewport-fit=cover',
        },
        {
          name: 'description',
          content:
            'Панель ведущего для проведения клубной Мафии и сохранения результатов игр.',
        },
        { name: 'theme-color', content: '#152555' },
      ],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },

  ui: {
    global: true,
    safelistColors: ['gold', 'green', 'red', 'orange', 'blue', 'gray'],
  },
});
