import { useState, useEffect } from 'react';
import { ChevronRight, Eye, EyeOff, Plus, Handshake, ClipboardList } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { YearlyGoalCard } from '@/components/home/YearlyGoalCard';
import { AssetCockpitCard } from '@/components/home/AssetCockpitCard';
import { AssetAllocCard } from '@/components/home/AssetAllocCard';
import { GoalDetailModal } from '@/components/home/GoalDetailModal';
import { GoalEditModal } from '@/components/home/GoalEditModal';
import { HealthDetailModal } from '@/components/home/HealthDetailModal';
import { LifeStageSheet } from '@/components/home/LifeStageSheet';
import { ReferenceIntervalSheet } from '@/components/home/ReferenceIntervalSheet';
import { QuickClassifyFlow } from '@/components/home/QuickClassifyFlow';
import type { AssetCategoryKey } from '@/lib/allocation-config';
import { GoalBadge } from '@/components/home/BadgeComponents';
import type { Account, AccountType, PageRoute, ThemeType, YearlyGoal, HealthScore } from '@/types';
import {
  getAccountsForMonth,
  getAccountBalanceForMonth,
  formatAmountNoSymbol,
  getExpandedGroups,
  getSettings,
  getYearlyGoal,
  saveYearlyGoal,
  convertToBaseCurrency,
  saveHealthHistory,
  getQCDismissedTotal,
  setQCDismissedTotal,
  getReferenceIntervals,
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
import { THEMES, getCurrencyConfig } from '@/types';

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
  const [lastMonthNetWorth, setLastMonthNetWorth] = useState(0);
  const [loanOut, setLoanOut] = useState(0);
  const [debtIn, setDebtIn] = useState(0);
  const [accountGroups, setAccountGroups] = useState<AccountGroup[]>([]);
  const [currentYear] = useState(new Date().getFullYear());
  const [currentMonth] = useState(new Date().getMonth() + 1);

  const [showGoalDetail, setShowGoalDetail] = useState(false);
  const [showHealthDetail, setShowHealthDetail] = useState(false);
  const [showGoalEdit, setShowGoalEdit] = useState(false);
  const [showLifeStageSheet, setShowLifeStageSheet] = useState(false);
  const [configKey, setConfigKey] = useState(0);
  const [showIntervalSheet, setShowIntervalSheet] = useState(false);
  const [intervalFocusCategory, setIntervalFocusCategory] = useState<AssetCategoryKey | undefined>();
  const [showQCFlow, setShowQCFlow] = useState(false);
  const [qcReclassify, setQcReclassify] = useState(false);
  const [yearlyGoal, setYearlyGoal] = useState<YearlyGoal | null>(null);
  const [goalProgress, setGoalProgress] = useState<{
    progress: number;
    estimatedMonthsToGoal: number;
    isOnTrack: boolean;
    monthlyGrowthRate: number;
  } | null>(null);
  const [healthScore, setHealthScore] = useState<HealthScore | null>(null);
  const [scoreChange, setScoreChange] = useState(0);
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [classifiedCount, setClassifiedCount] = useState(0);
  const [currentAllocations, setCurrentAllocations] = useState<{
    cash: number;
    stable: number;
    invest: number;
    insure: number;
  }>({ cash: 0, stable: 0, invest: 0, insure: 0 });

  const themeConfig = THEMES[theme];
  const baseCurrencyCode = getSettings().baseCurrency || 'CNY';
  const currencySymbol = getCurrencyConfig(baseCurrencyCode).symbol;

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
    setAllAccounts(accounts);

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

    const categoryAmounts = { cash: 0, stable: 0, invest: 0, insure: 0 };
    accounts.forEach(account => {
      if (account.assetCategory && account.assetCategory in categoryAmounts) {
        const balance = getAccountBalanceForMonth(account.id, currentYear, currentMonth);
        const converted = convertToBaseCurrency(balance, account.currency || 'CNY', currentYear, currentMonth);
        categoryAmounts[account.assetCategory as keyof typeof categoryAmounts] += converted;
      }
    });
    setCurrentAllocations(categoryAmounts);

    const intervals = getReferenceIntervals();
    const health = calculateHealthScore(accounts, currentYear, currentMonth, categoryAmounts, intervals);

    const lastMonthCategory = { cash: 0, stable: 0, invest: 0, insure: 0 };
    lastAccounts.forEach(account => {
      if (account.assetCategory && account.assetCategory in lastMonthCategory) {
        const balance = getAccountBalanceForMonth(account.id, lastYear, lastMonth);
        const converted = convertToBaseCurrency(balance, account.currency || 'CNY', lastYear, lastMonth);
        lastMonthCategory[account.assetCategory as keyof typeof lastMonthCategory] += converted;
      }
    });
    const lastMonthHealth = calculateHealthScore(lastAccounts, lastYear, lastMonth, lastMonthCategory, intervals);
    setScoreChange(health.score - lastMonthHealth.score);
    
    setHealthScore(health);

    // 保存健康评分历史
    saveHealthHistory(currentYear, currentMonth, health.score, health.level);

    // 计算已分类账户数量
    const classified = accounts.filter(a => a.assetCategory != null).length;
    setClassifiedCount(classified);

    const savedExpandedGroups = getExpandedGroups();

    setAccountGroups(() => {
      const groups: AccountGroup[] = [];

      // Standard type groups (exclude custom type accounts)
      for (const typeConfig of ACCOUNT_TYPES) {
        const typeAccounts = accounts.filter(a => a.type === typeConfig.type && !a.customTypeLabel);
        if (typeAccounts.length === 0) continue;

        let totalBalance = 0;
        for (const account of typeAccounts) {
          const balance = getAccountBalanceForMonth(account.id, currentYear, currentMonth);
          const converted = convertToBaseCurrency(balance, account.currency || 'CNY', currentYear, currentMonth);
          totalBalance += converted;
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

      // Custom type groups
      const customTypeMap = new Map<string, typeof accounts>();
      for (const acc of accounts) {
        if (acc.customTypeLabel) {
          if (!customTypeMap.has(acc.customTypeLabel)) customTypeMap.set(acc.customTypeLabel, []);
          customTypeMap.get(acc.customTypeLabel)!.push(acc);
        }
      }
      for (const [label, typeAccounts] of customTypeMap) {
        const groupKey = `custom_${label}`;
        let totalBalance = 0;
        for (const account of typeAccounts) {
          const balance = getAccountBalanceForMonth(account.id, currentYear, currentMonth);
          const converted = convertToBaseCurrency(balance, account.currency || 'CNY', currentYear, currentMonth);
          totalBalance += converted;
        }
        const isExpanded = savedExpandedGroups[groupKey] !== undefined
          ? savedExpandedGroups[groupKey]
          : true;
        groups.push({
          type: groupKey as any,
          label,
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
        {/* 净资产总览卡片 */}
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
                    {currencySymbol}{formatHiddenAmount(netWorth, hideBalance)}
                  </div>
                </div>
              </div>
              {/* 较上月 + 共 * 个账户 合并在一行 */}
              <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
                <div className="flex items-center gap-2 text-xs flex-wrap">
                  <div className="flex items-center">
                    <span className="text-white/70">较上月</span>
                    <span className={`ml-1 font-medium ${netWorthChange >= 0 ? 'text-white' : 'text-red-200'}`}>
                      {hideBalance ? '' : (netWorthChange >= 0 ? '+' : '')}{hideBalance ? '******' : formatAmountNoSymbol(netWorthChange)}
                    </span>
                    <span className={`ml-1 ${netWorthChange >= 0 ? 'text-white' : 'text-red-200'}`}>
                      {hideBalance ? '' : `(${netWorthChange >= 0 ? '+' : ''}${netWorthChangePercent.toFixed(1)}%)`}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="text-white/90 font-semibold underline underline-offset-2 decoration-white/50"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPageChange('trend');
                    }}
                  >
                    查看趋势
                  </button>
                </div>
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full border border-white/40 bg-white/15 backdrop-blur-sm active:bg-white/25 transition-all hover:bg-white/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPageChange('accounts');
                  }}
                >
                  <span className="text-white">共 {hideBalance ? '**' : visibleAccountCount} 个账户</span>
                  <ChevronRight size={14} className="text-white" />
                </button>
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
                {currencySymbol}{formatHiddenAmount(loanOut, hideBalance)}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardContent className="p-3 text-center">
              <div className="w-10 h-10 rounded-full mx-auto mb-1.5 flex items-center justify-center" style={{ backgroundColor: `${themeConfig.primary}18` }}>
                <ClipboardList size={18} style={{ color: themeConfig.primary }} />
              </div>
              <div className="text-xs text-gray-500 mb-0.5">借入</div>
              <div className="text-sm font-bold text-gray-800">
                {currencySymbol}{formatHiddenAmount(debtIn, hideBalance)}
              </div>
            </CardContent>
          </Card>
        </div>        {/* 年度目标卡片 */}
        <YearlyGoalCard
          goal={yearlyGoal}
          goalProgress={goalProgress}
          currentNetWorth={netWorth}
          primaryColor={themeConfig.primary}
          hideBalance={hideBalance}
          baseCurrencySymbol={currencySymbol}
          onClick={handleGoalClick}
          onSetGoal={() => setShowGoalEdit(true)}
        />

        {/* 资产健康驾驶舱卡片 */}
        <AssetCockpitCard
          healthScore={healthScore || { score: 0, level: 'D', configScore: { score: 0, level: 'D', categoryScores: {} }, volatilityScore: { score: 0, level: 'D', standardDeviation: 0 }, attributionCompleteness: 0 }}
          scoreChange={scoreChange}
          primaryColor={themeConfig.primary}
          configKey={configKey}
          isEmpty={allAccounts.length === 0}
          onClick={() => setShowHealthDetail(true)}
          onStageClick={() => setShowLifeStageSheet(true)}
          onIntervalSettingsClick={() => {
            setIntervalFocusCategory(undefined);
            setShowIntervalSheet(true);
          }}
          onClassifyClick={() => { setQcReclassify(false); setShowQCFlow(true); }}
          onAddAccount={() => onPageChange('account-edit')}
          classifiedCount={classifiedCount}
          totalCount={allAccounts.length}
          currentAllocations={currentAllocations}
          hideBalance={hideBalance}
        />



        {/* 资产配置结构卡片 */}
        <AssetAllocCard
          accounts={allAccounts}
          categoryAmounts={currentAllocations}
          currentAllocations={currentAllocations}
          primaryColor={themeConfig.primary}
          configKey={configKey}
          hasClassifiedAccounts={classifiedCount > 0}
          onClassifyClick={() => { setQcReclassify(false); setShowQCFlow(true); }}
          onReclassifyClick={() => { setQcReclassify(true); setShowQCFlow(true); }}
          hideBalance={hideBalance}
        />



      </div>

      {/* 年度目标详情弹窗 */}
      {showGoalDetail && goalProgress && yearlyGoal && (
        <GoalDetailModal
          goal={yearlyGoal}
          goalProgress={goalProgress}
          currentNetWorth={netWorth}
          hideBalance={hideBalance}
          primaryColor={themeConfig.primary}
          baseCurrencySymbol={currencySymbol}
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
          currentAllocations={currentAllocations}
          onClose={() => setShowHealthDetail(false)}
          onAdjustIntervals={() => {
            setShowHealthDetail(false);
            setIntervalFocusCategory(undefined);
            setShowIntervalSheet(true);
          }}
          onAdjustCategoryInterval={(cat) => {
            setShowHealthDetail(false);
            setIntervalFocusCategory(cat);
            setShowIntervalSheet(true);
          }}
          onViewTrend={() => {
            setShowHealthDetail(false);
            onPageChange('trend');
          }}
          hideBalance={hideBalance}
          baseCurrencySymbol={currencySymbol}
        />
      )}

      {/* 人生阶段选择 Sheet */}
      {showLifeStageSheet && (
        <LifeStageSheet
          primaryColor={themeConfig.primary}
          onClose={() => setShowLifeStageSheet(false)}
          onConfirm={() => {
            setConfigKey((k) => k + 1);
            loadData();
          }}
        />
      )}

      {showIntervalSheet && (
        <ReferenceIntervalSheet
          primaryColor={themeConfig.primary}
          focusCategory={intervalFocusCategory}
          onClose={() => {
            setShowIntervalSheet(false);
            setIntervalFocusCategory(undefined);
          }}
          onSaved={() => {
            setConfigKey((k) => k + 1);
            loadData();
          }}
        />
      )}

      {/* Quick Classification Flow */}
      {showQCFlow && (
        <QuickClassifyFlow
          unclassifiedAccounts={allAccounts.filter(a => a.assetCategory == null)}
          allAccounts={allAccounts}
          reclassify={qcReclassify}
          primaryColor={themeConfig.primary}
          onComplete={() => {
            setShowQCFlow(false);
            loadData();
          }}
          onDismiss={() => {
            setShowQCFlow(false);
            setQCDismissedTotal(allAccounts.length);
          }}
          hideBalance={hideBalance}
          baseCurrencySymbol={currencySymbol}
        />
      )}
    </div>
  );
}
