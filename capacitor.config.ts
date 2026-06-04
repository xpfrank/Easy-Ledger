import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ledger.app',
  appName: '余额快照',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    }
  },
  ios: {
    contentInset: 'always'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0
    },
    StatusBar: {
      // 强制非全屏：状态栏始终独立显示，不覆盖 WebView
      // 依赖 @capacitor/status-bar 插件，需先 npm install @capacitor/status-bar
      // WebView 起始位置 = 状态栏下方，CSS 里 env(safe-area-inset-top) = 0
      // 所以页面的 pt-safe / h-safe-top 会自动回落到原始 12px / 56px
      overlaysWebView: false,
      style: 'DEFAULT',
      backgroundColor: '#0ea5e9' // 与页面顶栏同色（蓝色主题），沉浸但不遮挡
    }
  }
};

export default config;
