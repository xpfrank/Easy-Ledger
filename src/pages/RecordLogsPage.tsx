import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Filter, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Calendar, AlertTriangle, BarChart3, Eye, EyeOff, ChevronLeft, ChevronRight } from 'lucide-react';
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
  updateSettings,
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// 新增：归因详情弹窗组件（实际使用时需替换为真正的组件）
import MonthlyAttributionDetail from '@/components/attribution/MonthlyAttributionDetail';
import YearlyAttributionDetail from '@/components/attribution/YearlyAttributionDetail';

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
// 月度子视图（符合需求：余额记录 / 月度归因）
type MonthlySubView = 'balance' | 'attribution';
// 年度子视图（符合需求：余额记录 / 月度聚合 / 年度归因）
type YearlySubView = 'balance' | 'monthly_aggregation' | 'yearly_attribution';

export function RecordLogsPage({ onPageChange, year: initialYear, month: initialMonth, mode: initialMode }: RecordLogsPageProps) {
  const [groupedLogs, setGroupedLogs] = useState<GroupedLogs[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [hideBalance, setHideBalance] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [expandedAttributionCards, setExpandedAttributionCards] = useState<Set<string>>(new Set());
  const accounts = getAllAccounts();

  // 视图模式状态
  const [viewMode, setViewMode] = useState<ViewMode>(initialMode === 'yearly' ? 'yearly' : 'monthly');
  const [monthlySubView, setMonthlySubView] = useState<MonthlySubView>('balance');
  const [yearlySubView, setYearlySubView] = useState<YearlySubView>('balance');
  
  // 独立的时间选择状态（不依赖路由）
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [selectedMonth, setSelectedMonth] = useState(initialMonth || new Date().getMonth() + 1);
  
  // 年份选择下拉
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  // 数据
  const [monthlyAttributions, setMonthlyAttributions] = useState<MonthlyAttribution[]>([]);
  const [yearlyAttributions, setYearlyAttributions] = useState<YearlyAttribution[]>([]);

  // 归因详情弹窗状态
  const [selectedAttributionMonth, setSelectedAttributionMonth] = useState<{ year: number; month: number } | null>(null);
  const [selectedAttributionYear, setSelectedAttributionYear] = useState<number | null>(null);

  // 初始化加载
  useEffect(() => {
    const settings = getSettings();
    setHideBalance(settings.hideBalance || false);
    const savedExpanded = getRecordLogsExpandedGroups(selectedYear, viewMode === 'monthly' ? selectedMonth : undefined, viewMode);
    if (savedExpanded) {
      setExpandedGroups(new Set(savedExpanded));
    }
    setMonthlyAttributions(getAllAttributions());
    setYearlyAttributions(getAllYearlyAttributions());
    setIsInitialized(true);
  }, []);

  // 当时间或账户筛选变化时重新加载数据
  useEffect(() => {
    if (isInitialized) {
      loadLogs();
    }
  }, [selectedYear, selectedMonth, selectedAccount, viewMode, isInitialized]);

  const loadLogs = () => {
    let allLogs: RecordLog[] = [];
    if (viewMode === 'monthly') {
      allLogs = getRecordLogs(selectedYear, selectedMonth);
    } else {
      allLogs = getRecordLogs(selectedYear);
    }
    if (selectedAccount !== 'all') {
      allLogs = allLogs.filter(l => l.accountId === selectedAccount);
    }

    if (viewMode === 'yearly') {
      // 年度模式：按月份分组
      const monthMap = new Map<string, { logs: RecordLog[]; lastDate: number }>();
      for (let m = 1; m <= 12; m++) {
        const monthLogs = allLogs.filter(l => l.month === m);
        if (monthLogs.length > 0) {
          const key = `${selectedYear}-${m.toString().padStart(2, '0')}`;
          const sortedLogs = monthLogs.sort((a, b) => b.timestamp - a.timestamp);
          monthMap.set(key, { logs: sortedLogs, lastDate: sortedLogs[0]?.timestamp || Date.now() });
        }
      }
      const grouped: GroupedLogs[] = Array.from(monthMap.entries()).map(([key, data]) => {
        const [, m] = key.split('-').map(Number);
        const netWorth = calculateNetWorth(selectedYear, m);
        return {
          key,
          label: `${selectedYear}年${m.toString().padStart(2, '0')}月`,
          logs: data.logs,
          totalNetWorth: netWorth,
          lastOperationDate: data.lastDate,
          year: selectedYear,
          month: m,
        };
      }).sort((a, b) => b.key.localeCompare(a.key));
      setGroupedLogs(grouped);
      const savedExpanded = getRecordLogsExpandedGroups(selectedYear, undefined, viewMode);
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
      const savedExpanded = getRecordLogsExpandedGroups(selectedYear, selectedMonth, viewMode);
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
      saveRecordLogsExpandedGroups(selectedYear, viewMode === 'monthly' ? selectedMonth : undefined, viewMode, Array.from(newSet));
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

  // 获取所有有记录的年份
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    monthlyAttributions.forEach(attr => years.add(attr.year));
    yearlyAttributions.forEach(attr => years.add(attr.year));
    // 添加当前选中年份
    years.add(selectedYear);
    return Array.from(years).sort((a, b) => b - a);
  }, [monthlyAttributions, yearlyAttributions, selectedYear]);

  // 获取指定年份的月度归因
  const getMonthlyAttributionsForYear = (y: number) => {
    return monthlyAttributions
      .filter(attr => attr.year === y)
      .sort((a, b) => b.month - a.month);
  };

  // 获取指定月份的归因记录
  const getAttributionForMonth = (y: number, m: number) => {
    return monthlyAttributions.find(attr => attr.year === y && attr.month === m);
  };

  // 获取年度归因记录
  const getYearlyAttributionForYear = (y: number) => {
    return yearlyAttributions.find(attr => attr.year === y);
  };

  // 处理查看月度归因详情
  const handleViewMonthlyAttribution = (year: number, month: number) => {
    setSelectedAttributionMonth({ year, month });
  };

  // 处理查看年度归因详情
  const handleViewYearlyAttribution = (year: number) => {
    setSelectedAttributionYear(year);
  };

  // 渲染月度归因卡片（用于月度归因Tab）
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
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleViewMonthlyAttribution(attr.year, attr.month);
              }}
            >
              查看
            </Button>
            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        </div>

        {isExpanded && (
          <div className="border-t border-gray-100 p-4 space-y-4">
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
                    </div>
                  </div>
                ))}
              </div>
            </div>
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

  // 渲染年度归因卡片（用于年度归因Tab）
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
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleViewYearlyAttribution(attr.year);
              }}
            >
              查看
            </Button>
            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        </div>
      </Card>
    );
  };

  // 切换归因卡片展开
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

  // 渲染月度聚合（用于年度视图的月度聚合Tab）
  const renderMonthlyAggregation = () => {
    const attrs = getMonthlyAttributionsForYear(selectedYear);
    return (
      <div className="space-y-3">
        {Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
          const attr = attrs.find(a => a.month === month);
          if (!attr) return null;
          return (
            <Card key={month} className="bg-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{selectedYear}年{month}月</div>
                    <div className="flex items-center gap-2 mt-1">
                      {attr.tags.map(tag => (
                        <span key={tag} className="text-xs text-gray-500">
                          {getAttributionTagEmoji(tag)} {getAttributionTagLabel(tag)}
                        </span>
                      ))}
                      <span className={attr.change >= 0 ? 'text-green-600' : 'text-red-500'}>
                        {attr.change >= 0 ? '+' : ''}{formatHiddenAmount(attr.change, hideBalance)}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewMonthlyAttribution(selectedYear, month)}
                  >
                    查看
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  // 渲染余额记录 Tab 的内容（符合需求：各账户余额修改明细）
  const renderBalanceRecords = () => {
    if (viewMode === 'monthly') {
      // 月度视图：按账户分组展示当月修改明细
      const monthLogs = getRecordLogs(selectedYear, selectedMonth).filter(
        log => selectedAccount === 'all' || log.accountId === selectedAccount
      );
      // 按账户分组
      const accountGroups = new Map<string, RecordLog[]>();
      monthLogs.forEach(log => {
        if (!accountGroups.has(log.accountId)) {
          accountGroups.set(log.accountId, []);
        }
        accountGroups.get(log.accountId)!.push(log);
      });

      if (monthLogs.length === 0) {
        return (
          <Card className="bg-white">
            <CardContent className="p-8 text-center">
              <p className="text-gray-500">暂无记账记录</p>
            </CardContent>
          </Card>
        );
      }

      return (
        <div className="space-y-4">
          {Array.from(accountGroups.entries()).map(([accountId, logs]) => {
            const account = accounts.find(a => a.id === accountId);
            if (!account) return null;
            // 按日期排序
            const sortedLogs = logs.sort((a, b) => b.timestamp - a.timestamp);
            return (
              <Card key={accountId} className="bg-white overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b">
                  <div className="flex items-center gap-2">
                    <Icon name={account.icon} size={18} />
                    <span className="font-medium">{account.name}</span>
                  </div>
                </div>
                <div className="divide-y">
                  {sortedLogs.map(log => {
                    const change = log.newBalance - log.oldBalance;
                    return (
                      <div key={log.id} className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${change >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                              <Icon name={change >= 0 ? 'trending-up' : 'trending-down'} size={16} className={change >= 0 ? 'text-green-500' : 'text-red-500'} />
                            </div>
                            <div>
                              <div className="text-sm">{getOperationTypeLabel(log.operationType)}</div>
                              <div className="text-xs text-gray-400">{formatDate(log.timestamp)}</div>
                            </div>
                          </div>
                          <div className={`text-sm font-medium ${change >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {hideBalance ? '****** → ******' : `¥${formatAmountNoSymbol(log.oldBalance)} → ¥${formatAmountNoSymbol(log.newBalance)}`}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      );
    } else {
      // 年度视图：展示1-12月每月各账户余额（可展开看明细）
      return (
        <div className="space-y-3">
          {Array.from({ length: 12 }, (_, i) => 12 - i).map(month => {
            const monthLogs = getRecordLogs(selectedYear, month).filter(
              log => selectedAccount === 'all' || log.accountId === selectedAccount
            );
            if (monthLogs.length === 0) return null;
            const netWorth = calculateNetWorth(selectedYear, month);
            const key = `${selectedYear}-${month.toString().padStart(2, '0')}`;
            const isExpanded = expandedGroups.has(key);
            // 按账户分组
            const accountGroups = new Map<string, RecordLog[]>();
            monthLogs.forEach(log => {
              if (!accountGroups.has(log.accountId)) {
                accountGroups.set(log.accountId, []);
              }
              accountGroups.get(log.accountId)!.push(log);
            });

            return (
              <Card key={month} className="bg-white overflow-hidden">
                <div
                  className="flex items-center justify-between p-3 bg-gray-50 cursor-pointer"
                  onClick={() => toggleGroup(key)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{selectedYear}年{month}月</span>
                      <span className="text-sm font-semibold">¥{formatHiddenAmount(netWorth, hideBalance)}</span>
                    </div>
                    <span className="text-xs text-gray-400">{monthLogs.length}条记录</span>
                  </div>
                  {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
                {isExpanded && (
                  <div className="divide-y">
                    {Array.from(accountGroups.entries()).map(([accountId, logs]) => {
                      const account = accounts.find(a => a.id === accountId);
                      if (!account) return null;
                      return (
                        <div key={accountId} className="p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Icon name={account.icon} size={16} />
                            <span className="font-medium text-sm">{account.name}</span>
                          </div>
                          <div className="space-y-2 pl-6">
                            {logs.sort((a, b) => b.timestamp - a.timestamp).map(log => {
                              const change = log.newBalance - log.oldBalance;
                              return (
                                <div key={log.id} className="flex items-center justify-between text-sm">
                                  <span className="text-gray-500">{getOperationTypeLabel(log.operationType)}</span>
                                  <span className={change >= 0 ? 'text-green-600' : 'text-red-500'}>
                                    {hideBalance ? '******' : `¥${formatAmountNoSymbol(log.newBalance)}`}
                                  </span>
                                </div>
                              );
                            })}
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
      );
    }
  };

  // 渲染月度归因Tab内容
  const renderMonthlyAttributionTab = () => {
    const attr = getAttributionForMonth(selectedYear, selectedMonth);
    if (!attr) {
      return (
        <Card className="bg-white">
          <CardContent className="p-8 text-center">
            <BarChart3 size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">暂无月度归因记录</p>
            <Button className="mt-4" onClick={() => goToRecordForAttribution(selectedYear, selectedMonth)}>
              前往记账
            </Button>
          </CardContent>
        </Card>
      );
    }
    return renderMonthlyAttributionCard(attr);
  };

  // 渲染年度归因Tab内容
  const renderYearlyAttributionTab = () => {
    const attr = getYearlyAttributionForYear(selectedYear);
    if (!attr) {
      return (
        <Card className="bg-white">
          <CardContent className="p-6 text-center">
            <AlertTriangle size={32} className="mx-auto text-orange-400 mb-3" />
            <p className="text-gray-600 font-medium">{selectedYear}年未记录年度归因</p>
            <Button className="mt-4" onClick={() => goToRecordForAttribution(selectedYear)}>
              补充记录
            </Button>
          </CardContent>
        </Card>
      );
    }
    return renderYearlyAttributionCard(attr);
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
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            const newValue = !hideBalance;
            setHideBalance(newValue);
            updateSettings({ hideBalance: newValue });
          }}
          className="text-gray-500"
        >
          {hideBalance ? <EyeOff size={18} /> : <Eye size={18} />}
        </Button>
      </header>

      <div className="h-14"></div>

      <div className="p-4 space-y-4">
        {/* 视图模式切换 */}
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="monthly">月度视图</TabsTrigger>
            <TabsTrigger value="yearly">年度视图</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* 时间选择器 */}
        <div className="flex items-center gap-2">
          {viewMode === 'monthly' ? (
            <>
              <div className="relative flex-1">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm appearance-none"
                >
                  {availableYears.map(y => (
                    <option key={y} value={y}>{y}年</option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
              <div className="relative flex-1">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm appearance-none"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>{m}月</option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </>
          ) : (
            <div className="relative flex-1">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm appearance-none"
              >
                {availableYears.map(y => (
                  <option key={y} value={y}>{y}年</option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          )}
        </div>

        {/* 二级Tab */}
        {viewMode === 'monthly' ? (
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            <button
              className={`flex-1 px-3 py-1.5 rounded-md text-sm transition-colors ${monthlySubView === 'balance' ? 'bg-white shadow text-gray-800' : 'text-gray-600'}`}
              onClick={() => setMonthlySubView('balance')}
            >
              余额记录
            </button>
            <button
              className={`flex-1 px-3 py-1.5 rounded-md text-sm transition-colors ${monthlySubView === 'attribution' ? 'bg-white shadow text-gray-800' : 'text-gray-600'}`}
              onClick={() => setMonthlySubView('attribution')}
            >
              月度归因
            </button>
          </div>
        ) : (
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            <button
              className={`flex-1 px-3 py-1.5 rounded-md text-sm transition-colors ${yearlySubView === 'balance' ? 'bg-white shadow text-gray-800' : 'text-gray-600'}`}
              onClick={() => setYearlySubView('balance')}
            >
              余额记录
            </button>
            <button
              className={`flex-1 px-3 py-1.5 rounded-md text-sm transition-colors ${yearlySubView === 'monthly_aggregation' ? 'bg-white shadow text-gray-800' : 'text-gray-600'}`}
              onClick={() => setYearlySubView('monthly_aggregation')}
            >
              月度聚合
            </button>
            <button
              className={`flex-1 px-3 py-1.5 rounded-md text-sm transition-colors ${yearlySubView === 'yearly_attribution' ? 'bg-white shadow text-gray-800' : 'text-gray-600'}`}
              onClick={() => setYearlySubView('yearly_attribution')}
            >
              年度归因
            </button>
          </div>
        )}

        {/* 账户筛选（仅在余额记录Tab显示） */}
        {((viewMode === 'monthly' && monthlySubView === 'balance') || (viewMode === 'yearly' && yearlySubView === 'balance')) && (
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
        )}

        {/* 内容区域 */}
        {viewMode === 'monthly' && monthlySubView === 'balance' && renderBalanceRecords()}
        {viewMode === 'monthly' && monthlySubView === 'attribution' && renderMonthlyAttributionTab()}
        {viewMode === 'yearly' && yearlySubView === 'balance' && renderBalanceRecords()}
        {viewMode === 'yearly' && yearlySubView === 'monthly_aggregation' && renderMonthlyAggregation()}
        {viewMode === 'yearly' && yearlySubView === 'yearly_attribution' && renderYearlyAttributionTab()}
      </div>

      {/* 月度归因详情弹窗 */}
      {selectedAttributionMonth && (
        <MonthlyAttributionDetail
          year={selectedAttributionMonth.year}
          month={selectedAttributionMonth.month}
          hideBalance={hideBalance}
          onClose={() => setSelectedAttributionMonth(null)}
          onEdit={() => {
            goToRecordForAttribution(selectedAttributionMonth.year, selectedAttributionMonth.month);
            setSelectedAttributionMonth(null);
          }}
        />
      )}

      {/* 年度归因详情弹窗 */}
      {selectedAttributionYear && (
        <YearlyAttributionDetail
          year={selectedAttributionYear}
          hideBalance={hideBalance}
          onClose={() => setSelectedAttributionYear(null)}
          onEdit={() => {
            goToRecordForAttribution(selectedAttributionYear);
            setSelectedAttributionYear(null);
          }}
        />
      )}
    </div>
  );
}