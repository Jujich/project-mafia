import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ru.delovayamafia.host',
  appName: 'Деловая Мафия',
  webDir: '.output/public',
  backgroundColor: '#07142f',
  loggingBehavior: 'debug',
  android: {
    backgroundColor: '#07142f',
  },
};

export default config;
