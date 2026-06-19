// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-09-01',
  modules: ['@nuxt/ui'],
  devtools: { enabled: false },
  ssr: true,

  css: ['~/assets/css/main.css'],

  // Always-dark premium club theme.
  colorMode: {
    preference: 'dark',
    fallback: 'dark',
  },

  runtimeConfig: {
    // Server-only: where the Nitro BFF forwards requests. Never exposed to client.
    backendApiUrl: process.env.NUXT_BACKEND_API_URL || 'http://localhost:3000',
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
