import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Filter, ChevronDown, ChevronUp, TrendingUp, TrendingDown, BarChart3, Calendar, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/Icon';
import type { PageRoute, RecordLog, RecordMode, MonthlyAttribution, YearlyAttribution, AccountSnapshot } from '@/types';
import {
  getRecordLogs,
  formatAmountNoSymbol,
  formatDate,
  getAllAccounts,
  getSettings,
  getRecordLogsExpandedGroups,
  saveRecordLogsExpandedGroups,
  getAllAttributions,
  getAllYearlyAttributions,
  getYearlyAttribution,
  getMonthlyAttribution,
  getAccountSnapshotsByMonth,
  calculateNetWorth,
  getMonthlyAttributionsByYear,
} from '@/lib/storage';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { calculateTotalAssets, calculateTotalLiabilities } from '@/lib/calculator';
import { getAttributionTagLabel, getAttributionTagEmoji, getYearlyAttributionTagLabel, getYearlyAttributionTagEmoji } from '@/types';

interface RecordLogsPageProps {
  onPageChange: (page: PageRoute, params?: any) => void;
  year: number;
  month?: number;
  mode: RecordMode;
}

interface GroupedLogs {
  key: string;
  label: string;
  logs: RecordLog[];
  totalNetWorth?: number;
  lastOperationDate?: number;
  year?: number;
  month?: number;
}

// 隐藏金额显示
function formatHiddenAmount(amount: number, hide: boolean): string {
  if (hide) {
    return '******';
  }
  return formatAmountNoSymbol(amount);
}

// 视图模式
type ViewMode = 'monthly' | 'yearly';
// 月度子视图
type MonthlySubView = 'all' | 'attribution';
// 年度子视图
type YearlySubView = 'all' | 'yearly_attribution' | 'monthly_aggregation';

