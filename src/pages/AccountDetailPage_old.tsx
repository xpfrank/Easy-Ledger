import { useState, useEffect, useMemo, useRef } from 'react';
import { ArrowLeft, Edit3, Trash2, TrendingUp, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/Icon';
import type { Account, PageRoute, ThemeType } from '@/types';
import {
  getAccountById,
  getMonthlyRecord,
  formatAmountNoSymbol,
  getSettings,
  deleteAccount,
  loadData,
} from '@/lib/storage';
import { getAccountTypeLabel, getAccountHistory, calculateTotalAssetsForMonth } from '@/lib/calculator';
import { THEMES } from '@/types';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  ReferenceLine,
  Brush,
} from 'recharts';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AccountDetailPageProps {
  onPageChange: (page: PageRoute, params?: any) => void;
  accountId: string;
}

// 隐藏金额显示
function formatHiddenAmount(amount: number, hide: boolean): string {
  if (hide) {
    return '******';
  }
  return formatAmountNoSymbol(amount);
}

// 获取账户当月余额（考虑信用卡和负债账户）
function getAccountMonthBalance(account: Account, year: number, month: number): number {
  const record = getMonthlyRecord(account.id, year, month);
  return record ? record.balance : account.balance;
}

// ========== 获取历史趋势数据（从当前月向前统计）==========
interface TrendRecord {
  year: number;
  month: number;
  balance: number;
}

// 获取账户趋势数据（从当前月向前统计历史数据）
function getAccountTrendHistory(accountId: string, months: number): TrendRecord[] {
  const data = loadData();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // 获取该账户所有记录
  const allRecords = data.records
    .filter(r => r.accountId === accountId)
    .sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });

  if (months === 0) {
    // 全部：返回所有历史记录（从最早到当前月）
    return allRecords;
  }

  // 计算起始月份
  let startYear = currentYear;
  let startMonth = currentMonth - months;
  if (startMonth <= 0) {
    startYear--;
    startMonth += 12;
  }

  // 过滤出符合时间范围的历史记录
  const filteredRecords = allRecords.filter(r => {
    if (r.year < startYear) return false;
    if (r.year === startYear && r.month < startMonth) return false;
    if (r.year > currentYear) return false;
    if (r.year === currentYear && r.month > currentMonth) return false;
    return true;
  });

  // 确保包含当前月（如果存在）
  const hasCurrentMonth = filteredRecords.some(
    r => r.year === currentYear && r.month === currentMonth
  );

  if (!hasCurrentMonth) {
    // 添加当前月（使用账户当前余额）
    const account = data.accounts.find(a => a.id === accountId);
    if (account) {
      filteredRecords.push({
        id: `${accountId}-${currentYear}-${currentMonth}`,
        accountId: accountId,
        year: currentYear,
        month: currentMonth,
        balance: account.balance,
      });
    }
  }

  // 重新排序
  return filteredRecords.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });
}

// 获取储蓄卡趋势数据（带年份信息用于分割线）
function getSavingsTrendData(accountId: string, months: number) {
  const records = getAccountTrendHistory(accountId, months);
  return records.map((r) => ({
    month: `${r.year}-${r.month.toString().padStart(2, '0')}`,
    label: `${r.month}月`,
    fullLabel: `${r.year}年${r.month}月`,
    year: r.year,
    balance: r.balance,
  }));
}

// 获取信用卡趋势数据
function getCreditTrendData(accountId: string, months: number) {
  const records = getAccountTrendHistory(accountId, months);
  return records.map((r) => ({
    month: `${r.year}-${r.month.toString().padStart(2, '0')}`,
    label: `${r.month}月`,
    fullLabel: `${r.year}年${r.month}月`,
    year: r.year,
    debt: r.balance > 0 ? r.balance : 0,
    surplus: r.balance < 0 ? Math.abs(r.balance) : 0,
  }));
}

