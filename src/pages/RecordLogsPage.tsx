import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Filter, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Calendar, AlertTriangle, BarChart3, Plus, Edit3, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/Icon';
import type { PageRoute, RecordLog, RecordMode, MonthlyAttribution, YearlyAttribution } from '@/types';
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
  getAccountSnapshotsByMonth,
  getAttributionTagLabel,
  getAttributionTagEmoji,
} from '@/lib/storage';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { calculateNetWorth } from '@/lib/calculator';
import { getYearlyAttributionTagLabel, getYearlyAttributionTagEmoji } from '@/types';

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

type ViewMode = 'monthly' | 'yearly';
type MonthlySubView = 'all' | 'attribution';
type YearlySubView = 'all' | 'yearly_attribution' | 'monthly_aggregation';

export function RecordLogsPage({ onPageChange, year, month, mode }: RecordLogsPageProps) {
  const [groupedLogs, setGroupedLogs] = useState<GroupedLogs[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [hideBalance, setHideBalance] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [expandedAttributionCards, setExpandedAttributionCards] = useState<Set<string>>(new Set());
  const accounts = getAllAccounts();

  const [viewMode, setViewMode] = useState<ViewMode>(mode === 'yearly' ? 'yearly' : 'monthly');
  const [monthlySubView, setMonthlySubView] = useState<MonthlySubView>('all');
  const [yearlySubView, setYearlySubView] = useState<YearlySubView>('all');
  const [selectedYear, setSelectedYear] = useState(year);

  const [monthlyAttributions, setMonthlyAttributions] = useState<MonthlyAttribution[]>([]);
  const [yearlyAttributions, setYearlyAttributions] = useState<YearlyAttribution[]>([]);

  useEffect(() => {
    const settings = getSettings();
    setHideBalance(settings.hideBalance || false);

    const savedExpanded = getRecordLogsExpandedGroups(year, month, mode);
    if (savedExpanded) {
      setExpandedGroups(new Set(savedExpanded));
    }

    setMonthlyAttributions(getAllAttributions());
    setYearlyAttributions(getAllYearlyAttributions());

    setIsInitialized(true);
  }, []);

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
      const monthMap = new Map<string, { logs: RecordLog[]; lastDate: number }>();

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
      const savedExpanded = getRecordLogsExpandedGroups(year, month, mode);
      if (!savedExpanded && grouped.length > 0) {
        setExpandedGroups(new Set([grouped[0].key]));
      }
    } else {
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
      saveRecordLogsExpandedGroups(year, month, mode, Array.from(newSet));
      return newSet;
    });
  };

  const getOperationTypeLabel = (type?: string) => {
    switch (type) {
      case 'account_create': return '新增账户';
      case 'account_edit': return '编辑账户';
      case 'balance_change':
      default: return '余额修改';
    }
  };

  const goToRecordForAttribution = (targetYear: number, targetMonth?: number) => {
    if (targetMonth !== undefined) {
      onPageChange('record', { year: targetYear, month: targetMonth, mode: 'monthly' });
    } else {
      onPageChange('record', { year: targetYear, mode: 'yearly' });
    }
  };

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    monthlyAttributions.forEach(attr => years.add(attr.year));
    yearlyAttributions.forEach(attr => years.add(attr.year));
    const now = new Date();
    years.add(now.getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [monthlyAttributions, yearlyAttributions]);

  const getMonthlyAttributionsForYear = (y: number) => {
    return monthlyAttributions
      .filter(attr => attr.year === y)
      .sort((a, b) => b.month - a.month);
  };

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

  const formatHiddenAmount = (amount: number): string => {
    if (hideBalance) return '******';
    return formatAmountNoSymbol(amount);
  };

  const renderMonthlyAttributionCard = (attr: MonthlyAttribution) => {
    const key = `${attr.year}-${attr.month}`;
    const isExpanded = expandedAttributionCards.has(key);
    const snapshots = getAccountSnapshotsByMonth(attr.year, attr.month);
    const netWorth = calculateNetWorth(attr.year, attr.month);

    return (
      <Card key={key} className="bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow">
        <div
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => toggleAttributionCard(key)}
        >
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="font-bold text-gray-900">{attr.year}年{attr.month}月</span>
              <span className="text-xl font-bold text-sky-600">¥{formatHiddenAmount(netWorth)}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {attr.tags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 rounded-full text-sm">
                  <span>{getAttributionTagEmoji(tag)}</span>
                  <span className="text-gray-700">{getAttributionTagLabel(tag)}</span>
                </span>
              ))}
              <span className={`flex items-center gap-1 text-sm font-medium ${attr.change >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {attr.change >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {attr.change >= 0 ? '+' : ''}{formatHiddenAmount(attr.change)}
              </span>
            </div>
            {attr.note && (
              <p className="text-xs text-gray-500 mt-2 line-clamp-1">{attr.note}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
              <ChevronDown size={18} className="text-gray-500" />
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className="border-t border-gray-100 p-4 space-y-4 bg-gray-50/50">
            <div>
              <div className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span>账户余额快照</span>
                <span className="text-xs text-gray-400 font-normal">({snapshots.length}个账户)</span>
              </div>
              <div className="space-y-2 bg-white rounded-xl p-3">
                {snapshots.map(snapshot => (
                  <div key={snapshot.accountId} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        snapshot.accountType === 'credit' || snapshot.accountType === 'debt' ? 'bg-red-50' : 'bg-blue-50'
                      }`}>
                        <Icon name={snapshot.accountIcon} size={16} className={
                          snapshot.accountType === 'credit' || snapshot.accountType === 'debt' ? 'text-red-500' : 'text-blue-500'
                        } />
                      </div>
                      <span className="text-sm text-gray-700">{snapshot.accountName}</span>
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-medium ${snapshot.accountType === 'credit' || snapshot.accountType === 'debt' ? 'text-red-500' : 'text-gray-900'}`}>
                        ¥{formatHiddenAmount(snapshot.balance)}
                      </span>
                      {snapshot.change !== undefined && snapshot.change !== 0 && (
                        <span className={`ml-2 text-xs ${snapshot.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {snapshot.change >= 0 ? '+' : ''}{formatHiddenAmount(snapshot.change)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between bg-white rounded-xl p-3">
              <span className="text-sm text-gray-600">变化率</span>
              <span className={`text-sm font-bold ${attr.changePercent >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {attr.changePercent >= 0 ? '+' : ''}{attr.changePercent.toFixed(1)}%
              </span>
            </div>

            <Button
              variant="outline"
              className="w-full h-11"
              onClick={() => goToRecordForAttribution(attr.year, attr.month)}
            >
              <Edit3 size={16} className="mr-2" />
              编辑归因
            </Button>
          </div>
        )}
      </Card>
    );
  };

  const renderYearlyAttributionCard = (attr: YearlyAttribution) => {
    const key = `yearly-${attr.year}`;
    const isExpanded = expandedAttributionCards.has(key);

    return (
      <Card key={key} className="bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow">
        <div
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => toggleAttributionCard(key)}
        >
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="font-bold text-xl text-gray-900">{attr.year}年</span>
              <span className="text-xl font-bold text-sky-600">¥{formatHiddenAmount(attr.netWorth)}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {attr.tags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 rounded-full text-sm">
                  <span>{getYearlyAttributionTagEmoji(tag as any)}</span>
                  <span className="text-gray-700">{getYearlyAttributionTagLabel(tag as any)}</span>
                </span>
              ))}
              <span className={`text-sm font-medium ${attr.change >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {attr.change >= 0 ? '+' : ''}{formatHiddenAmount(attr.change)} ({attr.changePercent >= 0 ? '+' : ''}{attr.changePercent.toFixed(1)}%)
              </span>
            </div>
            {attr.note && (
              <p className="text-xs text-gray-500 mt-2 line-clamp-1">{attr.note}</p>
            )}
            {attr.keyMonths.length > 0 && (
              <div className="flex items-center gap-1 mt-2">
                <span className="text-xs text-gray-400">关键月份：</span>
                {attr.keyMonths.map(m => (
                  <span key={m} className="text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full font-medium">{m}月</span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
              <ChevronDown size={18} className="text-gray-500" />
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className="border-t border-gray-100 p-4 space-y-3 bg-gray-50/50">
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-11"
                onClick={() => goToRecordForAttribution(attr.year)}
              >
                编辑年度归因
              </Button>
              <Button
                variant="outline"
                className="flex-1 h-11"
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

  const renderMonthlyAggregation = () => {
    const { attrs, tagStats } = getMonthlyAggregationStats(selectedYear);

    return (
      <div className="space-y-4">
        <Card className="bg-white shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-lg text-gray-900">{selectedYear}年 月度归因一览</h3>
            </div>

            {attrs.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <Calendar size={28} className="text-gray-400" />
                </div>
                <p className="text-gray-500 font-medium">暂无月度归因记录</p>
                <p className="text-sm text-gray-400 mt-1">请先记录各月的资产变化</p>
              </div>
            ) : (
              <div className="space-y-2">
                {Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
                  const attr = attrs.find(a => a.month === month);
                  return (
                    <div key={month} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 rounded-lg px-2 transition-colors">
                      <div className="flex items-center gap-3 flex-1">
                        <span className="text-sm font-bold text-gray-700 w-10">{month}月</span>
                        {attr ? (
                          <>
                            <div className="flex items-center gap-1">
                              {attr.tags.slice(0, 2).map(tag => (
                                <span key={tag} className="text-lg">{getAttributionTagEmoji(tag)}</span>
                              ))}
                            </div>
                            <span className={`text-sm font-bold ${attr.change >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {attr.change >= 0 ? '+' : ''}{formatHiddenAmount(attr.change)}
                            </span>
                            {attr.fluctuationLevel === 'abnormal' && (
                              <AlertTriangle size={16} className="text-orange-500" />
                            )}
                          </>
                        ) : (
                          <span className="text-sm text-gray-400">未记录</span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-sm"
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

        {Object.keys(tagStats).length > 0 && (
          <Card className="bg-white shadow-sm">
            <CardContent className="p-4">
              <h3 className="font-bold text-lg text-gray-900 mb-4">年度标签统计</h3>
              <div className="space-y-3">
                {Object.entries(tagStats)
                  .sort((a, b) => b[1].count - a[1].count)
                  .map(([tag, stats]) => (
                    <div key={tag} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{getYearlyAttributionTagEmoji(tag as any)}</span>
                        <div>
                          <span className="text-sm font-medium text-gray-700">{getYearlyAttributionTagLabel(tag as any)}</span>
                          <span className="text-xs text-gray-400 ml-2">{stats.count}个月</span>
                        </div>
                      </div>
                      <span className={`text-sm font-bold ${stats.totalChange >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {stats.totalChange >= 0 ? '+' : ''}{formatHiddenAmount(stats.totalChange)}
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
      <header className="bg-white px-4 py-3 flex justify-between items-center fixed top-0 left-0 right-0 z-50 max-w-md mx-auto shadow-sm">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => onPageChange('record')}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-lg font-semibold">记账记录</h1>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setHideBalance(!hideBalance)}
          className="text-gray-500"
        >
          {hideBalance ? <EyeOff size={18} /> : <Eye size={18} />}
        </Button>
      </header>

      <div className="h-14"></div>

      <div className="p-4 space-y-4">
        <div className="flex gap-2">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)} className="flex-1">
            <TabsList className="grid w-full grid-cols-2 h-12">
              <TabsTrigger value="monthly" className="text-sm font-medium">月度视图</TabsTrigger>
              <TabsTrigger value="yearly" className="text-sm font-medium">年度视图</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {viewMode === 'monthly' && (
          <div className="flex gap-2">
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1 flex-1">
              <button
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  monthlySubView === 'all' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => setMonthlySubView('all')}
              >
                全部账户
              </button>
              <button
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  monthlySubView === 'attribution' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => setMonthlySubView('attribution')}
              >
                <BarChart3 size={14} className="inline mr-1" />
                月度归因
              </button>
            </div>
          </div>
        )}

        {viewMode === 'yearly' && (
          <>
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <select
                  value={selectedYear}
                  onChange={(e) => {
                    setSelectedYear(parseInt(e.target.value));
                    setYearlySubView('all');
                  }}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium appearance-none shadow-sm"
                >
                  {availableYears.map(y => (
                    <option key={y} value={y}>{y}年</option>
                  ))}
                </select>
                <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              <button
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  yearlySubView === 'all' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => setYearlySubView('all')}
              >
                全部记录
              </button>
              <button
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  yearlySubView === 'yearly_attribution' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => setYearlySubView('yearly_attribution')}
              >
                <BarChart3 size={14} className="inline mr-1" />
                年度归因
              </button>
              <button
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  yearlySubView === 'monthly_aggregation' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => setYearlySubView('monthly_aggregation')}
              >
                <Calendar size={14} className="inline mr-1" />
                月度聚合
              </button>
            </div>
          </>
        )}

        {viewMode === 'monthly' && monthlySubView === 'all' && (
          <>
            <Card className="bg-white shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <Filter size={16} className="text-gray-400" />
                  <select
                    value={selectedAccount}
                    onChange={(e) => setSelectedAccount(e.target.value)}
                    className="flex-1 bg-transparent text-sm font-medium outline-none"
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
              <Card className="bg-white shadow-sm">
                <CardContent className="p-10 text-center">
                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                    <Calendar size={28} className="text-gray-400" />
                  </div>
                  <p className="text-gray-500 font-medium">暂无记账记录</p>
                  <p className="text-sm text-gray-400 mt-1">修改账户余额后会自动生成记录</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {groupedLogs.map((group) => (
                  <Card key={group.key} className="bg-white overflow-hidden shadow-sm">
                    <div
                      className="flex items-center justify-between p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => toggleGroup(group.key)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-gray-900">{group.label}</span>
                          {mode === 'yearly' && group.totalNetWorth !== undefined && (
                            <span className="text-sm font-semibold text-sky-600">
                              ¥{formatHiddenAmount(group.totalNetWorth)}
                            </span>
                          )}
                        </div>
                        {mode === 'monthly' && (
                          <span className="text-xs text-gray-400 mt-1">{group.logs.length}条记录</span>
                        )}
                      </div>
                      <div className={`w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm transition-transform duration-200 ${expandedGroups.has(group.key) ? 'rotate-180' : ''}`}>
                        <ChevronDown size={18} className="text-gray-500" />
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
                            <div key={log.id} className="p-4 hover:bg-gray-50 transition-colors">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                    isIncrease ? 'bg-green-50' : 'bg-red-50'
                                  }`}>
                                    <Icon
                                      name={isIncrease ? 'trending-up' : 'trending-down'}
                                      size={18}
                                      className={isIncrease ? 'text-green-500' : 'text-red-500'}
                                    />
                                  </div>
                                  <div>
                                    <div className="font-semibold text-gray-900">{log.accountName}</div>
                                    <div className="text-xs text-gray-400">
                                      {getOperationTypeLabel(log.operationType)}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className={`text-sm font-bold ${isIncrease ? 'text-green-600' : 'text-red-500'}`}>
                                    {changeDisplay}
                                  </div>
                                  <div className="text-xs text-gray-400 mt-1">
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

        {viewMode === 'monthly' && monthlySubView === 'attribution' && (
          <>
            {monthlyAttributions.filter(attr => attr.year === year).length === 0 ? (
              <Card className="bg-white shadow-sm">
                <CardContent className="p-10 text-center">
                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                    <BarChart3 size={28} className="text-gray-400" />
                  </div>
                  <p className="text-gray-500 font-medium">暂无月度归因记录</p>
                  <p className="text-sm text-gray-400 mt-1 mb-5">在记账页面完成记账后可添加归因</p>
                  <Button
                    className="px-6"
                    onClick={() => goToRecordForAttribution(year, month)}
                  >
                    <Plus size={18} className="mr-2" />
                    前往记账
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {monthlyAttributions
                  .filter(attr => attr.year === year)
                  .map(attr => renderMonthlyAttributionCard(attr))}
              </div>
            )}
          </>
        )}

        {viewMode === 'yearly' && yearlySubView === 'all' && (
          <>
            <Card className="bg-white shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <Filter size={16} className="text-gray-400" />
                  <select
                    value={selectedAccount}
                    onChange={(e) => setSelectedAccount(e.target.value)}
                    className="flex-1 bg-transparent text-sm font-medium outline-none"
                  >
                    <option value="all">全部账户</option>
                    {accounts.map(account => (
                      <option key={account.id} value={account.id}>{account.name}</option>
                    ))}
                  </select>
                </div>
              </CardContent>
            </Card>

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
                  <Card key={month} className="bg-white overflow-hidden shadow-sm">
                    <div
                      className="flex items-center justify-between p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => toggleGroup(key)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-gray-900">{selectedYear}年{month}月</span>
                          <span className="text-sm font-semibold text-sky-600">¥{formatHiddenAmount(netWorth)}</span>
                        </div>
                        <span className="text-xs text-gray-400">{monthLogs.length}条记录</span>
                      </div>
                      <div className={`w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                        <ChevronDown size={18} className="text-gray-500" />
                      </div>
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
                            <div key={log.id} className="p-4 hover:bg-gray-50 transition-colors">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                    isIncrease ? 'bg-green-50' : 'bg-red-50'
                                  }`}>
                                    <Icon
                                      name={isIncrease ? 'trending-up' : 'trending-down'}
                                      size={18}
                                      className={isIncrease ? 'text-green-500' : 'text-red-500'}
                                    />
                                  </div>
                                  <div>
                                    <div className="font-semibold text-gray-900">{log.accountName}</div>
                                    <div className="text-xs text-gray-400">
                                      {getOperationTypeLabel(log.operationType)}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className={`text-sm font-bold ${isIncrease ? 'text-green-600' : 'text-red-500'}`}>
                                    {changeDisplay}
                                  </div>
                                  <div className="text-xs text-gray-400 mt-1">
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

        {viewMode === 'yearly' && yearlySubView === 'yearly_attribution' && (
          <div className="space-y-3">
            {yearlyAttributions.filter(a => a.year === selectedYear).length === 0 && (
              <Card className="bg-white shadow-sm">
                <CardContent className="p-8 text-center">
                  <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle size={28} className="text-orange-500" />
                  </div>
                  <p className="text-gray-700 font-bold mb-1">{selectedYear}年未记录年度归因</p>
                  <p className="text-sm text-gray-400 mb-5">建议在年末时记录年度总结</p>
                  <Button
                    className="px-6"
                    onClick={() => goToRecordForAttribution(selectedYear)}
                  >
                    <Plus size={18} className="mr-2" />
                    补充记录
                  </Button>
                </CardContent>
              </Card>
            )}

            {yearlyAttributions.map(attr => renderYearlyAttributionCard(attr))}
          </div>
        )}

        {viewMode === 'yearly' && yearlySubView === 'monthly_aggregation' && (
          renderMonthlyAggregation()
        )}
      </div>
    </div>
  );
}