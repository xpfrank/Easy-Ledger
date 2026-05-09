import { useState, useEffect } from 'react';
import { ChevronRight, Wallet, Eye, EyeOff, Plus, Handshake, ClipboardList } from 'lucide-react';
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
  getAccountBalanceForMonth,
  formatAmountNoSymbol,
  getExpandedGroups,
  getSettings,
  getYearlyGoal,
  saveYearlyGoal,
  getAllAttributions,
  getCustomAccountTypes,
  convertToBaseCurrency,
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

// SVG 环形图辅助函数
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

function describeDonutSegment(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number
) {
  const outerStart = polarToCartesian(cx, cy, outerR, endAngle);
  const outerEnd = polarToCartesian(cx, cy, outerR, startAngle);
  const innerStart = polarToCartesian(cx, cy, innerR, endAngle);
  const innerEnd = polarToCartesian(cx, cy, innerR, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArcFlag} 0 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerR} ${innerR} 0 ${largeArcFlag} 1 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
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

  // ── 资产分布数据计算 ─────────────────────────────
  const customTypes = getCustomAccountTypes();

  // 颜色映射（按 label，支持自定义分类）
  const LABEL_COLORS: Record<string, string> = {
    '现金': '#0ea5e9',
    '储蓄卡': '#38bdf8',
    '网络支付': '#10b981',
    '投资账户': '#f59e0b',
    '借出': '#8b5cf6',
  };
  const DEFAULT_COLORS = ['#0ea5e9', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#64748b'];

  const assetDistribution = accountGroups
    .filter(g => {
      // 1. 明确排除负债类内置类型
      if (g.type === 'credit' || g.type === 'debt') return false;

      // 2. 如果是自定义分类，查 behavior
      const customType = customTypes.find(ct => ct.label === g.label);
      if (customType) {
        return customType.behavior !== 'liability';
      }

      // 3. 其余内置资产类保留
      return true;
    })
    .map(g => ({
      type: g.type,
      label: g.label,
      amount: g.totalBalance,
    }))
    .filter(item => item.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const totalAssetAmount = assetDistribution.reduce((sum, item) => sum + item.amount, 0);

  // 智能金额格式化：超过百万显示"万"
  const formatAmountSmart = (amount: number): string => {
    if (hideBalance) return '******';
    if (Math.abs(amount) >= 1000000) {
      return (amount / 10000).toLocaleString('zh-CN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) + '万';
    }
    return formatAmountNoSymbol(amount);
  };
  // ── 资产分布数据计算结束 ─────────────────────────

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
                    {currencySymbol}{formatHiddenAmount(netWorth, hideBalance)}
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
                <button
                  className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full border border-white/40 bg-white/15 backdrop-blur-sm active:bg-white/25 transition-all hover:bg-white/20"
                  onClick={() => onPageChange('balance-sankey')}
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
        </div>

        {/* 年度目标 & 健康度分析卡片 - 独立区域，借贷统计下方、账户列表上方 */}
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

        {healthScore && (
          <HealthScoreCard
            healthScore={healthScore}
            primaryColor={themeConfig.primary}
            onClick={() => setShowHealthDetail(true)}
          />
        )}

        {/* 资产分布卡片 */}
        <div className="space-y-2">
          <Card className="bg-white overflow-hidden">
            {/* 标题栏 */}
            <div className="flex justify-between items-center px-5 pt-4 pb-2">
              <h3 className="font-bold text-gray-800 text-base">资产分布</h3>
              <button
                onClick={() => onPageChange('accounts')}
                className="px-3 py-1.5 rounded-full text-xs font-medium text-white flex items-center gap-1 active:scale-95 transition-transform"
                style={{
                  background: `linear-gradient(135deg, ${themeConfig.primary} 0%, ${themeConfig.gradientTo} 100%)`,
                  boxShadow: `0 2px 8px ${themeConfig.primary}55`
                }}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                管理
              </button>
            </div>

            {assetDistribution.length === 0 ? (
              /* 无账户：空状态 */
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                  <Wallet size={28} className="text-gray-400" />
                </div>
                <p className="text-gray-500 mb-4">还没有账户，添加一个吧</p>
                <Button
                  className="text-white"
                  style={{ backgroundColor: themeConfig.primary }}
                  onClick={() => onPageChange('accounts')}
                >
                  <Icon name="plus" size={18} className="mr-1" />
                  添加账户
                </Button>
              </CardContent>
            ) : (
              /* 有账户：大环形图 + 带进度条的表格 */
              <CardContent className="p-5 pt-1 pb-4">
                {/* 环形图 */}
                <div className="flex justify-center mb-5">
                  <div className="relative">
                    <svg width="200" height="200" viewBox="0 0 200 200">
                      {assetDistribution.map((item, index) => {
                        const percentage = totalAssetAmount > 0 ? item.amount / totalAssetAmount : 0;
                        const angle = percentage * 360;
                        const startAngle = assetDistribution
                          .slice(0, index)
                          .reduce((sum, prev) => sum + (totalAssetAmount > 0 ? (prev.amount / totalAssetAmount) * 360 : 0), 0);
                        const endAngle = startAngle + angle;
                        const color = LABEL_COLORS[item.label] || DEFAULT_COLORS[index % DEFAULT_COLORS.length];

                        if (angle < 0.5) return null;

                        return (
                          <path
                            key={String(item.type)}
                            d={describeDonutSegment(100, 100, 84, 56, startAngle, endAngle)}
                            fill={color}
                            stroke="white"
                            strokeWidth="3"
                          />
                        );
                      })}
                      <text x="100" y="88" textAnchor="middle" className="text-xs fill-gray-400">
                        总资产
                      </text>
                      <text x="100" y="114" textAnchor="middle" className="text-lg font-bold fill-gray-800">
                        {formatAmountSmart(totalAssetAmount)}
                      </text>
                    </svg>
                  </div>
                </div>

                {/* 表头 */}
                <div className="flex items-center px-1 pb-2 border-b border-gray-100 mb-1">
                  <span className="text-xs text-gray-400 font-medium" style={{ width: '96px' }}>分类</span>
                  <span className="text-xs text-gray-400 font-medium flex-1 text-center">趋势</span>
                  <span className="text-xs text-gray-400 font-medium text-right" style={{ width: '90px' }}>金额</span>
                  <span className="text-xs text-gray-400 font-medium text-right" style={{ width: '48px' }}>占比</span>
                </div>

                {/* 表格行 */}
                <div className="space-y-0">
                  {assetDistribution.map((item, index) => {
                    const percentage = totalAssetAmount > 0 ? (item.amount / totalAssetAmount) * 100 : 0;
                    const color = LABEL_COLORS[item.label] || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
                    return (
                      <div
                        key={String(item.type)}
                        className="flex items-center gap-2 py-2 border-b border-gray-50 last:border-b-0"
                      >
                        {/* 分类名：96px 宽，5-6个汉字不截断 */}
                        <div className="flex items-center gap-1.5 flex-shrink-0" style={{ width: '96px' }}>
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: color }}
                          />
                          <span className="text-sm text-gray-700 truncate" title={item.label}>
                            {item.label}
                          </span>
                        </div>

                        {/* 进度条：自适应 */}
                        <div className="flex-1 min-w-0 px-1">
                          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${Math.max(percentage, 0.5)}%`, backgroundColor: color }}
                            />
                          </div>
                        </div>

                        {/* 金额：固定宽，右对齐，智能转"万" */}
                        <span
                          className="text-sm text-gray-600 font-medium tabular-nums text-right flex-shrink-0"
                          style={{ width: '90px' }}
                        >
                          {formatAmountSmart(item.amount)}
                        </span>

                        {/* 占比：固定宽，右对齐，带颜色 */}
                        <span
                          className="text-sm font-bold tabular-nums text-right flex-shrink-0"
                          style={{ width: '48px', color }}
                        >
                          {percentage.toFixed(1)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            )}
          </Card>
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
          onClose={() => setShowHealthDetail(false)}
        />
      )}
    </div>
  );
}


