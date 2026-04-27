import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, ChevronUp, Wallet, Eye, EyeOff, Plus, Handshake, ClipboardList } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/Icon';
import { YearlyGoalCard } from '@/components/home/YearlyGoalCard';
import { HealthScoreCard } from '@/components/home/HealthScoreCard';
import { GoalDetailModal } from '@/components/home/GoalDetailModal';
import { GoalEditModal } from '@/components/home/GoalEditModal';
import { HealthDetailModal } from '@/components/home/HealthDetailModal';
import { GoalBadge, HealthBadge } from '@/components/home/BadgeComponents';
import type { Account, AccountType, PageRoute, ThemeType, YearlyGoal, HealthScore } from '@/types';
import {
  getAccountsForMonth,
  getMonthlyRecordsByMonth,
  getAccountBalanceForMonth,
  formatAmountNoSymbol,
  getExpandedGroups,
  saveExpandedGroups,
  getSettings,
  getYearlyGoal,
  saveYearlyGoal,
  getAllAttributions,
} from '@/lib/storage';
import {
  calculateNetWorth,
  calculateTotalAssets,
  calculateTotalLiabilities,
  calculateLoanOut,
  calculateDebtIn,
  ACCOUNT_TYPES,
} from '@/lib/calculator';
import { calculateHealthScore, calculateGoalProgress } from '@/lib/health-calculator';
import { THEMES } from '@/types';

