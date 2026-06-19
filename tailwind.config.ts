import type { Config } from 'tailwindcss';

// Club palette ("Закрытый клуб Деловая Мафия"): deep navy + gold accents.
export default <Partial<Config>>{
  theme: {
    extend: {
      colors: {
        // Full scale so NuxtUI can use `gold` as the primary color.
        gold: {
          50: '#FBF8E9',
          100: '#FBF5C7',
          200: '#F1E6A8',
          300: '#EEE2B1',
          400: '#DECB86',
          500: '#C9B673',
          600: '#9F916B',
          700: '#877759',
          800: '#6B5E45',
          900: '#4A4130',
          950: '#2A2417',
        },
        navy: '#152555',
        'navy-soft': '#1b2c63',
        surface: '#1F2235',
        'surface-soft': '#272b40',
        champagne: '#FBF5C7',
        bronze: '#9F916B',
        bronze2: '#877759',
      },
      fontFamily: {
        serif: ['Georgia', 'Cambria', 'Times New Roman', 'serif'],
      },
      boxShadow: {
        club: '0 18px 40px -16px rgba(0,0,0,0.55)',
      },
    },
  },
};