// 聚合数据按季度（用于超过24个月的数据展示）
function aggregateToQuarter(data: any[], isCredit: boolean): any[] {
  const quarterMap: Record<string, any[]> = {};

  data.forEach((item) => {
    const quarter = Math.ceil(item.month / 3);
    const key = `${item.year}-Q${quarter}`;
    if (!quarterMap[key]) {
      quarterMap[key] = [];
    }
    quarterMap[key].push(item);
  });

  return Object.entries(quarterMap).map(([key, items]) => {
    const [year, quarter] = key.split('-Q');
    // 使用季度末月的数据作为代表
    const quarterEndMonth = parseInt(quarter) * 3;
    const representativeItem = items.find(i => i.month === quarterEndMonth) || items[items.length - 1];

    return {
      month: `${year}-${quarterEndMonth.toString().padStart(2, '0')}`,
      label: `${year.slice(2)}Q${quarter}`,
      fullLabel: `${year}年第${quarter}季度`,
      year: parseInt(year),
      balance: isCredit ? representativeItem.debt || 0 : representativeItem.balance,
      debt: isCredit ? representativeItem.debt || 0 : 0,
      surplus: isCredit ? representativeItem.surplus || 0 : 0,
      // 保存原始数据用于tooltip
      _originalItems: items,
    };
  });
}

// 计算账户资产贡献度数据
interface ContributionData {
  currentMonthBalance: number;
  totalAssets: number;
  percentage: number;
  lastMonthPercentage: number;
  changeValue: number;
  hasHistory: boolean;
  isDebtAccount: boolean;
}

function calculateContribution(account: Account): ContributionData {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  // 计算当月账户余额
  const currentBalance = getAccountMonthBalance(account, year, month);

  // 计算当月总资产
  const totalAssets = calculateTotalAssetsForMonth(year, month);

  // 计算上月数据
  let lastYear = year;
  let lastMonth = month - 1;
  if (lastMonth === 0) {
    lastYear--;
    lastMonth = 12;
  }
  const lastMonthBalance = getAccountMonthBalance(account, lastYear, lastMonth);
  const lastTotalAssets = calculateTotalAssetsForMonth(lastYear, lastMonth);

  // 判断是否为负债账户
  const isDebtAccount = account.type === 'credit' || account.type === 'debt';

  // 计算当月占比（针对资产账户用正余额，负债账户用绝对值）
  let accountValue = currentBalance;
  if (isDebtAccount && account.type === 'credit') {
    // 信用卡：溢缴款计入资产，欠款计入负债
    // 这里贡献度按实际账户余额绝对值计算
    accountValue = Math.abs(currentBalance);
  } else if (isDebtAccount && account.type === 'debt') {
    // 借入账户：不计入资产贡献度
    accountValue = 0;
  }

  // 计算占比
  let percentage = 0;
  let lastMonthPercentage = 0;

  if (totalAssets > 0) {
    percentage = (accountValue / totalAssets) * 100;
  }

  if (lastTotalAssets > 0) {
    // 上月该账户余额
    let lastAccountValue = lastMonthBalance;
    if (isDebtAccount && account.type === 'credit') {
      lastAccountValue = Math.abs(lastMonthBalance);
    } else if (isDebtAccount && account.type === 'debt') {
      lastAccountValue = 0;
    }
    lastMonthPercentage = (lastAccountValue / lastTotalAssets) * 100;
  }

  const changeValue = percentage - lastMonthPercentage;

  // 检查是否有历史数据
  const hasHistory = getAccountHistory(account.id, 2).length >= 2;

  return {
    currentMonthBalance: accountValue,
    totalAssets,
    percentage,
    lastMonthPercentage,
    changeValue,
    hasHistory,
    isDebtAccount: account.type === 'debt',
  };
}

// 计算年度分割线位置（返回每年1月的数据索引，用于添加年份分割线）
function getYearBoundaries(data: any[]): { index: number; year: number }[] {
  const boundaries: { index: number; year: number }[] = [];

  data.forEach((item, index) => {
    // 在每年1月的数据点处添加分割线
    if (item.month && item.month.endsWith('-01')) {
      boundaries.push({ index, year: item.year });
    }
  });

  return boundaries;
}

// 自定义进度条组件 - 支持主题色动态切换
interface ThemeProgressProps {
  value: number;
  themeColor: string;
  className?: string;
}

function ThemeProgress({ value, themeColor, className = '' }: ThemeProgressProps) {
  const clampedValue = Math.min(Math.max(value, 0), 100);
  
  return (
    <div className={`w-full bg-gray-200 rounded-full overflow-hidden ${className}`}>
      <div
        className="h-full rounded-full transition-all duration-300 ease-out"
        style={{
          width: `${clampedValue}%`,
          backgroundColor: themeColor,
        }}
      />
    </div>
  );
}

