import { useState } from 'react';
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

  // 处理页面切换
  const handlePageChange = (page: PageRoute, params?: any) => {
    setCurrentPage(page);
    setPageParams(params);
    window.scrollTo(0, 0);
  };

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 页面内容 */}
      <main className="max-w-md mx-auto">
        {renderPage()}
      </main>

      {/* 底部导航栏 */}
      {showBottomNav && (
        <div className="max-w-md mx-auto">
          <BottomNav currentPage={currentPage} onPageChange={handlePageChange} />
        </div>
      )}
    </div>
  );
}

export default App;
