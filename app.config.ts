export default defineAppConfig({
  ui: {
    primary: 'gold',
    gray: 'cool',

    card: {
      base: 'overflow-hidden',
      background: 'bg-surface/90 backdrop-blur',
      divide: 'divide-y divide-bronze/20',
      ring: 'ring-1 ring-bronze/25',
      rounded: 'rounded-2xl',
      shadow: 'shadow-club',
      header: { padding: 'px-4 py-4 sm:px-6' },
      body: { padding: 'px-4 py-4 sm:p-6' },
      footer: { padding: 'px-4 py-4 sm:px-6' },
    },

    button: {
      rounded: 'rounded-xl',
      font: 'font-semibold',
      default: { size: 'lg' },
    },

    badge: {
      rounded: 'rounded-full',
      font: 'font-semibold',
    },

    modal: {
      background: 'bg-surface',
      ring: 'ring-1 ring-bronze/30',
      rounded: 'rounded-2xl',
    },

    alert: {
      rounded: 'rounded-xl',
    },
  },
});