export function RecordLogsPage({ onPageChange, year, month, mode }: RecordLogsPageProps) {
  const [groupedLogs, setGroupedLogs] = useState<GroupedLogs[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [hideBalance, setHideBalance] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [expandedAttributionCards, setExpandedAttributionCards] = useState<Set<string>>(new Set());
  const accounts = getAllAccounts();

  // 新增：视图模式状态
  const [viewMode, setViewMode] = useState<ViewMode>(mode === 'yearly' ? 'yearly' : 'monthly');
  const [monthlySubView, setMonthlySubView] = useState<MonthlySubView>('all');
  const [yearlySubView, setYearlySubView] = useState<YearlySubView>('all');
  const [selectedYear, setSelectedYear] = useState(year);

  // 加载数据
  const [monthlyAttributions, setMonthlyAttributions] = useState<MonthlyAttribution[]>([]);
  const [yearlyAttributions, setYearlyAttributions] = useState<YearlyAttribution[]>([]);

  // 初始化时加载保存的折叠状态
  useEffect(() => {
    const settings = getSettings();
    setHideBalance(settings.hideBalance || false);

    // 加载保存的折叠状态
    const savedExpanded = getRecordLogsExpandedGroups(year, month, mode);
    if (savedExpanded) {
      setExpandedGroups(new Set(savedExpanded));
    }

    // 加载归因数据
    setMonthlyAttributions(getAllAttributions());
    setYearlyAttributions(getAllYearlyAttributions());

    setIsInitialized(true);
  }, []);

  // 切换展开归因卡片
  const toggleAttributionCard = (key: string) => {
    setExpandedAttributionCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  useEffect(() => {
    if (isInitialized) {
      loadLogs();
    }
  }, [year, month, selectedAccount, mode, isInitialized]);

  const loadLogs = () => {
    let allLogs: RecordLog[] = [];

    if (mode === 'monthly' && month !== undefined) {
      allLogs = getRecordLogs(year, month);
    } else {
      allLogs = getRecordLogs(year);
    }

    if (selectedAccount !== 'all') {
      allLogs = allLogs.filter(l => l.accountId === selectedAccount);
    }

    if (mode === 'yearly') {
      // 年度模式：按月份分组，显示净资产和最后操作日期
      const monthMap = new Map<string, { logs: RecordLog[]; lastDate: number }>();

      // 收集所有有记录的月份
      for (let m = 1; m <= 12; m++) {
        const monthLogs = allLogs.filter(l => l.month === m);
        if (monthLogs.length > 0) {
          const key = `${year}-${m.toString().padStart(2, '0')}`;
          const sortedLogs = monthLogs.sort((a, b) => b.timestamp - a.timestamp);
          monthMap.set(key, {
            logs: sortedLogs,
            lastDate: sortedLogs[0]?.timestamp || Date.now(),
          });
        }
      }

      const grouped: GroupedLogs[] = Array.from(monthMap.entries()).map(([key, data]) => {
        const [, m] = key.split('-').map(Number);
        const netWorth = calculateNetWorth(year, m);

        return {
          key,
          label: `${year}年${m.toString().padStart(2, '0')}月`,
          logs: data.logs,
          totalNetWorth: netWorth,
          lastOperationDate: data.lastDate,
          year: year,
          month: m,
        };
      }).sort((a, b) => b.key.localeCompare(a.key));

      setGroupedLogs(grouped);
      // 只有在没有保存的折叠状态时才设置默认值
      const savedExpanded = getRecordLogsExpandedGroups(year, month, mode);
      if (!savedExpanded && grouped.length > 0) {
        setExpandedGroups(new Set([grouped[0].key]));
      }
    } else {
      // 月度模式：按日期分组
      const dateMap = new Map<string, RecordLog[]>();

      allLogs.forEach(log => {
        const date = new Date(log.timestamp);
        const dateKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
        if (!dateMap.has(dateKey)) {
          dateMap.set(dateKey, []);
        }
        dateMap.get(dateKey)!.push(log);
      });

      const grouped: GroupedLogs[] = Array.from(dateMap.entries()).map(([key, logItems]) => {
        const [, m, d] = key.split('-').map(Number);
        return {
          key,
          label: `${m}月${d}日`,
          logs: logItems.sort((a, b) => b.timestamp - a.timestamp),
        };
      }).sort((a, b) => b.key.localeCompare(a.key));

      setGroupedLogs(grouped);
      // 只有在没有保存的折叠状态时才默认展开所有
      const savedExpanded = getRecordLogsExpandedGroups(year, month, mode);
      if (!savedExpanded) {
        setExpandedGroups(new Set(grouped.map(g => g.key)));
      }
    }
  };

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      // 保存折叠状态到本地存储
      saveRecordLogsExpandedGroups(year, month, mode, Array.from(newSet));
      return newSet;
    });
  };

  // 获取操作类型标签
  const getOperationTypeLabel = (type?: string) => {
    switch (type) {
      case 'account_create': return '新增账户';
      case 'account_edit': return '编辑账户';
      case 'balance_change':
      default: return '余额修改';
    }
  };

  // 跳转到记账页面补充记录
  const goToRecordForAttribution = (targetYear: number, targetMonth?: number) => {
    if (targetMonth !== undefined) {
      onPageChange('record', { year: targetYear, month: targetMonth, mode: 'monthly' });
    } else {
      onPageChange('record', { year: targetYear, mode: 'yearly' });
    }
  };

  // 获取所有有记录的年份
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    monthlyAttributions.forEach(attr => years.add(attr.year));
    yearlyAttributions.forEach(attr => years.add(attr.year));
    const now = new Date();
    years.add(now.getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [monthlyAttributions, yearlyAttributions]);

  // 获取指定年份的月度归因（按月倒序）
  const getMonthlyAttributionsForYear = (y: number) => {
    return monthlyAttributions
      .filter(attr => attr.year === y)
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      });
  };

  // 计算月度聚合统计数据
  const getMonthlyAggregationStats = (y: number) => {
    const attrs = getMonthlyAttributionsForYear(y);
    const tagStats: Record<string, { count: number; totalChange: number }> = {};

    attrs.forEach(attr => {
      attr.tags.forEach(tag => {
        if (!tagStats[tag]) {
          tagStats[tag] = { count: 0, totalChange: 0 };
        }
        tagStats[tag].count++;
        tagStats[tag].totalChange += attr.change;
      });
    });

    return { attrs, tagStats };
  };

  // 渲染月度归因卡片
  const renderMonthlyAttributionCard = (attr: MonthlyAttribution) => {
    const key = `${attr.year}-${attr.month}`;
    const isExpanded = expandedAttributionCards.has(key);
    const snapshots = getAccountSnapshotsByMonth(attr.year, attr.month);
    const netWorth = calculateNetWorth(attr.year, attr.month);

    return (
      <Card key={key} className="bg-white overflow-hidden">
        <div
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
          onClick={() => toggleAttributionCard(key)}
        >
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium">{attr.year}年{attr.month}月</span>
              <span className="text-lg font-bold">¥{formatHiddenAmount(netWorth, hideBalance)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              {attr.tags.map(tag => (
                <span key={tag} className="text-gray-600">
                  {getAttributionTagEmoji(tag)} {getAttributionTagLabel(tag)}
                </span>
              ))}
              {attr.change >= 0 ? (
                <TrendingUp size={14} className="text-green-500" />
              ) : (
                <TrendingDown size={14} className="text-red-500" />
              )}
              <span className={attr.change >= 0 ? 'text-green-600' : 'text-red-500'}>
                {attr.change >= 0 ? '+' : ''}{formatHiddenAmount(attr.change, hideBalance)}
              </span>
            </div>
            {attr.note && (
              <p className="text-xs text-gray-400 mt-1 truncate">{attr.note}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        </div>

        {isExpanded && (
          <div className="border-t border-gray-100 p-4 space-y-4">
            {/* 账户快照 */}
            <div>
              <div className="text-sm font-medium text-gray-600 mb-2">账户余额快照</div>
              <div className="space-y-2">
                {snapshots.map(snapshot => (
                  <div key={snapshot.accountId} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Icon name={snapshot.accountIcon} size={16} />
                      <span>{snapshot.accountName}</span>
                    </div>
                    <div className="text-right">
                      <span className={snapshot.accountType === 'credit' || snapshot.accountType === 'debt' ? 'text-red-500' : ''}>
                        ¥{formatHiddenAmount(snapshot.balance, hideBalance)}
                      </span>
                      {snapshot.change !== undefined && snapshot.change !== 0 && (
                        <span className={`ml-2 text-xs ${snapshot.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {snapshot.change >= 0 ? '+' : ''}{formatHiddenAmount(snapshot.change, hideBalance)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 环比变化 */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">变化率</span>
              <span className={attr.changePercent >= 0 ? 'text-green-600' : 'text-red-500'}>
                {attr.changePercent >= 0 ? '+' : ''}{attr.changePercent.toFixed(1)}%
              </span>
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => goToRecordForAttribution(attr.year, attr.month)}
              >
                编辑归因
              </Button>
            </div>
          </div>
        )}
      </Card>
    );
  };

  // 渲染年度归因卡片
  const renderYearlyAttributionCard = (attr: YearlyAttribution) => {
    const key = `yearly-${attr.year}`;
    const isExpanded = expandedAttributionCards.has(key);

    return (
      <Card key={key} className="bg-white overflow-hidden">
        <div
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
          onClick={() => toggleAttributionCard(key)}
        >
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-lg">{attr.year}年</span>
              <span className="text-lg font-bold">¥{formatHiddenAmount(attr.netWorth, hideBalance)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm flex-wrap">
              {attr.tags.map(tag => (
                <span key={tag} className="text-gray-600">
                  {getYearlyAttributionTagEmoji(tag)} {getYearlyAttributionTagLabel(tag)}
                </span>
              ))}
              <span className={attr.change >= 0 ? 'text-green-600' : 'text-red-500'}>
                {attr.change >= 0 ? '+' : ''}{formatHiddenAmount(attr.change, hideBalance)} ({attr.changePercent >= 0 ? '+' : ''}{attr.changePercent.toFixed(1)}%)
              </span>
            </div>
            {attr.note && (
              <p className="text-xs text-gray-400 mt-1 truncate">{attr.note}</p>
            )}
            {attr.keyMonths.length > 0 && (
              <div className="flex items-center gap-1 mt-1">
                <span className="text-xs text-gray-400">关键月份：</span>
                {attr.keyMonths.map(m => (
                  <span key={m} className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{m}月</span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        </div>

        {isExpanded && (
          <div className="border-t border-gray-100 p-4 space-y-4">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => goToRecordForAttribution(attr.year)}
              >
                编辑年度归因
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => {
                  setViewMode('yearly');
                  setYearlySubView('monthly_aggregation');
                  setSelectedYear(attr.year);
                }}
              >
                查看月度聚合
              </Button>
            </div>
          </div>
        )}
      </Card>
    );
  };

  // 渲染月度聚合
  const renderMonthlyAggregation = () => {
    const { attrs, tagStats } = getMonthlyAggregationStats(selectedYear);

    return (
      <div className="space-y-4">
        <Card className="bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">{selectedYear}年 月度归因一览</h3>
            </div>

            {attrs.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">暂无月度归因记录</p>
              </div>
            ) : (
              <div className="space-y-3">
                {Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
                  const attr = attrs.find(a => a.month === month);
                  return (
                    <div key={month} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium w-12">{month}月</span>
                        {attr ? (
                          <>
                            <div className="flex items-center gap-1">
                              {attr.tags.slice(0, 2).map(tag => (
                                <span key={tag} className="text-xs">
                                  {getAttributionTagEmoji(tag)}
                                </span>
                              ))}
                            </div>
                            <span className={`text-sm ${attr.change >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {attr.change >= 0 ? '+' : ''}{formatHiddenAmount(attr.change, hideBalance)}
                            </span>
                            {attr.fluctuationLevel === 'abnormal' && (
                              <AlertTriangle size={14} className="text-orange-500" />
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => goToRecordForAttribution(selectedYear, month)}
                      >
                        {attr ? '查看' : '补充'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 标签统计 */}
        {Object.keys(tagStats).length > 0 && (
          <Card className="bg-white">
            <CardContent className="p-4">
              <h3 className="font-medium mb-4">年度标签统计</h3>
              <div className="space-y-2">
                {Object.entries(tagStats)
                  .sort((a, b) => b[1].count - a[1].count)
                  .map(([tag, stats]) => (
                    <div key={tag} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>{getYearlyAttributionTagEmoji(tag as any)}</span>
                        <span className="text-sm">{getYearlyAttributionTagLabel(tag as any)}</span>
                        <span className="text-xs text-gray-400">{stats.count}个月</span>
                      </div>
                      <span className={`text-sm ${stats.totalChange >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {stats.totalChange >= 0 ? '+' : ''}{formatHiddenAmount(stats.totalChange, hideBalance)}
                      </span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  return (
    <div className="pb-6 bg-gray-50 min-h-screen overflow-x-hidden">
      {/* 标题栏 */}
      <header className="bg-white px-4 py-3 flex justify-between items-center fixed top-0 left-0 right-0 z-50 max-w-md mx-auto shadow-sm">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => onPageChange('record')}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-lg font-semibold">记账记录</h1>
        </div>
      </header>

      {/* 占位元素 */}
      <div className="h-14"></div>

      <div className="p-4 space-y-4">
        {/* 视图模式切换 */}
        <div className="flex gap-2">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)} className="flex-1">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="monthly">月度视图</TabsTrigger>
              <TabsTrigger value="yearly">年度视图</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* 月度视图筛选 */}
        {viewMode === 'monthly' && (
          <div className="flex gap-2">
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              <button
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  monthlySubView === 'all' ? 'bg-white shadow text-gray-800' : 'text-gray-600'
                }`}
                onClick={() => setMonthlySubView('all')}
              >
                全部账户
              </button>
              <button
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  monthlySubView === 'attribution' ? 'bg-white shadow text-gray-800' : 'text-gray-600'
                }`}
                onClick={() => setMonthlySubView('attribution')}
              >
                月度归因
              </button>
            </div>
          </div>
        )}

        {/* 年度视图筛选 */}
        {viewMode === 'yearly' && (
          <>
            {/* 年份选择 */}
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <select
                  value={selectedYear}
                  onChange={(e) => {
                    setSelectedYear(parseInt(e.target.value));
                    setYearlySubView('all');
                  }}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm appearance-none"
                >
                  {availableYears.map(y => (
                    <option key={y} value={y}>{y}年</option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                <button
                  className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                    yearlySubView === 'all' ? 'bg-white shadow text-gray-800' : 'text-gray-600'
                  }`}
                  onClick={() => setYearlySubView('all')}
                >
                  全部记录
                </button>
                <button
                  className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                    yearlySubView === 'yearly_attribution' ? 'bg-white shadow text-gray-800' : 'text-gray-600'
                  }`}
                  onClick={() => setYearlySubView('yearly_attribution')}
                >
                  <BarChart3 size={14} className="inline mr-1" />
                  年度归因
                </button>
                <button
                  className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                    yearlySubView === 'monthly_aggregation' ? 'bg-white shadow text-gray-800' : 'text-gray-600'
                  }`}
                  onClick={() => setYearlySubView('monthly_aggregation')}
                >
                  <Calendar size={14} className="inline mr-1" />
                  月度聚合
                </button>
              </div>
            </div>
          </>
        )}

        {/* 月度视图 - 全部账户 */}
        {viewMode === 'monthly' && monthlySubView === 'all' && (
          <>
            {/* 账户筛选 */}
            <Card className="bg-white">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <Filter size={16} className="text-gray-400" />
                  <select
                    value={selectedAccount}
                    onChange={(e) => setSelectedAccount(e.target.value)}
                    className="flex-1 bg-transparent text-sm outline-none"
                  >
                    <option value="all">全部账户</option>
                    {accounts.map(account => (
                      <option key={account.id} value={account.id}>{account.name}</option>
                    ))}
                  </select>
                </div>
              </CardContent>
            </Card>

            {groupedLogs.length === 0 ? (
              <Card className="bg-white">
                <CardContent className="p-8 text-center">
                  <p className="text-gray-500">暂无记账记录</p>
                  <p className="text-sm text-gray-400 mt-1">修改账户余额后会自动生成记录</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {groupedLogs.map((group) => (
                  <Card key={group.key} className="bg-white overflow-hidden">
                    <div
                      className="flex items-center justify-between p-3 bg-gray-50 cursor-pointer"
                      onClick={() => toggleGroup(group.key)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{group.label}</span>
                        </div>
                        {mode === 'monthly' && (
                          <span className="text-xs text-gray-400">({group.logs.length}条记录)</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {expandedGroups.has(group.key) ? (
                          <ChevronUp size={20} className="text-gray-400" />
                        ) : (
                          <ChevronDown size={20} className="text-gray-400" />
                        )}
                      </div>
                    </div>

                    {expandedGroups.has(group.key) && (
                      <div className="divide-y divide-gray-100">
                        {group.logs.map((log) => {
                          const change = log.newBalance - log.oldBalance;
                          const isIncrease = change > 0;
                          const changeDisplay = hideBalance
                            ? '****** → ******'
                            : `¥${formatAmountNoSymbol(log.oldBalance)} → ¥${formatAmountNoSymbol(log.newBalance)}`;

                          return (
                            <div key={log.id} className="p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                    isIncrease ? 'bg-green-50' : 'bg-red-50'
                                  }`}>
                                    <Icon
                                      name={isIncrease ? 'trending-up' : 'trending-down'}
                                      size={16}
                                      className={isIncrease ? 'text-green-500' : 'text-red-500'}
                                    />
                                  </div>
                                  <div>
                                    <div className="font-medium text-sm">{log.accountName}</div>
                                    <div className="text-xs text-gray-400">
                                      {getOperationTypeLabel(log.operationType)}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className={`text-sm font-medium ${isIncrease ? 'text-green-600' : 'text-red-500'}`}>
                                    {changeDisplay}
                                  </div>
                                  <div className="text-xs text-gray-400">
                                    {formatDate(log.timestamp)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {/* 月度视图 - 月度归因 */}
        {viewMode === 'monthly' && monthlySubView === 'attribution' && (
          <>
            {monthlyAttributions.length === 0 ? (
              <Card className="bg-white">
                <CardContent className="p-8 text-center">
                  <BarChart3 size={32} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500">暂无月度归因记录</p>
                  <p className="text-sm text-gray-400 mt-1">在记账页面完成记账后可添加归因</p>
                  <Button
                    className="mt-4"
                    onClick={() => goToRecordForAttribution(year, month)}
                  >
                    前往记账
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {monthlyAttributions
                  .filter(attr => viewMode === 'monthly' ? attr.year === year : true)
                  .map(attr => renderMonthlyAttributionCard(attr))}
              </div>
            )}
          </>
        )}

        {/* 年度视图 - 全部记录 */}
        {viewMode === 'yearly' && yearlySubView === 'all' && (
          <>
            <Card className="bg-white">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <Filter size={16} className="text-gray-400" />
                  <select
                    value={selectedAccount}
                    onChange={(e) => setSelectedAccount(e.target.value)}
                    className="flex-1 bg-transparent text-sm outline-none"
                  >
                    <option value="all">全部账户</option>
                    {accounts.map(account => (
                      <option key={account.id} value={account.id}>{account.name}</option>
                    ))}
                  </select>
                </div>
              </CardContent>
            </Card>

            {/* 按月分组 */}
            <div className="space-y-3">
              {Array.from({ length: 12 }, (_, i) => 12 - i).map(month => {
                const monthLogs = getRecordLogs(selectedYear, month).filter(
                  log => selectedAccount === 'all' || log.accountId === selectedAccount
                );
                if (monthLogs.length === 0) return null;

                const netWorth = calculateNetWorth(selectedYear, month);
                const key = `${selectedYear}-${month.toString().padStart(2, '0')}`;
                const isExpanded = expandedGroups.has(key);

                return (
                  <Card key={month} className="bg-white overflow-hidden">
                    <div
                      className="flex items-center justify-between p-3 bg-gray-50 cursor-pointer"
                      onClick={() => toggleGroup(key)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{selectedYear}年{month}月</span>
                          <span className="text-sm font-semibold">¥{formatHiddenAmount(netWorth, hideBalance)}</span>
                        </div>
                        <span className="text-xs text-gray-400">({monthLogs.length}条记录)</span>
                      </div>
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>

                    {isExpanded && (
                      <div className="divide-y divide-gray-100">
                        {monthLogs.map((log) => {
                          const change = log.newBalance - log.oldBalance;
                          const isIncrease = change > 0;
                          const changeDisplay = hideBalance
                            ? '****** → ******'
                            : `¥${formatAmountNoSymbol(log.oldBalance)} → ¥${formatAmountNoSymbol(log.newBalance)}`;

                          return (
                            <div key={log.id} className="p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                    isIncrease ? 'bg-green-50' : 'bg-red-50'
                                  }`}>
                                    <Icon
                                      name={isIncrease ? 'trending-up' : 'trending-down'}
                                      size={16}
                                      className={isIncrease ? 'text-green-500' : 'text-red-500'}
                                    />
                                  </div>
                                  <div>
                                    <div className="font-medium text-sm">{log.accountName}</div>
                                    <div className="text-xs text-gray-400">
                                      {getOperationTypeLabel(log.operationType)}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className={`text-sm font-medium ${isIncrease ? 'text-green-600' : 'text-red-500'}`}>
                                    {changeDisplay}
                                  </div>
                                  <div className="text-xs text-gray-400">
                                    {formatDate(log.timestamp)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </>
        )}

        {/* 年度视图 - 年度归因 */}
        {viewMode === 'yearly' && yearlySubView === 'yearly_attribution' && (
          <div className="space-y-3">
            {/* 当前年份空状态 */}
            {yearlyAttributions.filter(a => a.year === selectedYear).length === 0 && (
              <Card className="bg-white">
                <CardContent className="p-6 text-center">
                  <AlertTriangle size={32} className="mx-auto text-orange-400 mb-3" />
                  <p className="text-gray-600 font-medium">{selectedYear}年未记录年度归因</p>
                  <p className="text-sm text-gray-400 mt-1">建议在年末时记录年度总结</p>
                  <Button
                    className="mt-4"
                    onClick={() => goToRecordForAttribution(selectedYear)}
                  >
                    补充记录
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* 年度归因卡片 */}
            {yearlyAttributions.map(attr => renderYearlyAttributionCard(attr))}
          </div>
        )}

        {/* 年度视图 - 月度聚合 */}
        {viewMode === 'yearly' && yearlySubView === 'monthly_aggregation' && (
          renderMonthlyAggregation()
        )}
      </div>
    </div>
  );
}
