import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.angryballoon.farukbiswas',
  appName: 'Angry Balloon',
  webDir: 'mobile-dist',
  server: { hostname: 'localhost', androidScheme: 'https' },
  android: { backgroundColor: '#102e3c' },
  plugins: { SplashScreen: { launchAutoHide: false, backgroundColor: '#102e3c', showSpinner: false } },
};
export default config;