export function AccountDetailPage({ onPageChange, accountId }: AccountDetailPageProps) {
  const [account, setAccount] = useState<Account | null>(null);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [hideBalance, setHideBalance] = useState(false);
  const [theme, setTheme] = useState<ThemeType>('blue');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [trendRange, setTrendRange] = useState<'6' | '12' | 'all'>('6');
  const [brushRange, setBrushRange] = useState<{ startIndex: number; endIndex: number } | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const themeConfig = THEMES[theme];

  useEffect(() => {
    const settings = getSettings();
    setHideBalance(settings.hideBalance || false);
    setTheme(settings.theme || 'blue');
    loadAccountData();
  }, [accountId]);

  // 监听主题变化
  useEffect(() => {
    const handleStorageChange = () => {
      const settings = getSettings();
      setTheme(settings.theme || 'blue');
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const loadAccountData = () => {
    const acc = getAccountById(accountId);
    if (acc) {
      setAccount(acc);
      // 获取当前月份余额
      const now = new Date();
      const record = getMonthlyRecord(accountId, now.getFullYear(), now.getMonth() + 1);
      setCurrentBalance(record ? record.balance : acc.balance);
    }
  };

  const handleDelete = () => {
    if (account) {
      deleteAccount(account.id);
      onPageChange('accounts');
    }
  };

  // 计算趋势图数据（带智能聚合）
  const trendData = useMemo(() => {
    if (!account) return [];
    const months = trendRange === 'all' ? 0 : parseInt(trendRange);
    const rawData = account.type === 'credit'
      ? getCreditTrendData(account.id, months)
      : getSavingsTrendData(account.id, months);

    // 超过24个月时自动按季度聚合
    if (rawData.length > 24) {
      return aggregateToQuarter(rawData, account.type === 'credit');
    }
    return rawData;
  }, [account, trendRange]);

  // 计算年度分割线位置
  const yearBoundaries = useMemo(() => {
    return getYearBoundaries(trendData);
  }, [trendData]);

  // 计算统计数据
  const stats = useMemo(() => {
    if (!account || trendData.length === 0) return null;

    if (account.type === 'credit') {
      const debts = trendData.map((d: any) => d.debt).filter((d: number) => d > 0);
      const maxDebt = debts.length > 0 ? Math.max(...debts) : 0;
      const avgDebt = debts.length > 0 ? debts.reduce((a: number, b: number) => a + b, 0) / debts.length : 0;
      return { maxDebt, avgDebt };
    } else {
      const balances = trendData.map((d: any) => d.balance);
      const maxBalance = Math.max(...balances);
      const minBalance = Math.min(...balances);
      const avgBalance = balances.reduce((a: number, b: number) => a + b, 0) / balances.length;
      return { maxBalance, minBalance, avgBalance };
    }
  }, [account, trendData]);

  // 计算贡献度数据
  const contribution = useMemo(() => {
    if (!account) return null;
    return calculateContribution(account);
  }, [account, currentBalance]);

  // 处理图表缩放
  const handleBrushChange = (range: any) => {
    if (range && typeof range.startIndex === 'number' && typeof range.endIndex === 'number') {
      setBrushRange({ startIndex: range.startIndex, endIndex: range.endIndex });
    }
  };

  // 重置缩放
  const resetZoom = () => {
    setBrushRange(null);
  };

  if (!account) {
    return (
      <div className="pb-24 bg-gray-50 min-h-screen">
        <header className="bg-white px-4 py-3 flex items-center fixed top-0 left-0 right-0 z-50 max-w-md mx-auto shadow-sm">
          <Button variant="ghost" size="icon" onClick={() => onPageChange('accounts')}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-lg font-semibold ml-2">账户详情</h1>
        </header>
        <div className="h-14"></div>
        <div className="p-4 text-center text-gray-500">账户不存在</div>
      </div>
    );
  }

  const isCredit = account.type === 'credit';
  const isDebt = account.type === 'debt';

  return (
    <div className="pb-4 bg-gray-50 min-h-screen overflow-x-hidden">
      {/* 顶部栏 - 压缩高度 */}
      <header
        className="px-4 py-2.5 flex justify-between items-center fixed top-0 left-0 right-0 z-50 max-w-md mx-auto shadow-sm"
        style={{ backgroundColor: themeConfig.primary }}
      >
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 h-8 w-8" onClick={() => onPageChange('accounts')}>
            <ArrowLeft size={18} />
          </Button>
          <h1 className="text-base font-semibold text-white">{account.name}</h1>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20 h-8 w-8"
            onClick={() => onPageChange('account-edit', { accountId: account.id })}
          >
            <Edit3 size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20 h-8 w-8"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 size={16} />
          </Button>
        </div>
      </header>

      {/* 占位元素 - 压缩高度 */}
      <div className="h-12"></div>

      <div className="px-3 py-2 space-y-2.5">
        {/* 核心信息卡片 - 压缩内边距 */}
        <Card
          className="text-white border-0 shadow-md overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${themeConfig.gradientFrom} 0%, ${themeConfig.gradientTo} 100%)`,
          }}
        >
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                  <Icon name={account.icon} size={20} className="text-white" />
                </div>
                <div>
                  <div className="text-white/80 text-xs">{getAccountTypeLabel(account.type)}</div>
                  <div className="text-base font-semibold">{account.name}</div>
                </div>
              </div>
              {/* 资产变化入口 */}
              <button
                className="flex items-center gap-0.5 text-white/90 text-xs hover:text-white transition-colors"
                onClick={() => onPageChange('account-flow', { accountId: account.id })}
              >
                <span className="font-medium">资产变化</span>
                <ChevronRight size={14} />
              </button>
            </div>

            {/* 余额显示 - 压缩间距 */}
            <div className="mb-2">
              <div className="text-white/70 text-xs mb-0.5">
                {isCredit ? '剩余欠款' : isDebt ? '借入金额' : '当前余额'}
              </div>
              <div className="text-2xl font-bold">
                ¥{formatHiddenAmount(isDebt || isCredit ? Math.abs(currentBalance) : currentBalance, hideBalance)}
              </div>
              {isCredit && currentBalance < 0 && (
                <div className="text-xs text-green-200 mt-0.5">溢缴款 ¥{formatHiddenAmount(Math.abs(currentBalance), hideBalance)}</div>
              )}
            </div>

            {/* 信用卡专属信息 - 压缩布局 */}
            {isCredit && (
              <div className="pt-2 border-t border-white/20">
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div className="text-center">
                    <div className="text-white/60 text-xs">账单日</div>
                    <div className="font-medium text-white text-sm">{account.billDay || 1}日</div>
                  </div>
                  <div className="text-center">
                    <div className="text-white/60 text-xs">还款日</div>
                    <div className="font-medium text-white text-sm">{account.repaymentDay || 10}日</div>
                  </div>
                  <div className="text-center">
                    <div className="text-white/60 text-xs">顺延天数</div>
                    <div className="font-medium text-white text-sm">{account.graceDays || 0}天</div>
                  </div>
                </div>
                {/* 总额度与剩余额度 */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white/10 rounded-lg p-2 text-center">
                    <div className="text-white/60 text-xs mb-0.5">总额度</div>
                    <div className="text-base font-bold text-white">
                      {account.creditLimit && account.creditLimit > 0
                        ? `¥${hideBalance ? '******' : formatAmountNoSymbol(account.creditLimit)}`
                        : <span className="text-white/50 text-sm">未设置</span>
                      }
                    </div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-2 text-center">
                    <div className="text-white/60 text-xs mb-0.5">剩余额度</div>
                    <div className={`text-base font-bold ${currentBalance >= 0 ? 'text-green-200' : 'text-white'}`}>
                      {account.creditLimit && account.creditLimit > 0
                        ? (() => {
                            // 计算剩余额度：欠款为正时减少，溢缴款为负时增加
                            const remainingLimit = currentBalance >= 0
                              ? account.creditLimit - currentBalance
                              : account.creditLimit + Math.abs(currentBalance);
                            return `¥${hideBalance ? '******' : formatAmountNoSymbol(Math.max(0, remainingLimit))}`;
                          })()
                        : <span className="text-white/50 text-sm">未设置</span>
                      }
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 备注 */}
            {account.note && (
              <div className="mt-2 pt-2 border-t border-white/20">
                <div className="text-white/60 text-xs mb-0.5">备注</div>
                <div className="text-xs">{account.note}</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 账户资产贡献度模块 - 压缩间距，进度条使用主题色 */}
        <Card className="bg-white">
          <CardContent className="p-3 space-y-2">
            {/* 模块标题 */}
            <div className="flex items-center gap-1.5">
              <TrendingUp size={16} style={{ color: themeConfig.primary }} />
              <span className="font-semibold text-sm">
                {contribution?.isDebtAccount ? '该账户负债贡献度' : '该账户资产贡献度'}
              </span>
            </div>

            {/* 本月资产数据 + 占比（单行显示） */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 text-xs">
                本月：<span className="font-medium text-gray-900">¥{formatHiddenAmount(contribution?.currentMonthBalance || 0, hideBalance)}</span>
                <span className="text-gray-400 ml-1">/ 总资产¥{formatHiddenAmount(contribution?.totalAssets || 0, hideBalance)}</span>
              </span>
              <span className="font-semibold text-sm" style={{ color: themeConfig.primary }}>
                {hideBalance ? '******' : `${(contribution?.percentage || 0).toFixed(1)}%`}
              </span>
            </div>

            {/* 进度条 - 使用自定义组件，100%跟随主题色 */}
            <ThemeProgress
              value={Math.min(contribution?.percentage || 0, 100)}
              themeColor={themeConfig.primary}
              className="h-2"
            />

            {/* 环比变化 */}
            {contribution?.hasHistory ? (
              <div className={`flex items-center gap-1.5 text-xs ${
                (contribution.changeValue || 0) > 0 ? 'text-green-500' :
                (contribution.changeValue || 0) < 0 ? 'text-red-500' : 'text-gray-400'
              }`}>
                <span className="text-gray-500">较上月：</span>
                <span className="font-medium">
                  {hideBalance ? '**' : `${(contribution.changeValue || 0) > 0 ? '+' : ''}${(contribution.changeValue || 0).toFixed(1)}`}%
                </span>
                <span className="text-xs">
                  ({hideBalance ? '占比变化' : ((contribution.changeValue || 0) > 0 ? '占比上升' :
                    (contribution.changeValue || 0) < 0 ? '占比下降' : '占比不变')})
                </span>
              </div>
            ) : (
              <div className="text-xs text-gray-400">
                较上月：暂无历史数据
              </div>
            )}
          </CardContent>
        </Card>

        {/* 余额趋势图 - 压缩高度，添加手势缩放和滑动 */}
        <Card className="bg-white">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <TrendingUp size={16} style={{ color: themeConfig.primary }} />
                <span className="font-medium text-sm">余额趋势</span>
              </div>
              <div className="flex items-center gap-2">
                {brushRange && (
                  <button
                    onClick={resetZoom}
                    className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 transition-colors"
                    style={{ color: themeConfig.primary }}
                  >
                    重置缩放
                  </button>
                )}
                <Select value={trendRange} onValueChange={(v: '6' | '12' | 'all') => {
                  setTrendRange(v);
                  setBrushRange(null);
                }}>
                  <SelectTrigger className="w-24 h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6">近6个月</SelectItem>
                    <SelectItem value="12">近1年</SelectItem>
                    <SelectItem value="all">全部</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {trendData.length > 0 ? (
              <>
                <div ref={chartContainerRef} className="h-36 mb-2 touch-pan-x">
                  <ResponsiveContainer width="100%" height="100%">
                    {isCredit ? (
                      <AreaChart data={trendData}>
                        <defs>
                          <linearGradient id="debtGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 9 }}
                          axisLine={false}
                          tickLine={false}
                          interval="preserveStartEnd"
                          minTickGap={15}
                          tickFormatter={(value, index) => {
                            const item = trendData[index];
                            // 在每年1月显示年份标签
                            if (item && item.month && item.month.endsWith('-01')) {
                              return `${item.year}年`;
                            }
                            return value;
                          }}
                        />
                        <YAxis
                          tick={{ fontSize: 9 }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`}
                          width={35}
                        />
                        <Tooltip
                          formatter={(v: number) => [`¥${formatHiddenAmount(v, hideBalance)}`, '欠款']}
                          labelFormatter={(l, payload) => {
                            if (payload && payload[0] && payload[0].payload) {
                              return payload[0].payload.fullLabel || l;
                            }
                            return l;
                          }}
                          contentStyle={{ fontSize: 12, borderRadius: 8 }}
                        />
                        {/* 年度分割线 - 在每年1月位置 */}
                        {yearBoundaries.map((boundary) => {
                          const dataPoint = trendData[boundary.index];
                          if (dataPoint) {
                            return (
                              <ReferenceLine
                                key={`boundary-${boundary.index}`}
                                x={dataPoint.label}
                                stroke="#9ca3af"
                                strokeWidth={1}
                                ifOverflow="extendDomain"
                              />
                            );
                          }
                          return null;
                        })}
                        <Area
                          type="monotone"
                          dataKey="debt"
                          stroke="#ef4444"
                          fill="url(#debtGradient)"
                          strokeWidth={2}
                        />
                        {/* 底部滑块用于缩放和滑动 */}
                        <Brush
                          dataKey="label"
                          height={20}
                          stroke={themeConfig.primary}
                          fill={`${themeConfig.primary}20`}
                          onChange={handleBrushChange}
                          startIndex={brushRange?.startIndex}
                          endIndex={brushRange?.endIndex}
                          travellerWidth={8}
                        />
                      </AreaChart>
                    ) : (
                      <AreaChart data={trendData}>
                        <defs>
                          <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={themeConfig.primary} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={themeConfig.primary} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 9 }}
                          axisLine={false}
                          tickLine={false}
                          interval="preserveStartEnd"
                          minTickGap={15}
                          tickFormatter={(value, index) => {
                            const item = trendData[index];
                            // 在每年1月显示年份标签
                            if (item && item.month && item.month.endsWith('-01')) {
                              return `${item.year}年`;
                            }
                            return value;
                          }}
                        />
                        <YAxis
                          tick={{ fontSize: 9 }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`}
                          width={35}
                        />
                        <Tooltip
                          formatter={(v: number) => [`¥${formatHiddenAmount(v, hideBalance)}`, '余额']}
                          labelFormatter={(l, payload) => {
                            if (payload && payload[0] && payload[0].payload) {
                              return payload[0].payload.fullLabel || l;
                            }
                            return l;
                          }}
                          contentStyle={{ fontSize: 12, borderRadius: 8 }}
                        />
                        {/* 年度分割线 - 在每年1月位置 */}
                        {yearBoundaries.map((boundary) => {
                          const dataPoint = trendData[boundary.index];
                          if (dataPoint) {
                            return (
                              <ReferenceLine
                                key={`boundary-${boundary.index}`}
                                x={dataPoint.label}
                                stroke="#9ca3af"
                                strokeWidth={1}
                                ifOverflow="extendDomain"
                              />
                            );
                          }
                          return null;
                        })}
                        <Area
                          type="monotone"
                          dataKey="balance"
                          stroke={themeConfig.primary}
                          fill="url(#balanceGradient)"
                          strokeWidth={2}
                        />
                        {/* 底部滑块用于缩放和滑动 */}
                        <Brush
                          dataKey="label"
                          height={20}
                          stroke={themeConfig.primary}
                          fill={`${themeConfig.primary}20`}
                          onChange={handleBrushChange}
                          startIndex={brushRange?.startIndex}
                          endIndex={brushRange?.endIndex}
                          travellerWidth={8}
                        />
                      </AreaChart>
                    )}
                  </ResponsiveContainer>
                </div>

                {/* 统计数据 - 压缩间距 */}
                {stats && (
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100">
                    {isCredit ? (
                      <>
                        <div className="text-center">
                          <div className="text-xs text-gray-400">最高欠款</div>
                          <div className="text-sm font-medium text-red-500">
                            ¥{formatHiddenAmount((stats as any).maxDebt, hideBalance)}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-400">平均欠款</div>
                          <div className="text-sm font-medium">
                            ¥{formatHiddenAmount((stats as any).avgDebt, hideBalance)}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-400">当前欠款</div>
                          <div className="text-sm font-medium">
                            ¥{formatHiddenAmount(Math.abs(currentBalance), hideBalance)}
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-center">
                          <div className="text-xs text-gray-400">最高余额</div>
                          <div className="text-sm font-medium text-green-600">
                            ¥{formatHiddenAmount((stats as any).maxBalance, hideBalance)}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-400">最低余额</div>
                          <div className="text-sm font-medium">
                            ¥{formatHiddenAmount((stats as any).minBalance, hideBalance)}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-400">平均余额</div>
                          <div className="text-sm font-medium">
                            ¥{formatHiddenAmount((stats as any).avgBalance, hideBalance)}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="h-24 flex items-center justify-center text-gray-400 text-sm">
                暂无历史数据
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 删除确认对话框 */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除账户 "{account.name}" 吗？此操作将同时删除该账户的所有历史记录，且无法恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
