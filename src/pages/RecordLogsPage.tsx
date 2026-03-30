import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Filter, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Calendar, AlertTriangle, BarChart3 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/Icon';
import type { PageRoute, RecordLog, RecordMode, MonthlyAttribution, YearlyAttribution } from '@/types';
import {
  getRecordLogs, formatAmountNoSymbol, formatDate, getAllAccounts, getSettings,
  getRecordLogsExpandedGroups, saveRecordLogsExpandedGroups, getAllAttributions,
  getAllYearlyAttributions, getAccountSnapshotsByMonth, getAttributionTagLabel, getAttributionTagEmoji
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

function formatHiddenAmount(amount: number, hide: boolean): string {
  if (hide) return '******';
  return formatAmountNoSymbol(amount);
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
    if (savedExpanded) setExpandedGroups(new Set(savedExpanded));
    setMonthlyAttributions(getAllAttributions());
    setYearlyAttributions(getAllYearlyAttributions());
    setIsInitialized(true);
  }, []);

  const toggleAttributionCard = (key: string) => {
    setExpandedAttributionCards(prev => {
      const newSet = new Set(prev);
      newSet.has(key) ? newSet.delete(key) : newSet.add(key);
      return newSet;
    });
  };

  useEffect(() => {
    if (isInitialized) loadLogs();
  }, [year, month, selectedAccount, mode, isInitialized]);

  const loadLogs = () => {
    let allLogs: RecordLog[] = (mode === 'monthly' && month !== undefined) ? getRecordLogs(year, month) : getRecordLogs(year);
    if (selectedAccount !== 'all') allLogs = allLogs.filter(l => l.accountId === selectedAccount);

    if (mode === 'yearly') {
      const monthMap = new Map<string, { logs: RecordLog[]; lastDate: number }>();
      for (let m = 1; m <= 12; m++) {
        const monthLogs = allLogs.filter(l => l.month === m);
        if (monthLogs.length > 0) {
          const sortedLogs = monthLogs.sort((a, b) => b.timestamp - a.timestamp);
          monthMap.set(`${year}-${m.toString().padStart(2, '0')}`, { logs: sortedLogs, lastDate: sortedLogs[0]?.timestamp || Date.now() });
        }
      }
      const grouped: GroupedLogs[] = Array.from(monthMap.entries()).map(([key, data]) => {
        const [, m] = key.split('-').map(Number);
        return {
          key, label: `${year}年${m.toString().padStart(2, '0')}月`,
          logs: data.logs, totalNetWorth: calculateNetWorth(year, m),
          lastOperationDate: data.lastDate, year: year, month: m,
        };
      }).sort((a, b) => b.key.localeCompare(a.key));

      setGroupedLogs(grouped);
      const savedExpanded = getRecordLogsExpandedGroups(year, month, mode);
      if (!savedExpanded && grouped.length > 0) setExpandedGroups(new Set([grouped[0].key]));
    } else {
      const dateMap = new Map<string, RecordLog[]>();
      allLogs.forEach(log => {
        const date = new Date(log.timestamp);
        const dateKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
        if (!dateMap.has(dateKey)) dateMap.set(dateKey, []);
        dateMap.get(dateKey)!.push(log);
      });
      const grouped: GroupedLogs[] = Array.from(dateMap.entries()).map(([key, logItems]) => {
        const [, m, d] = key.split('-').map(Number);
        return { key, label: `${m}月${d}日`, logs: logItems.sort((a, b) => b.timestamp - a.timestamp) };
      }).sort((a, b) => b.key.localeCompare(a.key));

      setGroupedLogs(grouped);
      const savedExpanded = getRecordLogsExpandedGroups(year, month, mode);
      if (!savedExpanded) setExpandedGroups(new Set(grouped.map(g => g.key)));
    }
  };

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      newSet.has(key) ? newSet.delete(key) : newSet.add(key);
      saveRecordLogsExpandedGroups(year, month, mode, Array.from(newSet));
      return newSet;
    });
  };

  const getOperationTypeLabel = (type?: string) => {
    switch (type) {
      case 'account_create': return '新增账户';
      case 'account_edit': return '编辑账户';
      case 'balance_change': default: return '余额修改';
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
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [monthlyAttributions, yearlyAttributions]);

  const getMonthlyAggregationStats = (y: number) => {
    const attrs = monthlyAttributions.filter(attr => attr.year === y).sort((a, b) => a.month - b.month);
    const tagStats: Record<string, { count: number; totalChange: number }> = {};
    attrs.forEach(attr => {
      attr.tags.forEach(tag => {
        if (!tagStats[tag]) tagStats[tag] = { count: 0, totalChange: 0 };
        tagStats[tag].count++;
        tagStats[tag].totalChange += attr.change;
      });
    });
    return { attrs, tagStats };
  };

  const renderMonthlyAttributionCard = (attr: MonthlyAttribution) => {
    const key = `${attr.year}-${attr.month}`;
    const isExpanded = expandedAttributionCards.has(key);
    const snapshots = getAccountSnapshotsByMonth(attr.year, attr.month);
    const netWorth = calculateNetWorth(attr.year, attr.month);

    return (
      <Card key={key} className="bg-white overflow-hidden">
        <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50" onClick={() => toggleAttributionCard(key)}>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium">{attr.year}年{attr.month}月</span>
              <span className="text-lg font-bold">¥{formatHiddenAmount(netWorth, hideBalance)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              {attr.tags.map(tag => (
                <span key={tag} className="text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded text-xs">
                  {getAttributionTagEmoji(tag as any)} {getAttributionTagLabel(tag as any)}
                </span>
              ))}
              <span className={`ml-2 ${attr.change >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {attr.change >= 0 ? '+' : ''}{formatHiddenAmount(attr.change, hideBalance)}
              </span>
            </div>
            {attr.note && <p className="text-xs text-gray-500 mt-2 truncate">{attr.note}</p>}
          </div>
          {isExpanded ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
        </div>

        {isExpanded && (
          <div className="border-t border-gray-100 p-4 space-y-4 bg-gray-50/30">
            <div>
              <div className="text-sm font-medium text-gray-600 mb-2">账户余额快照 (TOP)</div>
              <div className="space-y-2">
                {snapshots.slice(0, 5).map(snapshot => (
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
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 bg-white" onClick={() => goToRecordForAttribution(attr.year, attr.month)}>编辑归因</Button>
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
        <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50" onClick={() => toggleAttributionCard(key)}>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-lg">{attr.year}年</span>
              <span className="text-lg font-bold">¥{formatHiddenAmount(attr.netWorth, hideBalance)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm flex-wrap">
              {attr.tags.map(tag => (
                <span key={tag} className="text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded text-xs">
                  {getYearlyAttributionTagEmoji(tag as any)} {getYearlyAttributionTagLabel(tag as any)}
                </span>
              ))}
              <span className={attr.change >= 0 ? 'text-green-600' : 'text-red-500'}>
                {attr.change >= 0 ? '+' : ''}{formatHiddenAmount(attr.change, hideBalance)} ({attr.changePercent >= 0 ? '+' : ''}{attr.changePercent.toFixed(1)}%)
              </span>
            </div>
            {attr.note && <p className="text-xs text-gray-500 mt-2 truncate">{attr.note}</p>}
          </div>
          {isExpanded ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
        </div>
        {isExpanded && (
          <div className="border-t border-gray-100 p-4 bg-gray-50/30">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 bg-white" onClick={() => goToRecordForAttribution(attr.year)}>编辑年度归因</Button>
              <Button variant="outline" size="sm" className="flex-1 bg-white" onClick={() => { setViewMode('yearly'); setYearlySubView('monthly_aggregation'); setSelectedYear(attr.year); }}>
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
        <Card className="bg-white">
          <CardContent className="p-4">
            <h3 className="font-medium mb-4">{selectedYear}年 月度归因一览</h3>
            {attrs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">暂无月度归因记录</div>
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
                              {attr.tags.slice(0, 2).map(tag => <span key={tag} className="text-xs">{getAttributionTagEmoji(tag as any)}</span>)}
                            </div>
                            <span className={`text-sm ${attr.change >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {attr.change >= 0 ? '+' : ''}{formatHiddenAmount(attr.change, hideBalance)}
                            </span>
                          </>
                        ) : <span className="text-xs text-gray-400">-</span>}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => goToRecordForAttribution(selectedYear, month)}>
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
          <Card className="bg-white">
            <CardContent className="p-4">
              <h3 className="font-medium mb-4">年度标签统计</h3>
              <div className="space-y-2">
                {Object.entries(tagStats).sort((a, b) => b[1].count - a[1].count).map(([tag, stats]) => (
                  <div key={tag} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                      <span>{getAttributionTagEmoji(tag as any)}</span>
                      <span className="text-sm">{getAttributionTagLabel(tag as any)}</span>
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
      <header className="bg-white px-4 py-3 flex justify-between items-center fixed top-0 left-0 right-0 z-50 max-w-md mx-auto shadow-sm">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => onPageChange('record')}><ArrowLeft size={20} /></Button>
          <h1 className="text-lg font-semibold">记账记录</h1>
        </div>
      </header>
      <div className="h-14"></div>

      <div className="p-4 space-y-4">
        <div className="flex gap-2">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)} className="flex-1">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="monthly">月度视图</TabsTrigger>
              <TabsTrigger value="yearly">年度视图</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {viewMode === 'monthly' && (
          <div className="flex gap-2">
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              <button className={`px-3 py-1.5 rounded-md text-sm transition-colors ${monthlySubView === 'all' ? 'bg-white shadow text-gray-800' : 'text-gray-600'}`} onClick={() => setMonthlySubView('all')}>
                全部账户
              </button>
              <button className={`px-3 py-1.5 rounded-md text-sm transition-colors ${monthlySubView === 'attribution' ? 'bg-white shadow text-gray-800' : 'text-gray-600'}`} onClick={() => setMonthlySubView('attribution')}>
                月度归因
              </button>
            </div>
          </div>
        )}

        {viewMode === 'yearly' && (
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <select value={selectedYear} onChange={(e) => { setSelectedYear(parseInt(e.target.value)); setYearlySubView('all'); }} className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm appearance-none">
                {availableYears.map(y => <option key={y} value={y}>{y}年</option>)}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1 overflow-x-auto no-scrollbar">
              <button className={`px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors ${yearlySubView === 'all' ? 'bg-white shadow text-gray-800' : 'text-gray-600'}`} onClick={() => setYearlySubView('all')}>全部记录</button>
              <button className={`px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors ${yearlySubView === 'yearly_attribution' ? 'bg-white shadow text-gray-800' : 'text-gray-600'}`} onClick={() => setYearlySubView('yearly_attribution')}><BarChart3 size={14} className="inline mr-1" />年度归因</button>
              <button className={`px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors ${yearlySubView === 'monthly_aggregation' ? 'bg-white shadow text-gray-800' : 'text-gray-600'}`} onClick={() => setYearlySubView('monthly_aggregation')}><Calendar size={14} className="inline mr-1" />月度聚合</button>
            </div>
          </div>
        )}

        {/* 1. 月度视图 - 全部账户 (原有流水) */}
        {viewMode === 'monthly' && monthlySubView === 'all' && (
          <>
            <Card className="bg-white">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <Filter size={16} className="text-gray-400" />
                  <select value={selectedAccount} onChange={(e) => setSelectedAccount(e.target.value)} className="flex-1 bg-transparent text-sm outline-none">
                    <option value="all">全部账户</option>
                    {accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
                  </select>
                </div>
              </CardContent>
            </Card>

            {groupedLogs.length === 0 ? (
              <Card className="bg-white"><CardContent className="p-8 text-center text-gray-500">暂无记账记录</CardContent></Card>
            ) : (
              <div className="space-y-3">
                {groupedLogs.map((group) => (
                  <Card key={group.key} className="bg-white overflow-hidden">
                    <div className="flex items-center justify-between p-3 bg-gray-50 cursor-pointer" onClick={() => toggleGroup(group.key)}>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1"><span className="font-medium text-sm">{group.label}</span></div>
                        {mode === 'monthly' && <span className="text-xs text-gray-400">({group.logs.length}条记录)</span>}
                      </div>
                      {expandedGroups.has(group.key) ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
                    </div>
                    {expandedGroups.has(group.key) && (
                      <div className="divide-y divide-gray-100">
                        {group.logs.map((log) => {
                          const change = log.newBalance - log.oldBalance;
                          const isIncrease = change > 0;
                          return (
                            <div key={log.id} className="p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isIncrease ? 'bg-green-50' : 'bg-red-50'}`}>
                                    <Icon name={isIncrease ? 'trending-up' : 'trending-down'} size={16} className={isIncrease ? 'text-green-500' : 'text-red-500'} />
                                  </div>
                                  <div>
                                    <div className="font-medium text-sm">{log.accountName}</div>
                                    <div className="text-xs text-gray-400">{getOperationTypeLabel(log.operationType)}</div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className={`text-sm font-medium ${isIncrease ? 'text-green-600' : 'text-red-500'}`}>
                                    {hideBalance ? '******' : `¥${formatAmountNoSymbol(log.oldBalance)} → ¥${formatAmountNoSymbol(log.newBalance)}`}
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
                ))}
              </div>
            )}
          </>
        )}

        {/* 2. 月度视图 - 月度归因 */}
        {viewMode === 'monthly' && monthlySubView === 'attribution' && (
          <>
            {monthlyAttributions.length === 0 ? (
              <Card className="bg-white">
                <CardContent className="p-8 text-center">
                  <BarChart3 size={32} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500">暂无月度归因记录</p>
                  <Button className="mt-4" onClick={() => goToRecordForAttribution(year, month)}>前往记账</Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {monthlyAttributions.filter(attr => viewMode === 'monthly' ? attr.year === year : true).map(attr => renderMonthlyAttributionCard(attr))}
              </div>
            )}
          </>
        )}

        {/* 3. 年度视图 - 全部记录 */}
        {viewMode === 'yearly' && yearlySubView === 'all' && (
          <>
            <div className="space-y-3">
              {Array.from({ length: 12 }, (_, i) => 12 - i).map(month => {
                const monthLogs = getRecordLogs(selectedYear, month).filter(log => selectedAccount === 'all' || log.accountId === selectedAccount);
                if (monthLogs.length === 0) return null;
                const netWorth = calculateNetWorth(selectedYear, month);
                const key = `${selectedYear}-${month.toString().padStart(2, '0')}`;
                return (
                  <Card key={month} className="bg-white overflow-hidden">
                    <div className="flex items-center justify-between p-3 bg-gray-50 cursor-pointer" onClick={() => toggleGroup(key)}>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{selectedYear}年{month}月</span>
                          <span className="text-sm font-semibold">¥{formatHiddenAmount(netWorth, hideBalance)}</span>
                        </div>
                        <span className="text-xs text-gray-400">({monthLogs.length}条记录)</span>
                      </div>
                      {expandedGroups.has(key) ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                  </Card>
                );
              })}
            </div>
          </>
        )}

        {/* 4. 年度视图 - 年度归因 */}
        {viewMode === 'yearly' && yearlySubView === 'yearly_attribution' && (
          <div className="space-y-3">
            {yearlyAttributions.filter(a => a.year === selectedYear).length === 0 && (
              <Card className="bg-white"><CardContent className="p-6 text-center text-gray-500">未记录年度归因</CardContent></Card>
            )}
            {yearlyAttributions.map(attr => renderYearlyAttributionCard(attr))}
          </div>
        )}

        {/* 5. 年度视图 - 月度聚合 */}
        {viewMode === 'yearly' && yearlySubView === 'monthly_aggregation' && renderMonthlyAggregation()}
      </div>
    </div>
  );
}