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

// 定义 Capacitor App 插件的类型
type CapacitorAppPlugin = {
  addListener: (eventName: 'backButton', callback: (data: { canGoBack: boolean }) => void) => void;
  exitApp: () => void;
};

function App() {
  const [currentPage, setCurrentPage] = useState<PageRoute>('home');
  const [pageParams, setPageParams] = useState<any>(null);
  // 页面历史栈，用于返回逻辑
  const [pageHistory, setPageHistory] = useState<{ page: PageRoute; params: any }[]>([{ page: 'home', params: null }]);

  // 处理页面切换
  const handlePageChange = useCallback((page: PageRoute, params?: any) => {
    setCurrentPage(page);
    setPageParams(params);
    setPageHistory(prev => [...prev, { page, params }]);
    window.scrollTo(0, 0);
  }, []);

  // 处理返回逻辑
  const handleBack = useCallback(() => {
    setPageHistory(prev => {
      if (prev.length <= 1) {
        // 已经在首页，返回 false 让系统处理（退出应用）
        return prev;
      }
      // 移除当前页面，回到上一页
      const newHistory = prev.slice(0, -1);
      const previous = newHistory[newHistory.length - 1];
      setCurrentPage(previous.page);
      setPageParams(previous.params);
      return newHistory;
    });
  }, []);

  // 监听 Android 返回键
  useEffect(() => {
    // 检查是否在 Capacitor 环境中
    const isCapacitor = typeof (window as any).Capacitor !== 'undefined';
    
    if (isCapacitor) {
      // 使用 Capacitor 的 App 插件（添加类型处理）
      import('@capacitor/app').then((module) => {
        const App = module.App as CapacitorAppPlugin;
        // 修复：移除未使用的 canGoBack 参数，或用 _ 前缀标记
        App.addListener('backButton', () => {
          if (pageHistory.length > 1) {
            handleBack();
          } else {
            // 在首页，允许退出应用
            App.exitApp();
          }
        });
      }).catch(err => {
        console.warn('Capacitor App plugin not found:', err);
      });
    } else {
      // 浏览器环境：监听 popstate
      const handlePopState = () => {
        if (pageHistory.length > 1) {
          handleBack();
          // 阻止默认的返回行为
          window.history.pushState(null, '', window.location.href);
        }
      };
      
      window.history.pushState(null, '', window.location.href);
      window.addEventListener('popstate', handlePopState);
      
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [pageHistory.length, handleBack]);

  // 渲染当前页面
  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <HomePage onPageChange={handlePageChange} params={pageParams} />;
      case 'accounts':
        return <AccountsPage onPageChange={handlePageChange} />;
      case 'account-edit':
        return <AccountEditPage onPageChange={handlePageChange} accountId={pageParams?.accountId} />;
      case 'record':
        return <RecordPage onPageChange={handlePageChange} />;
      case 'record-logs':
        return (
          <RecordLogsPage 
            onPageChange={handlePageChange} 
            year={pageParams?.year || new Date().getFullYear()}
            month={pageParams?.month}
            mode={pageParams?.mode || 'monthly'}
          />
        );
      case 'trend':
        return <TrendPage onPageChange={handlePageChange} />;
      case 'settings':
        return <SettingsPage onPageChange={handlePageChange} />;
      default:
        return <HomePage onPageChange={handlePageChange} />;
    }
  };

  // 判断是否显示底部导航栏
  const showBottomNav = ['home', 'record', 'trend', 'settings'].includes(currentPage);

  // 包装 onPageChange，用于子页面的返回按钮
  const handlePageChangeWithHistory = useCallback((page: PageRoute, params?: any) => {
    if (page === 'home' && currentPage !== 'home') {
      // 直接返回首页时，清空历史栈
      setPageHistory([{ page: 'home', params }]);
      setCurrentPage('home');
      setPageParams(params);
      window.scrollTo(0, 0);
    } else {
      handlePageChange(page, params);
    }
  }, [currentPage, handlePageChange]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 页面内容 */}
      <main className="max-w-md mx-auto">
        {renderPage()}
      </main>

      {/* 底部导航栏 */}
      {showBottomNav && (
        <div className="max-w-md mx-auto">
          <BottomNav currentPage={currentPage} onPageChange={handlePageChangeWithHistory} />
        </div>
      )}
    </div>
  );
}

export default App;