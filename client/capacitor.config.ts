import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jollypanda.grid_rush',
  appName: 'Grid Rush',
  webDir: 'dist',
  backgroundColor: '#001E67',
  server: {
    // "http" (instead of the default "https") lets the app talk to a plain ws:// / http:// server on a LAN while testing.
    // A production server behind TLS (wss://) works with both.
    androidScheme: 'http',
    cleartext: true,
  },
  android: { allowMixedContent: true },
};

export default config;
