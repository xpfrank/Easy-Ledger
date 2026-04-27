import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Filter, ChevronDown, ChevronUp, AlertTriangle, BarChart3, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/Icon';
import type { PageRoute, RecordLog, RecordMode, MonthlyAttribution, YearlyAttribution, ThemeType } from '@/types';
import { THEMES as themesConfig } from '@/types';
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
  getAttributionTagLabel,
  getAttributionTagEmoji,
  getYearlyAttributionTagLabel,
  getYearlyAttributionTagEmoji,
  getAccountsForMonth,
  getMonthlyRecord,
} from '@/lib/storage';

import { calculateNetWorth } from '@/lib/calculator';
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
type YearlySubView = 'balance' | 'timeline' | 'yearly_attribution';

export function RecordLogsPage({ onPageChange, year: initialYear, month: initialMonth, mode: initialMode }: RecordLogsPageProps) {
  const accounts = getAllAccounts();
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [hideBalance, setHideBalance] = useState(false);

  const [viewMode, setViewMode] = useState<ViewMode>(initialMode === 'yearly' ? 'yearly' : 'monthly');
  const [monthlySubView, setMonthlySubView] = useState<MonthlySubView>('balance');
  const [yearlySubView, setYearlySubView] = useState<YearlySubView>('timeline');
  
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
  const [selectedMonth, setSelectedMonth] = useState<number>(initialMonth || new Date().getMonth() + 1);

  const [monthlyAttributions, setMonthlyAttributions] = useState<MonthlyAttribution[]>([]);
  const [yearlyAttributions, setYearlyAttributions] = useState<YearlyAttribution[]>([]);

  const [theme, setTheme] = useState<ThemeType>('blue');

  const [selectedAttributionMonth, setSelectedAttributionMonth] = useState<{ year: number; month: number } | null>(null);
  const [selectedAttributionYear, setSelectedAttributionYear] = useState<number | null>(null);

  const themeConfig = themesConfig[theme];

  useEffect(() => {
    const settings = getSettings();
    setHideBalance(settings.hideBalance || false);
    setTheme(settings.theme || 'blue');
    const year = typeof selectedYear === 'number' ? selectedYear : initialYear;
    const savedExpanded = getRecordLogsExpandedGroups(year, viewMode === 'monthly' ? selectedMonth : undefined, viewMode);
    if (savedExpanded) {
      setExpandedGroups(new Set(savedExpanded));
    }
    setMonthlyAttributions(getAllAttributions());
    setYearlyAttributions(getAllYearlyAttributions());
  }, []);

  const toggleGroup = (key: string) => {
    const year = typeof selectedYear === 'number' ? selectedYear : initialYear;
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      saveRecordLogsExpandedGroups(year, viewMode === 'monthly' ? selectedMonth : undefined, viewMode, Array.from(newSet));
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
      onPageChange('record', { year: targetYear, month: targetMonth, mode: 'monthly', openAttributionEdit: true });
    } else {
      onPageChange('record', { year: targetYear, mode: 'yearly', openAttributionEdit: true });
    }
  };

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    monthlyAttributions.forEach(attr => years.add(attr.year));
    yearlyAttributions.forEach(attr => years.add(attr.year));
    years.add(selectedYear === 'all' ? initialYear : selectedYear);
    return Array.from(years).sort((a, b) => b - a);
  }, [monthlyAttributions, yearlyAttributions, selectedYear, initialYear]);

  const getMonthlyAttributionsForYear = (y: number) => {
    return monthlyAttributions
      .filter(attr => attr.year === y)
      .sort((a, b) => b.month - a.month);
  };

  const getAllMonthlyAttributionsSorted = () => {
    return [...monthlyAttributions].sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });
  };

  const getAttributionForMonth = (y: number, m: number) => {
    return monthlyAttributions.find(attr => attr.year === y && attr.month === m);
  };

  const getYearlyAttributionForYear = (y: number) => {
    return yearlyAttributions.find(attr => attr.year === y);
  };

  const getAllYearlyAttributionsSorted = () => {
    return [...yearlyAttributions].sort((a, b) => b.year - a.year);
  };

  const handleViewMonthlyAttribution = (year: number, month: number) => {
    setSelectedAttributionMonth({ year, month });
  };

  const handleViewYearlyAttribution = (year: number) => {
    setSelectedAttributionYear(year);
  };

  const renderMonthlyAttributionCard = (attr: MonthlyAttribution) => {
    const key = `${attr.year}-${attr.month}`;
    const accountsForMonth = getAccountsForMonth(attr.year, attr.month).filter(a => !a.isHidden);
    const netWorth = calculateNetWorth(accountsForMonth, attr.year, attr.month);
    const isPositive = attr.change >= 0;

    return (
      <div
        key={key}
        className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-start gap-3 cursor-pointer active:scale-[0.99] transition-transform"
        onClick={() => handleViewMonthlyAttribution(attr.year, attr.month)}
      >
        {/* 月份徽章 */}
        <div
          className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-xs font-bold text-white"
          style={{ backgroundColor: themeConfig.primary }}
        >
          {attr.month}月
        </div>

        {/* 中间：标签 + 备注 */}
        <div className="flex-1 min-w-0 py-0.5">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            {attr.tags.slice(0, 3).map(tag => (
              <span key={tag} className="text-xs text-gray-600">
                {getAttributionTagEmoji(tag)} {getAttributionTagLabel(tag)}
              </span>
            ))}
            {attr.tags.length > 3 && (
              <span className="text-xs text-gray-400">+{attr.tags.length - 3}</span>
            )}
          </div>
          {attr.note ? (
            <p className="text-xs text-gray-400 break-words leading-relaxed">{attr.note}</p>
          ) : (
            <p className="text-xs text-gray-300">暂无备注</p>
          )}
        </div>

        {/* 右侧：变化金额 + 净资产 */}
        <div className="text-right flex-shrink-0 py-0.5">
          <div
            className="text-sm font-bold"
            style={{ color: isPositive ? '#16a34a' : '#dc2626' }}
          >
            {isPositive ? '+' : ''}¥{formatHiddenAmount(attr.change, hideBalance)}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            净资产 ¥{formatHiddenAmount(netWorth, hideBalance)}
          </div>
        </div>
      </div>
    );
  };

  const renderYearlyAttributionCard = (attr: YearlyAttribution) => {
    const key = `yearly-${attr.year}`;
    const isPositive = attr.change >= 0;
    const absWan = (Math.abs(attr.change) / 10000).toFixed(1);

    return (
      <div
        key={key}
        className="bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3 cursor-pointer active:scale-[0.99] transition-transform"
        onClick={() => handleViewYearlyAttribution(attr.year)}
      >
        {/* 年份徽章 */}
        <div
          className="flex-shrink-0 h-8 min-w-[52px] px-2 rounded-lg flex items-center justify-center text-xs font-bold text-white"
          style={{ backgroundColor: themeConfig.primary }}
        >
          {attr.year}年
        </div>

        {/* 中间：标签 + 备注 */}
        <div className="flex-1 min-w-0 py-0.5">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            {attr.tags.slice(0, 2).map(tag => (
              <span key={tag} className="text-sm font-semibold text-gray-700">
                {getYearlyAttributionTagEmoji(tag)} {getYearlyAttributionTagLabel(tag)}
              </span>
            ))}
            {attr.tags.length > 2 && (
              <span className="text-xs text-gray-400">+{attr.tags.length - 2}</span>
            )}
          </div>
          {attr.note ? (
            <p className="text-xs text-gray-400 break-words leading-relaxed">{attr.note}</p>
          ) : (
            <p className="text-xs text-gray-300">暂无备注</p>
          )}
        </div>

        {/* 右侧：变化金额 + 百分比 */}
        <div className="text-right flex-shrink-0">
          <div
            className="text-sm font-bold"
            style={{ color: isPositive ? '#16a34a' : '#dc2626' }}
          >
            {isPositive ? '+' : '-'}¥{hideBalance ? '***' : `${absWan}万`}
          </div>
          <div
            className="text-xs font-medium mt-0.5 px-1.5 py-0.5 rounded-lg inline-block"
            style={{
              backgroundColor: isPositive ? '#f0fdf4' : '#fef2f2',
              color: isPositive ? '#16a34a' : '#dc2626',
            }}
          >
            {attr.changePercent >= 0 ? '+' : ''}{attr.changePercent.toFixed(1)}%
          </div>
        </div>
      </div>
    );
  };

  const renderYearlyTimeline = () => {
    let y: number;
    if (selectedYear === 'all') {
      const allMonthly = getAllMonthlyAttributionsSorted();
      const allYearly = getAllYearlyAttributionsSorted();
      y = allMonthly.length > 0 ? allMonthly[0].year : 
          allYearly.length > 0 ? allYearly[0].year : 
          initialYear;
    } else {
      y = selectedYear as number;
    }

    const monthlyAttrs = getMonthlyAttributionsForYear(y);
    
    const yearMonths = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const attr = monthlyAttrs.find(a => a.month === month);
      const monthLogs = getRecordLogs(y, month);
      const accounts = getAccountsForMonth(y, month).filter(a => !a.isHidden);
      const netWorth = calculateNetWorth(accounts, y, month);
      const prevMonthNetWorth = month > 1 
        ? calculateNetWorth(getAccountsForMonth(y, month - 1).filter(a => !a.isHidden), y, month - 1)
        : null;
      const change = prevMonthNetWorth !== null ? netWorth - prevMonthNetWorth : (attr?.change || 0);
      
      // 修复：以是否有实际记录日志为准，避免无数据月份显示余额
      return { month, attr, netWorth, change, hasData: monthLogs.length > 0 || !!attr };
    });

    const recordedCount = yearMonths.filter(m => m.attr).length;
    const nowYear = new Date().getFullYear();
    const nowMonth = new Date().getMonth() + 1;

    // ── 时间轴主体 ─────────────────────────────────────────
    const renderTimeline = () => (
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-4 rounded-full" style={{ backgroundColor: themeConfig.primary }} />
          <h3 className="text-sm font-bold text-gray-700">月度归因汇总</h3>
          <span className="text-xs text-gray-400 ml-auto">{recordedCount}个月有记录</span>
        </div>

        <div className="relative">
          {/* 竖向连线 - left根据w-8重新计算: 32+12+10=54 */}
          <div
            className="absolute z-0"
            style={{
              left: '54px',
              top: '14px',
              bottom: '14px',
              width: '2px',
              background: `linear-gradient(to bottom, ${themeConfig.primary}35, ${themeConfig.primary}10)`,
            }}
          />

          <div className="space-y-2">
            {yearMonths.map(({ month, attr, netWorth, change, hasData }) => {
              const hasAttribution = !!attr;
              const isIncrease = (attr?.change ?? change) >= 0;
              const isFuture = y === nowYear && month > nowMonth;

              // 未来且无数据：极简显示
              if (isFuture && !hasData) {
                return (
                  <div key={month} className="flex items-center gap-3 py-1 opacity-35">
                    <div className="w-8 text-right text-xs text-gray-400 flex-shrink-0">{month}月</div>
                    <div
                      className="w-5 h-5 rounded-full border flex-shrink-0 relative z-10 bg-white"
                      style={{ borderColor: `${themeConfig.primary}25` }}
                    />
                    <div className="flex-1 pl-1">
                      <span className="text-xs text-gray-300">暂无记录</span>
                      <div className="w-6 h-px bg-gray-200 mt-1" />
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={month}
                  className="flex items-center gap-3 py-1 cursor-pointer group"
                  onClick={() => {
                    if (attr) {
                      handleViewMonthlyAttribution(y, month);
                    } else if (hasData) {
                      goToRecordForAttribution(y, month);
                    }
                  }}
                >
                  {/* 月份标签 - w-8防止10-12月换行，去掉mt-2 */}
                  <div
                    className="w-8 text-right text-xs font-semibold flex-shrink-0"
                    style={{ color: hasAttribution ? themeConfig.primary : '#9ca3af' }}
                  >
                    {month}月
                  </div>

                  {/* 节点圆 - 去掉mt-1.5，由父级items-center居中 */}
                  <div className="relative z-10 flex-shrink-0">
                    <div
                      className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
                      style={{
                        borderColor: hasAttribution ? themeConfig.primary : `${themeConfig.primary}35`,
                        backgroundColor: hasAttribution ? themeConfig.primary : 'white',
                      }}
                    >
                      {hasAttribution && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                  </div>

                  {/* 内容卡片 */}
                  <div
                    className={`flex-1 rounded-xl px-3 py-2.5 transition-opacity ${!hasData ? 'opacity-50' : ''}`}
                    style={{
                      backgroundColor: hasAttribution ? '#fafafa' : '#f9fafb',
                      border: '1px solid #f0f0f0',
                    }}
                  >
                    {hasAttribution ? (
                      <>
                        {/* 标签行 */}
                        <div className="flex flex-wrap gap-1 mb-1.5">
                          {attr!.tags.map(tag => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-medium"
                              style={{ backgroundColor: `${themeConfig.primary}12`, color: themeConfig.primary }}
                            >
                              {getAttributionTagEmoji(tag)} {getAttributionTagLabel(tag)}
                            </span>
                          ))}
                        </div>
                        {/* 净资产 + 变化 + 百分比 */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-base font-bold text-gray-900">
                              ¥{formatHiddenAmount(netWorth, hideBalance)}
                            </div>
                            <div
                              className={`text-xs font-medium flex items-center gap-0.5 mt-0.5 ${isIncrease ? 'text-green-600' : 'text-red-600'}`}
                            >
                              <span>{isIncrease ? '▲' : '▼'}</span>
                              <span>{isIncrease ? '+' : ''}¥{formatHiddenAmount(Math.abs(attr!.change), hideBalance)}</span>
                            </div>
                            {attr!.note && (
                              <p className="text-xs text-gray-400 mt-1 break-words leading-relaxed">{attr!.note}</p>
                            )}
                          </div>
                          <div
                            className="flex-shrink-0 px-2 py-1 rounded-lg text-xs font-bold self-start"
                            style={{
                              backgroundColor: isIncrease ? '#f0fdf4' : '#fef2f2',
                              color: isIncrease ? '#16a34a' : '#dc2626',
                            }}
                          >
                            {attr!.changePercent >= 0 ? '+' : ''}{attr!.changePercent.toFixed(1)}%
                          </div>
                        </div>
                      </>
                    ) : hasData ? (
                      /* 有数据但无归因 */
                      <>
                        <div className="text-xs text-gray-400 mb-1">未添加归因</div>
                        <div className="text-base font-bold text-gray-300">
                          ¥{formatHiddenAmount(netWorth, hideBalance)}
                        </div>
                        <div className="w-6 h-px bg-gray-200 mt-1.5" />
                      </>
                    ) : (
                      /* 无数据 */
                      <>
                        <div className="text-xs text-gray-300">暂无记录</div>
                        <div className="w-6 h-px bg-gray-200 mt-1.5" />
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );

    return (
      <div className="space-y-4">
        {renderTimeline()}
      </div>
    );
  };

  // ==================== 核心修复：月度视图按日期分组，保留可视化图标 ====================
  const renderBalanceRecords = () => {
    const year = typeof selectedYear === 'number' ? selectedYear : initialYear;
    
    if (viewMode === 'monthly') {
      const month = selectedMonth as number;
      const monthLogs = getRecordLogs(year, month).filter(
        log => selectedAccount === 'all' || log.accountId === selectedAccount
      );

      if (monthLogs.length === 0) {
        return (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <p className="text-gray-500">暂无记账记录</p>
            <Button 
              className="mt-4 text-white"
              style={{ backgroundColor: themeConfig.primary }}
              onClick={() => onPageChange('record', { year, month, mode: 'monthly' })}
            >
              前往记账
            </Button>
          </div>
        );
      }

      const dateGroups = new Map<string, RecordLog[]>();
      monthLogs.forEach(log => {
        const date = new Date(log.timestamp);
        const dateStr = `${date.getMonth() + 1}月${date.getDate()}日`;
        if (!dateGroups.has(dateStr)) dateGroups.set(dateStr, []);
        dateGroups.get(dateStr)!.push(log);
      });

      const sortedDates = Array.from(dateGroups.entries()).sort((a, b) => {
        const timeA = a[1][0]?.timestamp || 0;
        const timeB = b[1][0]?.timestamp || 0;
        return timeB - timeA;
      });

      return (
        <div className="space-y-3">
          {sortedDates.map(([dateStr, logs]) => {
            const key = `${year}-${selectedMonth}-${dateStr}`;
            const isExpanded = expandedGroups.has(key);
            
            return (
              <div key={key} className="bg-white rounded-2xl overflow-hidden shadow-sm">
                <div
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleGroup(key)}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-4 rounded-full" style={{ backgroundColor: themeConfig.primary }} />
                    <span className="font-medium text-sm">{dateStr}</span>
                    <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md">{logs.length}条</span>
                  </div>
                  {isExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                </div>
                
                {isExpanded && (
                  <div className="divide-y divide-gray-50">
                    {logs.sort((a, b) => b.timestamp - a.timestamp).map(log => {
                      const account = accounts.find(a => a.id === log.accountId);
                      if (!account) return null;
                      const change = log.newBalance - log.oldBalance;
                      const isIncrease = change >= 0;
                      
                      return (
                        <div key={log.id} className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-8 h-8 rounded-xl flex items-center justify-center"
                                style={{ backgroundColor: isIncrease ? `${themeConfig.primary}15` : '#fef2f2' }}
                              >
                                <Icon
                                  name={isIncrease ? 'trending-up' : 'trending-down'}
                                  size={16}
                                  className={isIncrease ? 'text-green-500' : 'text-red-500'}
                                />
                              </div>
                              <div>
                                <div className="text-sm font-medium text-gray-800">{account.name}</div>
                                <div className="text-xs text-gray-400">{getOperationTypeLabel(log.operationType)}</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`text-sm font-semibold ${isIncrease ? 'text-green-600' : 'text-red-500'}`}>
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
              </div>
            );
          })}
        </div>
      );
    } else {
      const y = typeof year === 'number' ? year : initialYear;
      return (
        <div className="space-y-3">
          {Array.from({ length: 12 }, (_, i) => 12 - i).map(month => {
            const monthLogs = getRecordLogs(y, month).filter(
              log => selectedAccount === 'all' || log.accountId === selectedAccount
            );
            if (monthLogs.length === 0) return null;
            
            const lastLog = monthLogs.sort((a, b) => b.timestamp - a.timestamp)[0];
            const lastRecordDate = formatDate(lastLog.timestamp);
            const monthAccounts = getAccountsForMonth(y, month).filter(a => !a.isHidden);
            const monthNetWorth = calculateNetWorth(monthAccounts, y, month);
            
            const key = `${y}-${month.toString().padStart(2, '0')}`;
            const isExpanded = expandedGroups.has(key);

            return (
              <div key={month} className="bg-white rounded-2xl overflow-hidden shadow-sm">
                <div
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleGroup(key)}
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                      style={{ backgroundColor: themeConfig.primary }}
                    >
                      {month}月
                    </div>
                    <div>
                      <div className="font-medium text-sm">{y}年{month}月</div>
                      <div className="text-xs text-gray-400">最后记录: {lastRecordDate}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-gray-900">
                      ¥{formatHiddenAmount(monthNetWorth, hideBalance)}
                    </div>
                    <div className="text-xs text-gray-400">{monthLogs.length}条记录</div>
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="divide-y divide-gray-50">
                    <div className="p-3 bg-gray-50/50">
                      <div className="text-xs font-medium text-gray-500 mb-2">月末账户余额</div>
                      {monthAccounts.map(account => {
                        const record = getMonthlyRecord(account.id, y, month);
                        const balance = record ? record.balance : account.balance;
                        const isCredit = account.type === 'credit';
                        const isDebt = account.type === 'debt';
                        
                        if (selectedAccount !== 'all' && selectedAccount !== account.id) return null;
                        
                        return (
                          <div key={account.id} className="flex items-center justify-between py-1.5">
                            <div className="flex items-center gap-2">
                              <Icon name={account.icon} size={14} className="text-gray-500" />
                              <span className="text-sm text-gray-700">{account.name}</span>
                            </div>
                            <span className={`text-sm font-medium ${isCredit || isDebt ? 'text-red-500' : 'text-gray-900'}`}>
                              ¥{formatHiddenAmount(balance, hideBalance)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    
                    <div className="p-3">
                      <div className="text-xs font-medium text-gray-500 mb-2">变动记录</div>
                      {monthLogs.sort((a, b) => b.timestamp - a.timestamp).map(log => {
                        const account = accounts.find(a => a.id === log.accountId);
                        if (!account) return null;
                        const change = log.newBalance - log.oldBalance;
                        const isIncrease = change >= 0;
                        
                        return (
                          <div key={log.id} className="flex items-center justify-between py-2">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-6 h-6 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: isIncrease ? `${themeConfig.primary}15` : '#fef2f2' }}
                              >
                                <Icon
                                  name={isIncrease ? 'trending-up' : 'trending-down'}
                                  size={12}
                                  className={isIncrease ? 'text-green-500' : 'text-red-500'}
                                />
                              </div>
                              <div>
                                <div className="text-sm text-gray-800">{account.name}</div>
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
              </div>
            );
          })}
        </div>
      );
    }
  };

  const renderMonthlyAttributionTab = () => {
    const y = typeof selectedYear === 'number' ? selectedYear : initialYear;
    const m = selectedMonth;
    
    const attr = getAttributionForMonth(y, m);
    if (!attr) {
      return (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
          <BarChart3 size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">暂无月度归因记录</p>
          <Button 
            className="mt-4 text-white"
            style={{ backgroundColor: themeConfig.primary }}
            onClick={() => goToRecordForAttribution(y, m)}
          >
            前往记账
          </Button>
        </div>
      );
    }
    return renderMonthlyAttributionCard(attr);
  };

  const renderYearlyAttributionTab = () => {
    if (selectedYear === 'all') {
      const allAttributions = getAllYearlyAttributionsSorted();
      if (allAttributions.length === 0) {
        return (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <BarChart3 size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">暂无年度归因记录</p>
          </div>
        );
      }
      return (
        <div className="space-y-3">
          {allAttributions.map(attr => renderYearlyAttributionCard(attr))}
        </div>
      );
    }

    const attr = getYearlyAttributionForYear(selectedYear as number);
    if (!attr) {
      return (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
          <AlertTriangle size={32} className="mx-auto text-orange-400 mb-3" />
          <p className="text-gray-600 font-medium">{selectedYear}年未记录年度归因</p>
          <Button 
            className="mt-4 text-white"
            style={{ backgroundColor: themeConfig.primary }}
            onClick={() => goToRecordForAttribution(selectedYear as number)}
          >
            补充记录
          </Button>
        </div>
      );
    }
    return renderYearlyAttributionCard(attr);
  };

  return (
    <div className="pb-6 min-h-screen overflow-x-hidden" style={{ backgroundColor: themeConfig.bgLight }}>
      <header className="px-4 py-3 flex justify-between items-center fixed top-0 left-0 right-0 z-50 max-w-md mx-auto shadow-sm rounded-b-2xl" style={{ backgroundColor: themeConfig.primary }}>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="text-white" onClick={() => onPageChange('record')}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-lg font-bold text-white">记账记录</h1>
        </div>
        <button
          onClick={() => {
            const newValue = !hideBalance;
            setHideBalance(newValue);
            updateSettings({ hideBalance: newValue });
          }}
          className="flex items-center gap-1.5 text-white border border-white/40 bg-white/20 hover:bg-white/30 rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
        >
          {hideBalance ? <EyeOff size={14} /> : <Eye size={14} />}
          <span>{hideBalance ? '显示' : '隐藏'}</span>
        </button>
      </header>

      <div className="h-14"></div>

      <div className="px-4 pt-4 pb-2 space-y-3">
        <div className="bg-white rounded-2xl p-1.5 shadow-sm flex relative overflow-hidden">
          <div 
            className="absolute top-1.5 bottom-1.5 rounded-xl transition-all duration-300 ease-out"
            style={{ 
              backgroundColor: `${themeConfig.primary}12`,
              left: viewMode === 'monthly' ? '6px' : '50%',
              width: 'calc(50% - 6px)'
            }}
          />
          <button
            className={`flex-1 py-2.5 rounded-xl text-base font-bold transition-colors relative z-10 ${
              viewMode === 'monthly' ? '' : 'text-gray-400'
            }`}
            style={{ color: viewMode === 'monthly' ? themeConfig.primary : undefined }}
            onClick={() => setViewMode('monthly')}
          >
            月度视图
          </button>
          <button
            className={`flex-1 py-2.5 rounded-xl text-base font-bold transition-colors relative z-10 ${
              viewMode === 'yearly' ? '' : 'text-gray-400'
            }`}
            style={{ color: viewMode === 'yearly' ? themeConfig.primary : undefined }}
            onClick={() => setViewMode('yearly')}
          >
            年度视图
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-stretch">
            <div className="w-1.5 flex-shrink-0" style={{ backgroundColor: themeConfig.primary }} />
            
            <div className="flex-1 p-3.5 space-y-2">
              {viewMode === 'monthly' ? (
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">
                      年份
                    </label>
                    <div className="relative">
                      <select
                        value={typeof selectedYear === 'number' ? selectedYear : initialYear}
                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                        className="w-full bg-gray-50 rounded-xl px-3 py-2.5 pr-8 text-sm font-bold text-gray-800 appearance-none focus:outline-none focus:ring-2 border-0"
                        style={{ '--tw-ring-color': `${themeConfig.primary}40` } as any}
                      >
                        {availableYears.map(y => (
                          <option key={y} value={y}>{y}年</option>
                        ))}
                      </select>
                      <ChevronDown
                        size={14}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                      />
                    </div>
                  </div>
                  <div className="relative flex-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">
                      月份
                    </label>
                    <div className="relative">
                      <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                        className="w-full bg-gray-50 rounded-xl px-3 py-2.5 pr-8 text-sm font-bold text-gray-800 appearance-none focus:outline-none focus:ring-2 border-0"
                        style={{ '--tw-ring-color': `${themeConfig.primary}40` } as any}
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                          <option key={m} value={m}>{m}月</option>
                        ))}
                      </select>
                      <ChevronDown
                        size={14}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">
                    选择年份
                  </label>
                  <div className="relative">
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                      className="w-full bg-gray-50 rounded-xl px-3 py-2.5 pr-8 text-sm font-bold text-gray-800 appearance-none focus:outline-none focus:ring-2 border-0"
                      style={{ '--tw-ring-color': `${themeConfig.primary}40` } as any}
                    >
                      <option value="all">全部年份</option>
                      {availableYears.map(y => (
                        <option key={y} value={y}>{y}年</option>
                      ))}
                    </select>
                    <ChevronDown
                      size={14}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {viewMode === 'yearly' ? (
          <div className="bg-white rounded-2xl p-1.5 shadow-sm flex relative overflow-hidden">
            <div 
              className="absolute top-1.5 bottom-1.5 rounded-xl transition-all duration-300 ease-out"
              style={{ 
                backgroundColor: `${themeConfig.primary}12`,
                left: yearlySubView === 'balance' ? '6px' : yearlySubView === 'timeline' ? '33.33%' : '66.66%',
                width: 'calc(33.33% - 4px)'
              }}
            />
            <button
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors relative z-10 ${
                yearlySubView === 'balance' ? '' : 'text-gray-400'
              }`}
              style={{ color: yearlySubView === 'balance' ? themeConfig.primary : undefined }}
              onClick={() => setYearlySubView('balance')}
            >
              余额记录
            </button>
            <button
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors relative z-10 ${
                yearlySubView === 'timeline' ? '' : 'text-gray-400'
              }`}
              style={{ color: yearlySubView === 'timeline' ? themeConfig.primary : undefined }}
              onClick={() => setYearlySubView('timeline')}
            >
              月度归因
            </button>
            <button
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors relative z-10 ${
                yearlySubView === 'yearly_attribution' ? '' : 'text-gray-400'
              }`}
              style={{ color: yearlySubView === 'yearly_attribution' ? themeConfig.primary : undefined }}
              onClick={() => setYearlySubView('yearly_attribution')}
            >
              年度归因
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-1.5 shadow-sm flex relative overflow-hidden">
            <div 
              className="absolute top-1.5 bottom-1.5 rounded-xl transition-all duration-300 ease-out"
              style={{ 
                backgroundColor: `${themeConfig.primary}12`,
                left: monthlySubView === 'balance' ? '6px' : '50%',
                width: 'calc(50% - 6px)'
              }}
            />
            <button
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors relative z-10 ${
                monthlySubView === 'balance' ? '' : 'text-gray-400'
              }`}
              style={{ color: monthlySubView === 'balance' ? themeConfig.primary : undefined }}
              onClick={() => setMonthlySubView('balance')}
            >
              余额记录
            </button>
            <button
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors relative z-10 ${
                monthlySubView === 'attribution' ? '' : 'text-gray-400'
              }`}
              style={{ color: monthlySubView === 'attribution' ? themeConfig.primary : undefined }}
              onClick={() => setMonthlySubView('attribution')}
            >
              月度归因
            </button>
          </div>
        )}
      </div>

      <div className="px-4 pt-4 space-y-4">
        {((viewMode === 'monthly' && monthlySubView === 'balance') || (viewMode === 'yearly' && yearlySubView === 'balance')) && (
          <div className="bg-white rounded-2xl p-3">
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
          </div>
        )}

        {viewMode === 'monthly' && monthlySubView === 'balance' && renderBalanceRecords()}
        {viewMode === 'monthly' && monthlySubView === 'attribution' && renderMonthlyAttributionTab()}
        {viewMode === 'yearly' && yearlySubView === 'balance' && renderBalanceRecords()}
        {viewMode === 'yearly' && yearlySubView === 'timeline' && renderYearlyTimeline()}
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