import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Filter, ChevronDown, ChevronUp, TrendingUp, TrendingDown, AlertTriangle, BarChart3, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/Icon';
import type { PageRoute, RecordLog, RecordMode, MonthlyAttribution, YearlyAttribution, ThemeType } from '@/types';
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
  getMonthlyRecord,
} from '@/lib/storage';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { calculateNetWorth } from '@/lib/calculator';
import { getYearlyAttributionTagLabel, getYearlyAttributionTagEmoji, THEMES } from '@/types';
import MonthlyAttributionDetail from '@/components/attribution/MonthlyAttributionDetail';
import YearlyAttributionDetail from '@/components/attribution/YearlyAttributionDetail';

interface RecordLogsPageProps {
  onPageChange: (page: PageRoute, params?: any) => void;
  year: number;
  month?: number;
  mode: RecordMode;
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
type MonthlySubView = 'balance' | 'attribution';
type YearlySubView = 'balance' | 'monthly_aggregation' | 'yearly_attribution';

export function RecordLogsPage({ onPageChange, year: initialYear, month: initialMonth, mode: initialMode }: RecordLogsPageProps) {
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [hideBalance, setHideBalance] = useState(false);
  const [expandedAttributionCards, setExpandedAttributionCards] = useState<Set<string>>(new Set());
  const accounts = getAllAccounts();

  const [viewMode, setViewMode] = useState<ViewMode>(initialMode === 'yearly' ? 'yearly' : 'monthly');
  const [monthlySubView, setMonthlySubView] = useState<MonthlySubView>('balance');
  const [yearlySubView, setYearlySubView] = useState<YearlySubView>('balance');
  
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [selectedMonth, setSelectedMonth] = useState(initialMonth || new Date().getMonth() + 1);

  const [monthlyAttributions, setMonthlyAttributions] = useState<MonthlyAttribution[]>([]);
  const [yearlyAttributions, setYearlyAttributions] = useState<YearlyAttribution[]>([]);

  // 主题色状态
  const [theme, setTheme] = useState<ThemeType>('blue');

  const [selectedAttributionMonth, setSelectedAttributionMonth] = useState<{ year: number; month: number } | null>(null);
  const [selectedAttributionYear, setSelectedAttributionYear] = useState<number | null>(null);

  useEffect(() => {
    const settings = getSettings();
    setHideBalance(settings.hideBalance || false);
    setTheme(settings.theme || 'blue');
    const savedExpanded = getRecordLogsExpandedGroups(selectedYear, viewMode === 'monthly' ? selectedMonth : undefined, viewMode);
    if (savedExpanded) {
      setExpandedGroups(new Set(savedExpanded));
    }
    setMonthlyAttributions(getAllAttributions());
    setYearlyAttributions(getAllYearlyAttributions());
  }, []);

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

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    monthlyAttributions.forEach(attr => years.add(attr.year));
    yearlyAttributions.forEach(attr => years.add(attr.year));
    years.add(selectedYear);
    return Array.from(years).sort((a, b) => b - a);
  }, [monthlyAttributions, yearlyAttributions, selectedYear]);

  const getMonthlyAttributionsForYear = (y: number) => {
    return monthlyAttributions
      .filter(attr => attr.year === y)
      .sort((a, b) => b.month - a.month);
  };

  const getAttributionForMonth = (y: number, m: number) => {
    return monthlyAttributions.find(attr => attr.year === y && attr.month === m);
  };

  const getYearlyAttributionForYear = (y: number) => {
    return yearlyAttributions.find(attr => attr.year === y);
  };

  const handleViewMonthlyAttribution = (year: number, month: number) => {
    setSelectedAttributionMonth({ year, month });
  };

  const handleViewYearlyAttribution = (year: number) => {
    setSelectedAttributionYear(year);
  };

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

  // ==================== 核心修复：月度视图按日期分组，保留可视化图标 ====================
  const renderBalanceRecords = () => {
    if (viewMode === 'monthly') {
      // 获取所有记录并按日期分组
      const monthLogs = getRecordLogs(selectedYear, selectedMonth).filter(
        log => selectedAccount === 'all' || log.accountId === selectedAccount
      );

      if (monthLogs.length === 0) {
        return (
          <Card className="bg-white">
            <CardContent className="p-8 text-center">
              <p className="text-gray-500">暂无记账记录</p>
            </CardContent>
          </Card>
        );
      }

      // 按日期分组 (格式: "4月8日")
      const dateGroups = new Map<string, RecordLog[]>();
      monthLogs.forEach(log => {
        const date = new Date(log.timestamp);
        const dateStr = `${date.getMonth() + 1}月${date.getDate()}日`;
        if (!dateGroups.has(dateStr)) {
          dateGroups.set(dateStr, []);
        }
        dateGroups.get(dateStr)!.push(log);
      });

      // 按日期排序（最新的在前）
      const sortedDates = Array.from(dateGroups.entries()).sort((a, b) => {
        const timeA = a[1][0]?.timestamp || 0;
        const timeB = b[1][0]?.timestamp || 0;
        return timeB - timeA;
      });

      return (
        <div className="space-y-3">
          {sortedDates.map(([dateStr, logs]) => {
            const key = `${selectedYear}-${selectedMonth}-${dateStr}`;
            const isExpanded = expandedGroups.has(key);
            
            return (
              <Card key={key} className="bg-white overflow-hidden">
                <div
                  className="flex items-center justify-between p-3 bg-gray-50 cursor-pointer"
                  onClick={() => toggleGroup(key)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{dateStr}</span>
                      <span className="text-xs text-gray-400">({logs.length}条记录)</span>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
                
                {isExpanded && (
                  <div className="divide-y">
                    {logs.sort((a, b) => b.timestamp - a.timestamp).map(log => {
                      const account = accounts.find(a => a.id === log.accountId);
                      if (!account) return null;
                      const change = log.newBalance - log.oldBalance;
                      const isIncrease = change >= 0;
                      
                      return (
                        <div key={log.id} className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {/* 可视化图标 - 保留原始风格 */}
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isIncrease ? 'bg-green-50' : 'bg-red-50'}`}>
                                <Icon
                                  name={isIncrease ? 'trending-up' : 'trending-down'}
                                  size={16}
                                  className={isIncrease ? 'text-green-500' : 'text-red-500'}
                                />
                              </div>
                              <div>
                                <div className="text-sm font-medium">{account.name}</div>
                                <div className="text-xs text-gray-400">{getOperationTypeLabel(log.operationType)}</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`text-sm font-medium ${isIncrease ? 'text-green-600' : 'text-red-500'}`}>
                                {hideBalance ? '****** → ******' : `¥${formatAmountNoSymbol(log.oldBalance)} → ¥${formatAmountNoSymbol(log.newBalance)}`}
                              </div>
                              <div className="text-xs text-gray-400">{formatDate(log.timestamp)}</div>
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
      );
    } else {
      // ==================== 年度视图：按月份分组，展示月度最终数据 ====================
      return (
        <div className="space-y-3">
          {Array.from({ length: 12 }, (_, i) => 12 - i).map(month => {
            const monthLogs = getRecordLogs(selectedYear, month).filter(
              log => selectedAccount === 'all' || log.accountId === selectedAccount
            );
            if (monthLogs.length === 0) return null;
            
            // 获取该月最后一条记录的日期
            const lastLog = monthLogs.sort((a, b) => b.timestamp - a.timestamp)[0];
            const lastRecordDate = formatDate(lastLog.timestamp);
            
            // 计算该月净资产
            const monthNetWorth = calculateNetWorth(selectedYear, month);
            
            const key = `${selectedYear}-${month.toString().padStart(2, '0')}`;
            const isExpanded = expandedGroups.has(key);

            return (
              <Card key={month} className="bg-white overflow-hidden">
                <div
                  className="flex items-center justify-between p-3 bg-gray-50 cursor-pointer"
                  onClick={() => toggleGroup(key)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{selectedYear}年{month}月</span>
                      <span className="text-sm font-semibold">¥{formatHiddenAmount(monthNetWorth, hideBalance)}</span>
                    </div>
                    <span className="text-xs text-gray-400">最后记录: {lastRecordDate} · {monthLogs.length}条记录</span>
                  </div>
                  {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
                
                {isExpanded && (
                  <div className="divide-y">
                    {/* 展示该月各账户的最终余额 */}
                    <div className="p-3 bg-gray-50/50">
                      <div className="text-xs text-gray-500 mb-2">月末账户余额</div>
                      {accounts.map(account => {
                        const record = getMonthlyRecord(account.id, selectedYear, month);
                        const balance = record ? record.balance : account.balance;
                        const isCredit = account.type === 'credit';
                        const isDebt = account.type === 'debt';
                        
                        if (selectedAccount !== 'all' && selectedAccount !== account.id) return null;
                        
                        return (
                          <div key={account.id} className="flex items-center justify-between py-1.5">
                            <div className="flex items-center gap-2">
                              <Icon name={account.icon} size={14} />
                              <span className="text-sm">{account.name}</span>
                            </div>
                            <span className={`text-sm ${isCredit || isDebt ? 'text-red-500' : 'text-gray-900'}`}>
                              ¥{formatHiddenAmount(balance, hideBalance)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* 展示该月的所有变动记录（带可视化图标） */}
                    <div className="p-3">
                      <div className="text-xs text-gray-500 mb-2">变动记录</div>
                      {monthLogs.sort((a, b) => b.timestamp - a.timestamp).map(log => {
                        const account = accounts.find(a => a.id === log.accountId);
                        if (!account) return null;
                        const change = log.newBalance - log.oldBalance;
                        const isIncrease = change >= 0;
                        
                        return (
                          <div key={log.id} className="flex items-center justify-between py-2">
                            <div className="flex items-center gap-3">
                              {/* 可视化图标 */}
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isIncrease ? 'bg-green-50' : 'bg-red-50'}`}>
                                <Icon
                                  name={isIncrease ? 'trending-up' : 'trending-down'}
                                  size={14}
                                  className={isIncrease ? 'text-green-500' : 'text-red-500'}
                                />
                              </div>
                              <div>
                                <div className="text-sm">{account.name}</div>
                                <div className="text-xs text-gray-400">{formatDate(log.timestamp)}</div>
                              </div>
                            </div>
                            <div className={`text-sm font-medium ${isIncrease ? 'text-green-600' : 'text-red-500'}`}>
                              {isIncrease ? '+' : ''}¥{formatHiddenAmount(Math.abs(change), hideBalance)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      );
    }
  };

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
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="monthly">月度视图</TabsTrigger>
            <TabsTrigger value="yearly">年度视图</TabsTrigger>
          </TabsList>
        </Tabs>

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

        {viewMode === 'monthly' && monthlySubView === 'balance' && renderBalanceRecords()}
        {viewMode === 'monthly' && monthlySubView === 'attribution' && renderMonthlyAttributionTab()}
        {viewMode === 'yearly' && yearlySubView === 'balance' && renderBalanceRecords()}
        {viewMode === 'yearly' && yearlySubView === 'monthly_aggregation' && renderMonthlyAggregation()}
        {viewMode === 'yearly' && yearlySubView === 'yearly_attribution' && renderYearlyAttributionTab()}
      </div>

      {/* 月度归因详情弹窗 - 传递 theme */}
      {selectedAttributionMonth && (
        <MonthlyAttributionDetail
          year={selectedAttributionMonth.year}
          month={selectedAttributionMonth.month}
          hideBalance={hideBalance}
          theme={theme}
          onClose={() => setSelectedAttributionMonth(null)}
          onEdit={() => {
            goToRecordForAttribution(selectedAttributionMonth.year, selectedAttributionMonth.month);
            setSelectedAttributionMonth(null);
          }}
        />
      )}

      {/* 年度归因详情弹窗 - 传递 theme */}
      {selectedAttributionYear && (
        <YearlyAttributionDetail
          year={selectedAttributionYear}
          hideBalance={hideBalance}
          theme={theme}
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