interface HomePageProps {
  onPageChange: (page: PageRoute, params?: any) => void;
  params?: any;
  hideBalance: boolean;
  toggleHideBalance: () => void;
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

export function HomePage({ onPageChange, params, hideBalance, toggleHideBalance }: HomePageProps) {
  const [theme, setTheme] = useState<ThemeType>('blue');
  const [netWorth, setNetWorth] = useState(0);
  // const [totalAssets, setTotalAssets] = useState(0);
  // const [totalLiabilities, setTotalLiabilities] = useState(0);
  const [lastMonthNetWorth, setLastMonthNetWorth] = useState(0);
  const [loanOut, setLoanOut] = useState(0);
  const [debtIn, setDebtIn] = useState(0);
  const [accountGroups, setAccountGroups] = useState<AccountGroup[]>([]);
  const [currentYear] = useState(new Date().getFullYear());
  const [currentMonth] = useState(new Date().getMonth() + 1);

  const [showGoalDetail, setShowGoalDetail] = useState(false);
  const [showHealthDetail, setShowHealthDetail] = useState(false);
  const [showGoalEdit, setShowGoalEdit] = useState(false);
  const [yearlyGoal, setYearlyGoal] = useState<YearlyGoal | null>(null);
  const [goalProgress, setGoalProgress] = useState<{
    progress: number;
    estimatedMonthsToGoal: number;
    isOnTrack: boolean;
    monthlyGrowthRate: number;
  } | null>(null);
  const [healthScore, setHealthScore] = useState<HealthScore | null>(null);

  const themeConfig = THEMES[theme];

  // 页面显示时自动刷新数据
  useEffect(() => {
    const settings = getSettings();
    const validThemes: ThemeType[] = ['blue', 'green', 'orange', 'dark', 'purple'];
    const themeValue = validThemes.includes(settings.theme as ThemeType) ? settings.theme : 'blue';
    setTheme(themeValue as ThemeType);
    loadData();
  }, [hideBalance]);

  // 检测 params 中的 refresh 标记
  useEffect(() => {
    if (params?.refresh) {
      loadData();
    }
  }, [params]);

  const loadData = () => {
    const accounts = getAccountsForMonth(currentYear, currentMonth).filter(a => !a.isHidden);

    const assets = calculateTotalAssets(accounts, currentYear, currentMonth);
    const liabilities = calculateTotalLiabilities(accounts, currentYear, currentMonth);
    const worth = assets - liabilities;

    setNetWorth(worth);

    let lastYear = currentYear;
    let lastMonth = currentMonth - 1;
    if (lastMonth === 0) {
      lastYear--;
      lastMonth = 12;
    }
    const lastAccounts = getAccountsForMonth(lastYear, lastMonth).filter(a => !a.isHidden);
    const lastWorth = calculateNetWorth(lastAccounts, lastYear, lastMonth);
    setLastMonthNetWorth(lastWorth);

    setLoanOut(calculateLoanOut(accounts, currentYear, currentMonth));
    setDebtIn(calculateDebtIn(accounts, currentYear, currentMonth));

    const goal = getYearlyGoal() || null;
    setYearlyGoal(goal);
    if (goal) {
      setGoalProgress(calculateGoalProgress(worth, goal));
    }

    const health = calculateHealthScore(accounts, currentYear, currentMonth);
    
    // 修正归因完整度计算
    const allAttributions = getAllAttributions();
    let completedMonths = 0;
    for (let m = 1; m <= 12; m++) {
      const attr = allAttributions.find(a => a.year === currentYear && a.month === m);
      if (attr && attr.tags && attr.tags.length > 0) {
        completedMonths++;
      }
    }
    const monthsToCheck = Math.min(currentMonth, 12);
    const realCompleteness = monthsToCheck > 0 
      ? Math.round((completedMonths / monthsToCheck) * 100) 
      : 0;
    health.attributionCompleteness = realCompleteness;
    
    setHealthScore(health);

    const savedExpandedGroups = getExpandedGroups();

    setAccountGroups(() => {
      const groups: AccountGroup[] = [];
      for (const typeConfig of ACCOUNT_TYPES) {
        const typeAccounts = accounts.filter(a => a.type === typeConfig.type);
        if (typeAccounts.length === 0) continue;

        let totalBalance = 0;
        for (const account of typeAccounts) {
          const balance = getAccountBalanceForMonth(account.id, currentYear, currentMonth);
          totalBalance += balance;
        }

        const isExpanded = savedExpandedGroups[typeConfig.type] !== undefined
          ? savedExpandedGroups[typeConfig.type]
          : true;

        groups.push({
          type: typeConfig.type,
          label: typeConfig.label,
          accounts: typeAccounts,
          totalBalance,
          isExpanded,
        });
      }
      return groups;
    });
  };

  const handleGoalClick = () => {
    if (!yearlyGoal) {
      setShowGoalEdit(true);
    } else {
      setShowGoalDetail(true);
    }
  };

  const handleSaveGoal = (targetAmount: number) => {
    const goal = {
      year: currentYear,
      targetAmount,
      createdAt: Date.now(),
    };

    saveYearlyGoal(goal);
    setYearlyGoal(goal);
    setGoalProgress(calculateGoalProgress(netWorth, goal));
    setShowGoalEdit(false);
  };

  const toggleGroup = (type: AccountType) => {
    // 获取当前状态并更新
    setAccountGroups(prev => {
      const newGroups = prev.map(g =>
        g.type === type ? { ...g, isExpanded: !g.isExpanded } : g
      );

      // 保存展开状态到本地存储
      const expandedState: Record<string, boolean> = {};
      newGroups.forEach(g => {
        expandedState[g.type] = g.isExpanded;
      });
      saveExpandedGroups(expandedState);

      return newGroups;
    });
  };

  // 获取账户数量（用于显示）
  const visibleAccountCount = getAccountsForMonth(currentYear, currentMonth).filter(a => !a.isHidden).length;

  const netWorthChange = netWorth - lastMonthNetWorth;
  const netWorthChangePercent = lastMonthNetWorth !== 0 
    ? (netWorthChange / Math.abs(lastMonthNetWorth)) * 100 
    : 0;

  return (
    <div className="pb-20 min-h-screen" style={{ backgroundColor: themeConfig.bgLight }}>
      {/* 标题栏 */}
      <header 
        className="px-4 py-3 flex justify-between items-center sticky top-0 z-10 rounded-b-2xl"
        style={{ backgroundColor: themeConfig.primary }}
      >
        <h1 className="text-xl font-bold tracking-wide text-white">Easy-Ledger</h1>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-white bg-white/20 hover:bg-white/30 rounded-full px-3"
          onClick={() => onPageChange('account-edit')}
        >
          <Plus size={16} />
          <span className="ml-1">新增账户</span>
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
            {/* 卡片顶部区域：月份标题 + 徽章按钮组 */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/80 text-sm">{currentYear}年{currentMonth}月净资产</span>
              <div className="flex items-center gap-2">
                {yearlyGoal && (
                  <GoalBadge
                    goal={yearlyGoal}
                    currentNetWorth={netWorth}
                    onClick={() => setShowGoalDetail(true)}
                  />
                )}
                {healthScore && (
                  <HealthBadge
                    healthScore={healthScore}
                    onClick={() => setShowHealthDetail(true)}
                  />
                )}
                <button
                  onClick={toggleHideBalance}
                  className="p-2 rounded-full hover:bg-white/20 transition-colors"
                >
                  {hideBalance ? <EyeOff size={18} className="text-white/80" /> : <Eye size={18} className="text-white/80" />}
                </button>
              </div>
            </div>

            {/* 只显示净资产 */}
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white/80 text-sm mb-1">净资产（元）</div>
                  <div className="text-3xl font-bold tracking-tight">
                    ¥{formatHiddenAmount(netWorth, hideBalance)}
                  </div>
                </div>
              </div>
              {/* 较上月 + 共 * 个账户 合并在一行 */}
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center text-xs">
                  <span className="text-white/70">较上月</span>
                  <span className={`ml-1 font-medium ${netWorthChange >= 0 ? 'text-white' : 'text-red-200'}`}>
                    {hideBalance ? '' : (netWorthChange >= 0 ? '+' : '')}{hideBalance ? '******' : formatAmountNoSymbol(netWorthChange)}
                  </span>
                  <span className={`ml-1 ${netWorthChange >= 0 ? 'text-white' : 'text-red-200'}`}>
                    {hideBalance ? '' : `(${netWorthChange >= 0 ? '+' : ''}${netWorthChangePercent.toFixed(1)}%)`}
                  </span>
                </div>
                <span className="text-white/70 text-xs">
                  共 {hideBalance ? '**' : visibleAccountCount} 个账户
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 借出借入卡片 - 缩小尺寸 */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-white">
            <CardContent className="p-3 text-center">
              <div className="w-10 h-10 rounded-full mx-auto mb-1.5 flex items-center justify-center" style={{ backgroundColor: `${themeConfig.primary}18` }}>
                <Handshake size={18} style={{ color: themeConfig.primary }} />
              </div>
              <div className="text-xs text-gray-500 mb-0.5">借出</div>
              <div className="text-sm font-bold text-gray-800">
                ¥{formatHiddenAmount(loanOut, hideBalance)}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardContent className="p-3 text-center">
              <div className="w-10 h-10 rounded-full mx-auto mb-1.5 flex items-center justify-center" style={{ backgroundColor: '#e8f5e9' }}>
                <ClipboardList size={18} style={{ color: '#4caf50' }} />
              </div>
              <div className="text-xs text-gray-500 mb-0.5">借入</div>
              <div className="text-sm font-bold text-gray-800">
                ¥{formatHiddenAmount(debtIn, hideBalance)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 年度目标 & 健康度分析卡片 - 独立区域，借贷统计下方、账户列表上方 */}
        <YearlyGoalCard
          goal={yearlyGoal}
          goalProgress={goalProgress}
          currentNetWorth={netWorth}
          primaryColor={themeConfig.primary}
          hideBalance={hideBalance}
          onClick={handleGoalClick}
          onSetGoal={() => setShowGoalEdit(true)}
        />

        {healthScore && (
          <HealthScoreCard
            healthScore={healthScore}
            primaryColor={themeConfig.primary}
            onClick={() => setShowHealthDetail(true)}
          />
        )}

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
                  className="flex items-center justify-between p-3.5 bg-white cursor-pointer select-none border-b border-gray-100 hover:bg-gray-50"
                  onClick={() => toggleGroup(group.type)}
                >
                  <div className="flex items-center gap-2.5">
                    <div 
                      className="w-7 h-7 rounded-lg flex items-center justify-center bg-white shadow-sm"
                      style={{ 
                        color: group.type === 'credit' || group.type === 'debt' ? '#ef4444' : themeConfig.primary 
                      }}
                    >
                      <Icon 
                        name={getAccountTypeIcon(group.type)} 
                        size={16} 
                      />
                    </div>
                    <span className="font-semibold text-sm text-gray-800">{group.label}</span>
                    <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded-full shadow-sm">{group.accounts.length}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${
                      group.type === 'credit' && group.totalBalance < 0 ? 'text-green-600' : 
                      group.type === 'credit' || group.type === 'debt' ? 'text-red-500' : ''
                    }`}>
                      {group.type === 'credit' ? (group.totalBalance > 0 ? '欠款' : '溢缴') : ''}
                      ¥{formatHiddenAmount(group.type === 'credit' || group.type === 'debt' ? Math.abs(group.totalBalance) : group.totalBalance, hideBalance)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleGroup(group.type);
                      }}
                      className="p-1.5 rounded-full bg-white hover:bg-gray-100 transition-colors text-gray-500 shadow-sm"
                    >
                      {group.isExpanded ? (
                        <ChevronUp size={16} />
                      ) : (
                        <ChevronDown size={16} />
                      )}
                    </button>
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
                          onClick={() => onPageChange('account-detail', { accountId: account.id })}
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
                              {isCredit ? (balance > 0 ? '欠款' : '溢缴') : ''}
                              ¥{formatHiddenAmount(isDebt ? Math.abs(balance) : isCredit ? Math.abs(balance) : balance, hideBalance)}
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

      {/* 年度目标详情弹窗 */}
      {showGoalDetail && goalProgress && yearlyGoal && (
        <GoalDetailModal
          goal={yearlyGoal}
          goalProgress={goalProgress}
          currentNetWorth={netWorth}
          hideBalance={hideBalance}
          primaryColor={themeConfig.primary}
          onClose={() => setShowGoalDetail(false)}
          onEdit={() => {
            setShowGoalDetail(false);
            setShowGoalEdit(true);
          }}
        />
      )}

      {/* 年度目标编辑弹窗 */}
      {showGoalEdit && (
        <GoalEditModal
          currentYear={currentYear}
          primaryColor={themeConfig.primary}
          onClose={() => setShowGoalEdit(false)}
          onSave={handleSaveGoal}
        />
      )}

      {/* 健康度详情弹窗 */}
      {showHealthDetail && healthScore && (
        <HealthDetailModal
          healthScore={healthScore}
          primaryColor={themeConfig.primary}
          onClose={() => setShowHealthDetail(false)}
        />
      )}
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
