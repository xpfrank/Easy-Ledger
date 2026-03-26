import { useState, useEffect, useCallback, useRef } from 'react';
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

function App() {
  const [currentPage, setCurrentPage] = useState<PageRoute>('home');
  const [pageParams, setPageParams] = useState<any>(null);
  // 页面历史栈，用于返回逻辑
  const [pageHistory, setPageHistory] = useState<{ page: PageRoute; params: any }[]>([{ page: 'home', params: null }]);
  // 双击退出提示状态
  const [showExitHint, setShowExitHint] = useState(false);
  // 使用 ref 存储最新的 pageHistory，确保返回键回调获取最新值
  const pageHistoryRef = useRef(pageHistory);
  pageHistoryRef.current = pageHistory;
  // 退出提示定时器 ref
  const exitHintTimerRef = useRef<number | null>(null);

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
        // 已经在首页，不处理（双击退出逻辑在返回键处理中）
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

  // 处理首页双击退出
  const handleHomeExit = useCallback(() => {
    // 清除之前的定时器
    if (exitHintTimerRef.current) {
      clearTimeout(exitHintTimerRef.current);
      exitHintTimerRef.current = null;
      // 第二次点击，执行退出
      return true;
    }
    // 第一次点击，显示提示
    setShowExitHint(true);
    // 设置2秒后自动关闭提示
    exitHintTimerRef.current = window.setTimeout(() => {
      setShowExitHint(false);
      exitHintTimerRef.current = null;
    }, 2000);
    return false;
  }, []);

  // 监听 Android 返回键
  useEffect(() => {
    // 检查是否在 Capacitor 环境中
    const isCapacitor = typeof (window as any).Capacitor !== 'undefined';

    let removeListener: (() => void) | undefined;

    if (isCapacitor) {
      // 使用 Capacitor 的 App 插件
      import('@capacitor/app').then((module: any) => {
        const AppPlugin = module.App;
        // 使用 ref 获取最新的 pageHistory，解决闭包问题
        const backButtonHandler = () => {
          if (pageHistoryRef.current.length > 1) {
            // 不在首页，正常返回上一页
            handleBack();
          } else {
            // 在首页，检查是否双击
            const shouldExit = handleHomeExit();
            if (shouldExit) {
              // 双击退出应用
              AppPlugin.exitApp?.();
            }
          }
        };

        // 添加返回键监听器
        AppPlugin.addListener('backButton', backButtonHandler).then((result: any) => {
          removeListener = result.remove;
        }).catch((err: any) => {
          console.warn('Failed to add backButton listener:', err);
        });
      }).catch(err => {
        console.warn('Capacitor App plugin not found:', err);
      });

      return () => {
        // 清理监听器
        if (removeListener) {
          removeListener();
        }
        // 清理定时器
        if (exitHintTimerRef.current) {
          clearTimeout(exitHintTimerRef.current);
        }
      };
    } else {
      // 浏览器环境：监听 popstate
      const handlePopState = () => {
        if (pageHistoryRef.current.length > 1) {
          handleBack();
          // 阻止默认的返回行为
          window.history.pushState(null, '', window.location.href);
        } else {
          // 首页，检查是否双击
          const shouldExit = handleHomeExit();
          if (!shouldExit) {
            // 阻止退出
            window.history.pushState(null, '', window.location.href);
          }
        }
      };

      window.history.pushState(null, '', window.location.href);
      window.addEventListener('popstate', handlePopState);

      return () => {
        window.removeEventListener('popstate', handlePopState);
        // 清理定时器
        if (exitHintTimerRef.current) {
          clearTimeout(exitHintTimerRef.current);
        }
      };
    }
  }, [handleBack, handleHomeExit]);

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

      {/* 双击退出提示 */}
      {showExitHint && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[100]">
          <div className="bg-gray-800 text-white px-6 py-3 rounded-full shadow-lg animate-pulse">
            <span className="text-sm">再按一次返回键退出应用</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;