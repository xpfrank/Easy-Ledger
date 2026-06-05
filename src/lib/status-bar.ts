import { StatusBar, Style } from '@capacitor/status-bar';
import type { ThemeType } from '@/types';
import { THEMES } from '@/types';

/**
 * 同步系统状态栏颜色与 theme-color meta 标签
 * - Capacitor 环境：调用原生 StatusBar 插件
 * - PWA / 浏览器：更新 <meta name="theme-color">
 */
export function syncStatusBar(theme: ThemeType) {
  const themeConfig = THEMES[theme];

  // 1. 更新 PWA / 浏览器 theme-color meta 标签
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', themeConfig.primary);
  }

  // 2. Capacitor 原生环境：设置状态栏背景色和文字颜色
  try {
    StatusBar.setBackgroundColor({ color: themeConfig.primary });
    // dark 主题用白色文字，其他主题用黑色文字（保证对比度）
    StatusBar.setStyle({ style: theme === 'dark' ? Style.Dark : Style.Light });
  } catch {
    // 非 Capacitor 环境（浏览器预览）会抛异常，安全忽略
  }
}
