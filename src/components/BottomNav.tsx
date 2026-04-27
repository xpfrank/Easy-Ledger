import { Home, Edit3, TrendingUp, Settings } from 'lucide-react';
import type { PageRoute } from '@/types';

interface BottomNavProps {
  currentPage: PageRoute;
  onPageChange: (page: PageRoute) => void;
  themeConfig?: {
    primary: string;
  };
}

const navItems: { page: PageRoute; label: string; icon: typeof Home }[] = [
  { page: 'home', label: '首页', icon: Home },
  { page: 'record', label: '记账', icon: Edit3 },
  { page: 'trend', label: '趋势', icon: TrendingUp },
  { page: 'settings', label: '设置', icon: Settings },
];

export function BottomNav({ currentPage, onPageChange, themeConfig }: BottomNavProps) {
  const activeColor = themeConfig?.primary || '#0ea5e9';
  
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 safe-area-bottom z-50">
      <div className="flex justify-around items-center h-14 max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = currentPage === item.page;
          const Icon = item.icon;
          
          return (
            <button
              key={item.page}
              onClick={() => onPageChange(item.page)}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                isActive ? '' : 'text-gray-400'
              }`}
              style={isActive ? { color: activeColor } : undefined}
            >
              <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              <span className={`text-xs mt-0.5 ${isActive ? 'font-medium' : ''}`} style={isActive ? { color: activeColor } : undefined}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
