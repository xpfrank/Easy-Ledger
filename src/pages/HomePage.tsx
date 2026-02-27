import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, ChevronUp, Wallet, Eye, EyeOff, Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/Icon';
import type { Account, AccountType, PageRoute, ThemeType } from '@/types';
import { 
  getAllAccounts, 
  getMonthlyRecordsByMonth, 
  formatAmountNoSymbol,
  getSettings,
  updateSettings,
} from '@/lib/storage';
import { 
  calculateNetWorth, 
  calculateTotalAssets,
  calculateTotalLiabilities,
  calculateLoanOut, 
  calculateDebtIn,
  ACCOUNT_TYPES,
} from '@/lib/calculator';
import { THEMES } from '@/types';

interface HomePageProps {
  onPageChange: (page: PageRoute, params?: any) => void;
  params?: any;
}

interface AccountGroup {
  type: AccountType;
  label: string;
  accounts: Account[];
  totalBalance: number;
  isExpanded: boolean;
}

// 隐藏金额显示
function formatHiddenAmount(amount: number, hide: boolean): string {
  if (hide) {
    return '******';
  }
  return formatAmountNoSymbol(amount);
}

export function HomePage({ onPageChange, params }: HomePageProps) {
  const [theme, setTheme] = useState<ThemeType>('blue');
  const [hideBalance, setHideBalance] = useState(false);
  const [netWorth, setNetWorth] = useState(0);
  // const [totalAssets, setTotalAssets] = useState(0);
  // const [totalLiabilities, setTotalLiabilities] = useState(0);
  const [lastMonthNetWorth, setLastMonthNetWorth] = useState(0);
  const [loanOut, setLoanOut] = useState(0);
  const [debtIn, setDebtIn] = useState(0);
  const [accountGroups, setAccountGroups] = useState<AccountGroup[]>([]);
  const [currentYear] = useState(new Date().getFullYear());
  const [currentMonth] = useState(new Date().getMonth() + 1);

  const themeConfig = THEMES[theme];

  // 页面显示时自动刷新数据
  useEffect(() => {
    const settings = getSettings();
    setHideBalance(settings.hideBalance);
    setTheme(settings.theme || 'blue');
    loadData();
  });

  // 检测 params 中的 refresh 标记
  useEffect(() => {
    if (params?.refresh) {
      loadData();
    }
  }, [params]);

  const loadData = () => {
    const assets = calculateTotalAssets(currentYear, currentMonth);
    const liabilities = calculateTotalLiabilities(currentYear, currentMonth);
    const worth = assets - liabilities;
    
    // setTotalAssets(assets);
    // setTotalLiabilities(liabilities);
    setNetWorth(worth);

    let lastYear = currentYear;
    let lastMonth = currentMonth - 1;
    if (lastMonth === 0) {
      lastYear--;
      lastMonth = 12;
    }
    const lastWorth = calculateNetWorth(lastYear, lastMonth);
    setLastMonthNetWorth(lastWorth);

    setLoanOut(calculateLoanOut(currentYear, currentMonth));
    setDebtIn(calculateDebtIn(currentYear, currentMonth));

    const accounts = getAllAccounts().filter(a => !a.isHidden);
    const records = getMonthlyRecordsByMonth(currentYear, currentMonth);

    const groups: AccountGroup[] = [];
    for (const typeConfig of ACCOUNT_TYPES) {
      const typeAccounts = accounts.filter(a => a.type === typeConfig.type);
      if (typeAccounts.length === 0) continue;

      let totalBalance = 0;
      for (const account of typeAccounts) {
        const record = records.find(r => r.accountId === account.id);
        const balance = record ? record.balance : account.balance;
        totalBalance += balance;
      }

      groups.push({
        type: typeConfig.type,
        label: typeConfig.label,
        accounts: typeAccounts,
        totalBalance,
        isExpanded: true,
      });
    }

    setAccountGroups(groups);
  };

  const toggleHideBalance = () => {
    const newValue = !hideBalance;
    setHideBalance(newValue);
    updateSettings({ hideBalance: newValue });
  };

  const toggleGroup = (type: AccountType) => {
    setAccountGroups(prev => 
      prev.map(g => 
        g.type === type ? { ...g, isExpanded: !g.isExpanded } : g
      )
    );
  };

  const netWorthChange = netWorth - lastMonthNetWorth;
  const netWorthChangePercent = lastMonthNetWorth !== 0 
    ? (netWorthChange / Math.abs(lastMonthNetWorth)) * 100 
    : 0;

  return (
    <div className="pb-20 min-h-screen" style={{ backgroundColor: themeConfig.bgLight }}>
      {/* 标题栏 */}
      <header 
        className="px-4 py-3 flex justify-between items-center sticky top-0 z-10"
        style={{ backgroundColor: themeConfig.primary }}
      >
        <h1 className="text-xl font-semibold text-white">资产</h1>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-white hover:bg-white/20"
          onClick={() => onPageChange('account-edit')}
        >
          <Plus size={18} className="mr-1" />
          添加账户
        </Button>
      </header>

      <div className="p-4 space-y-3">
        {/* 净资产总览卡片 - 参考图1样式 */}
        <Card 
          className="text-white border-0 shadow-lg overflow-hidden relative"
          style={{ 
            background: `linear-gradient(135deg, ${themeConfig.gradientFrom} 0%, ${themeConfig.gradientTo} 100%)` 
          }}
        >
          <CardContent className="p-5">
            {/* 余额隐藏按钮 - 右下角 */}
            <button 
              onClick={toggleHideBalance}
              className="absolute right-4 bottom-4 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
            >
              {hideBalance ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>

            {/* 只显示净资产 */}
            <div>
              <div className="text-white/80 text-sm mb-1">净资产（元）</div>
              <div className="text-3xl font-bold tracking-tight">
                ¥{formatHiddenAmount(netWorth, hideBalance)}
              </div>
              <div className="flex items-center text-xs mt-2">
                <span className="text-white/70">较上月</span>
                <span className={`ml-1 font-medium ${netWorthChange >= 0 ? 'text-white' : 'text-red-200'}`}>
                  {netWorthChange >= 0 ? '+' : ''}{formatAmountNoSymbol(netWorthChange)}
                </span>
                <span className={`ml-1 ${netWorthChange >= 0 ? 'text-white' : 'text-red-200'}`}>
                  ({netWorthChange >= 0 ? '+' : ''}{netWorthChangePercent.toFixed(1)}%)
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 借出借入卡片 */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-white">
            <CardContent className="p-4 text-center">
              <div className="text-sm text-gray-500 mb-1">借出</div>
              <div className="text-lg font-semibold text-gray-800">
                ¥{formatHiddenAmount(loanOut, hideBalance)}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardContent className="p-4 text-center">
              <div className="text-sm text-gray-500 mb-1">借入</div>
              <div className="text-lg font-semibold text-gray-800">
                ¥{formatHiddenAmount(debtIn, hideBalance)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 账户分组列表 */}
        <div className="space-y-2">
          <div className="flex justify-between items-center px-1">
            <h2 className="text-sm font-medium text-gray-500">账户列表</h2>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8"
              style={{ color: themeConfig.primary }}
              onClick={() => onPageChange('accounts')}
            >
              管理账户
            </Button>
          </div>

          {accountGroups.length === 0 ? (
            <Card className="bg-white">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                  <Wallet size={28} className="text-gray-400" />
                </div>
                <p className="text-gray-500 mb-4">还没有账户，添加一个吧</p>
                <Button 
                  className="text-white"
                  style={{ backgroundColor: themeConfig.primary }}
                  onClick={() => onPageChange('account-edit')}
                >
                  <Icon name="plus" size={18} className="mr-1" />
                  添加账户
                </Button>
              </CardContent>
            </Card>
          ) : (
            accountGroups.map((group) => (
              <Card key={group.type} className="bg-white overflow-hidden">
                {/* 分组标题 */}
                <div 
                  className="flex items-center justify-between p-3 bg-gray-50 cursor-pointer"
                  onClick={() => toggleGroup(group.type)}
                >
                  <div className="flex items-center gap-2">
                    <Icon 
                      name={getAccountTypeIcon(group.type)} 
                      size={18} 
                      className={group.type === 'credit' || group.type === 'debt' ? 'text-red-500' : ''}
                      color={group.type === 'credit' || group.type === 'debt' ? undefined : themeConfig.primary}
                    />
                    <span className="font-medium text-sm">{group.label}</span>
                    <span className="text-xs text-gray-400">({group.accounts.length})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${
                      group.totalBalance < 0 ? 'text-green-600' : 
                      group.type === 'credit' || group.type === 'debt' ? 'text-red-500' : ''
                    }`}>
                      ¥{formatHiddenAmount(group.totalBalance, hideBalance)}
                    </span>
                    {group.isExpanded ? (
                      <ChevronUp size={16} className="text-gray-400" />
                    ) : (
                      <ChevronDown size={16} className="text-gray-400" />
                    )}
                  </div>
                </div>

                {/* 账户列表 */}
                {group.isExpanded && (
                  <div className="divide-y divide-gray-100">
                    {group.accounts.map((account) => {
                      const records = getMonthlyRecordsByMonth(currentYear, currentMonth);
                      const record = records.find(r => r.accountId === account.id);
                      const balance = record ? record.balance : account.balance;
                      const isCredit = account.type === 'credit';
                      const isDebt = account.type === 'debt';

                      return (
                        <div 
                          key={account.id}
                          className="flex items-center justify-between p-3 hover:bg-gray-50 cursor-pointer"
                          onClick={() => onPageChange('account-edit', { accountId: account.id })}
                        >
                          <div className="flex items-center gap-3">
                            <div 
                              className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                                isCredit || isDebt ? 'bg-red-50' : ''
                              }`}
                              style={{ backgroundColor: isCredit || isDebt ? undefined : `${themeConfig.primary}15` }}
                            >
                              <Icon 
                                name={account.icon} 
                                size={18} 
                                className={isCredit || isDebt ? 'text-red-500' : ''}
                                color={isCredit || isDebt ? undefined : themeConfig.primary}
                              />
                            </div>
                            <div>
                              <div className="font-medium text-sm">{account.name}</div>
                              {account.note && (
                                <div className="text-xs text-gray-400">{account.note}</div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium ${
                              isCredit ? (balance > 0 ? 'text-red-500' : 'text-green-600') : 
                              isDebt ? 'text-red-500' : ''
                            }`}>
                              {isCredit && balance > 0 ? '欠' : ''}
                              ¥{formatHiddenAmount(isDebt ? Math.abs(balance) : balance, hideBalance)}
                            </span>
                            <ChevronRight size={16} className="text-gray-300" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function getAccountTypeIcon(type: AccountType): string {
  const iconMap: Record<AccountType, string> = {
    'cash': 'banknote',
    'debit': 'credit-card',
    'credit': 'credit-card',
    'digital': 'wallet',
    'investment': 'trending-up',
    'loan': 'handshake',
    'debt': 'clipboard',
  };
  return iconMap[type] || 'circle';
}
