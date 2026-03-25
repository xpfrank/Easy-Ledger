import { useState, useEffect, useCallback } from 'react';
import type { PageRoute } from '@/types';
import { BottomNav } from '@/components/BottomNav';
import { HomePage } from '@/pages/HomePage';
import { AccountsPage } from '@/pages/AccountsPage';
import { AccountEditPage } from '@/pages/AccountEditPage';
import { RecordPage } from '@/pages/RecordPage';
import { RecordLogsPage } from '@/pages/RecordLogsPage';
import { TrendPage } from '@/pages/TrendPage';
import { SettingsPage } from '@/pages/SettingsPage';
import './App.css';

// 页面历史栈，用于管理返回逻辑
const pageHistory: PageRoute[] = ['home'];

function App() {
  const [currentPage, setCurrentPage] = useState<PageRoute>('home');
  const [pageParams, setPageParams] = useState<any>(null);

  // 处理页面切换
  const handlePageChange = useCallback((page: PageRoute, params?: any) => {
    setCurrentPage(page);
    setPageParams(params);
    window.scrollTo(0, 0);

    // 维护页面历史栈
    if (pageHistory[pageHistory.length - 1] !== page) {
      pageHistory.push(page);
    }
  }, []);

  // 返回上一页
  const handleGoBack = useCallback(() => {
    if (pageHistory.length > 1) {
      pageHistory.pop(); // 移除当前页面
      const previousPage = pageHistory[pageHistory.length - 1];
      setCurrentPage(previousPage);
      setPageParams(null);
      window.scrollTo(0, 0);
    }
  }, []);

  // 监听浏览器/应用返回键事件
  useEffect(() => {
    // 处理浏览器返回按钮
    const handlePopState = (event: PopStateEvent) => {
      event.preventDefault();
      handleGoBack();
    };

    // 处理 Capacitor 应用返回键
    const handleHardwareBackButton = () => {
      // 只在非首页时处理返回
      if (currentPage !== 'home') {
        handleGoBack();
      }
    };

    // 添加事件监听
    window.addEventListener('popstate', handlePopState);

    // Capacitor 的返回键处理（如果在 Capacitor 环境中）
    if (typeof (window as any).Capacitor !== 'undefined') {
      const { App } = (window as any).Capacitor.Plugins || {};
      if (App && App.addListener) {
        App.addListener('backButton', handleHardwareBackButton);
      }
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [currentPage, handleGoBack]);

  // 渲染当前页面
  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return (
          <HomePage
            onPageChange={handlePageChange}
            params={pageParams}
          />
        );
      case 'accounts':
        return (
          <AccountsPage
            onPageChange={handlePageChange}
          />
        );
      case 'account-edit':
        return (
          <AccountEditPage
            onPageChange={handlePageChange}
            params={pageParams}
          />
        );
      case 'record':
        return (
          <RecordPage
            onPageChange={handlePageChange}
          />
        );
      case 'record-logs':
        return (
          <RecordLogsPage
            onPageChange={handlePageChange}
          />
        );
      case 'trend':
        return (
          <TrendPage
            onPageChange={handlePageChange}
          />
        );
      case 'settings':
        return (
          <SettingsPage
            onPageChange={handlePageChange}
          />
        );
      default:
        return (
          <HomePage
            onPageChange={handlePageChange}
            params={pageParams}
          />
        );
    }
  };

  // 判断是否显示底部导航栏
  const showBottomNav = ['home', 'record', 'trend', 'settings'].includes(currentPage);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 页面内容 */}
      {renderPage()}

      {/* 底部导航栏 */}
      {showBottomNav && (
        <BottomNav
          currentPage={currentPage}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}

export default App;
