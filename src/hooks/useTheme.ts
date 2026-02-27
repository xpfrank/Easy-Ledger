import { useState, useEffect, useCallback } from 'react';
import type { ThemeType, ThemeConfig } from '@/types';
import { THEMES } from '@/types';
import { getSettings, updateSettings } from '@/lib/storage';

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeType>('blue');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const settings = getSettings();
    setThemeState(settings.theme || 'blue');
    setIsLoaded(true);
  }, []);

  const setTheme = useCallback((newTheme: ThemeType) => {
    setThemeState(newTheme);
    updateSettings({ theme: newTheme });
  }, []);

  const themeConfig: ThemeConfig = THEMES[theme];

  // 获取CSS变量
  const getThemeCssVars = () => ({
    '--theme-primary': themeConfig.primary,
    '--theme-primary-light': themeConfig.primaryLight,
    '--theme-primary-dark': themeConfig.primaryDark,
    '--theme-gradient-from': themeConfig.gradientFrom,
    '--theme-gradient-to': themeConfig.gradientTo,
    '--theme-bg-light': themeConfig.bgLight,
  });

  return {
    theme,
    setTheme,
    themeConfig,
    getThemeCssVars,
    isLoaded,
  };
}

// 获取自适应字号
export function getAdaptiveFontSize(amount: number): string {
  const amountStr = Math.abs(amount).toFixed(2);
  const length = amountStr.replace(/[,.]/g, '').length;
  
  if (length <= 6) return 'text-2xl';
  if (length <= 8) return 'text-xl';
  if (length <= 10) return 'text-lg';
  return 'text-base';
}
