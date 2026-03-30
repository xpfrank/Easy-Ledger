import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ArrowLeft, TrendingUp, TrendingDown, Calendar, ChevronDown, Edit3, AlertTriangle, X, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { PageRoute, ThemeType, MonthlyNetWorth, AccountSnapshot } from '@/types';
import { formatAmountNoSymbol, getSettings, getMonthlyAttribution, getAccountSnapshotsByMonth, getAttributionTagLabel, getAttributionTagEmoji } from '@/lib/storage';
import { calculateNetWorth, calculateTotalAssets, calculateTotalLiabilities } from '@/lib/calculator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { THEMES } from '@/types';
import { Icon } from '@/components/Icon';

interface TrendPageProps {
  onPageChange: (page: PageRoute, params?: any) => void;
}

type TimeRange = '6' | '12' | 'all';
type TrendType = 'monthly' | 'yearly';
type FilterTag = 'all' | 'salary' | 'bonus' | 'investment' | 'expense' | 'abnormal';

interface YearlyNetWorth {
  year: number;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  change: number;
  changePercent: number;
  attribution?: {
    tags: string[];
    note?: string;
    fluctuationLevel: 'normal' | 'warning' | 'abnormal';
  };
  isFiltered?: boolean;
}

interface TrendPoint extends MonthlyNetWorth {
  attribution?: {
    tags: string[];
    note?: string;
    fluctuationLevel: 'normal' | 'warning' | 'abnormal';
  };
  isFiltered?: boolean;
}

type TrendData = TrendPoint | YearlyNetWorth;

interface NodeStyle {
  size: number;
  color: string;
  stroke: string;
  pulse: boolean;
  label?: string;
  opacity: number;
}

export function TrendPage({ onPageChange }: TrendPageProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('12');
  const [trendType, setTrendType] = useState<TrendType>('monthly');
  const [showTrendDropdown, setShowTrendDropdown] = useState(false);
  const [monthlyHistory, setMonthlyHistory] = useState<TrendPoint[]>([]);
  const [yearlyHistory, setYearlyHistory] = useState<YearlyNetWorth[]>([]);
  const [selectedData, setSelectedData] = useState<TrendData | null>(null);
  const [theme, setTheme] = useState<ThemeType>('blue');
  const [hideBalance, setHideBalance] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; data: TrendData; clientX: number; clientY: number } | null>(null);
  const [filterTag, setFilterTag] = useState<FilterTag>('all');
  const [expandedSnapshots, setExpandedSnapshots] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const chartRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const themeConfig = THEMES[theme] || THEMES.blue;

  const formatBalance = (amount: number): string => {
    if (hideBalance) return '******';
    return formatAmountNoSymbol(amount);
  };

  const getNodeStyle = useCallback((changePercent: number, isFiltered: boolean): NodeStyle => {
    const absPercent = Math.abs(changePercent);

    if (!isFiltered && filterTag !== 'all') {
      return { 
        size: 6, 
        color: '#d1d5db', 
        stroke: '#9ca3af', 
        pulse: false, 
        opacity: 0.4 
      };
    }

    if (absPercent > 30) {
      const emoji = changePercent > 0 ? '📈' : '📉';
      return {
        size: 20,
        color: changePercent > 0 ? '#fa8c16' : '#ff4d4f',
        stroke: '#ffffff',
        pulse: true,
        label: emoji,
        opacity: 1
      };
    } else if (absPercent > 10) {
      return {
        size: 12,
        color: changePercent > 0 ? '#52c41a' : '#ff4d4f',
        stroke: '#ffffff',
        pulse: false,
        opacity: 1
      };
    } else {
      return {
        size: 8,
        color: '#1890ff',
        stroke: '#ffffff',
        pulse: false,
        opacity: 1
      };
    }
  }, [filterTag]);

  const getConsistentNetWorthHistory = useCallback((months: number): TrendPoint[] => {
    const data = JSON.parse(localStorage.getItem('simple-ledger-data') || '{}');
    const records = data.records || [];

    const monthSet = new Set<string>([]);
    records.forEach((r: any) => {
      monthSet.add(`${r.year}-${r.month.toString().padStart(2, '0')}`);
    });

    const now = new Date();
    monthSet.add(`${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`);

    const sortedMonths = Array.from(monthSet).sort();
    const filteredMonths = months > 0 ? sortedMonths.slice(-months) : sortedMonths;

    const history: TrendPoint[] = [];

    for (const monthKey of filteredMonths) {
      const [year, month] = monthKey.split('-').map(Number);
      const totalAssets = calculateTotalAssets(year, month);
      const totalLiabilities = calculateTotalLiabilities(year, month);
      const netWorth = totalAssets - totalLiabilities;

      let lastYear = year;
      let lastMonth = month - 1;
      if (lastMonth === 0) {
        lastYear--;
        lastMonth = 12;
      }
      const lastNetWorth = calculateNetWorth(lastYear, lastMonth);
      const change = netWorth - lastNetWorth;
      const changePercent = lastNetWorth !== 0 ? (change / Math.abs(lastNetWorth)) * 100 : 0;

      const attribution = getMonthlyAttribution(year, month);
      let fluctuationLevel: 'normal' | 'warning' | 'abnormal' = 'normal';
      if (Math.abs(changePercent) > 30) {
        fluctuationLevel = 'abnormal';
      } else if (Math.abs(changePercent) > 10) {
        fluctuationLevel = 'warning';
      }

      history.push({
        year,
        month,
        netWorth,
        totalAssets,
        totalLiabilities,
        change,
        changePercent,
        attribution: attribution ? {
          tags: attribution.tags,
          note: attribution.note,
          fluctuationLevel
        } : undefined,
        isFiltered: false
      });
    }

    return history;
  }, []);

  const getConsistentYearlyNetWorthHistory = useCallback((): YearlyNetWorth[] => {
    const data = JSON.parse(localStorage.getItem('simple-ledger-data') || '{}');
    const records = data.records || [];

    const yearSet = new Set<number>([]);
    records.forEach((r: any) => {
      yearSet.add(r.year);
    });

    const now = new Date();
    yearSet.add(now.getFullYear());

    const sortedYears = Array.from(yearSet).sort();
    const history: YearlyNetWorth[] = [];

    for (let i = 0; i < sortedYears.length; i++) {
      const year = sortedYears[i];
      const yearRecords = records.filter((r: any) => r.year === year);
      let lastMonth = 12;
      if (yearRecords.length > 0) {
        lastMonth = Math.max(...yearRecords.map((r: any) => r.month));
      }

      const totalAssets = calculateTotalAssets(year, lastMonth);
      const totalLiabilities = calculateTotalLiabilities(year, lastMonth);
      const netWorth = totalAssets - totalLiabilities;

      const lastYearNetWorth = calculateNetWorth(year - 1, 12);
      const change = netWorth - lastYearNetWorth;
      const changePercent = lastYearNetWorth !== 0 ? (change / Math.abs(lastYearNetWorth)) * 100 : 0;

      history.push({
        year,
        netWorth,
        totalAssets,
        totalLiabilities,
        change,
        changePercent,
      });
    }

    return history;
  }, []);

  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      const settings = getSettings();
      const validThemes: ThemeType[] = ['blue', 'green', 'orange', 'dark', 'purple'];
      const themeValue = validThemes.includes(settings.theme as ThemeType) ? settings.theme : 'blue';
      setTheme(themeValue as ThemeType);
      setHideBalance(settings.hideBalance || false);
      
      const months = timeRange === 'all' ? 0 : parseInt(timeRange);
      setMonthlyHistory(getConsistentNetWorthHistory(months));
      setYearlyHistory(getConsistentYearlyNetWorthHistory());
      setIsLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [timeRange, getConsistentNetWorthHistory, getConsistentYearlyNetWorthHistory]);

  const history = trendType === 'monthly' ? monthlyHistory : yearlyHistory;

  const filteredHistory = useMemo(() => {
    if (trendType !== 'monthly') return history;
    if (filterTag === 'all') return history;

    return history.map(point => {
      if (!point.attribution) {
        return { ...point, isFiltered: true };
      }

      let shouldShow = false;
      switch (filterTag) {
        case 'salary':
          shouldShow = point.attribution.tags.includes('salary') || point.attribution.tags.includes('salary_income');
          break;
        case 'bonus':
          shouldShow = point.attribution.tags.includes('bonus') || point.attribution.tags.includes('year_end_bonus');
          break;
        case 'investment':
          shouldShow = point.attribution.tags.includes('investment');
          break;
        case 'expense':
          shouldShow = point.attribution.tags.includes('large_expense') || point.attribution.tags.includes('expense');
          break;
        case 'abnormal':
          shouldShow = point.attribution.fluctuationLevel === 'abnormal';
          break;
        default:
          shouldShow = true;
      }

      return { ...point, isFiltered: !shouldShow };
    });
  }, [history, filterTag, trendType]);

  const stats = useMemo(() => {
    if (filteredHistory.length === 0) return null;

    const netWorths = filteredHistory.filter(h => !h.isFiltered).map(h => h.netWorth);
    if (netWorths.length === 0) return null;

    const maxNetWorth = Math.max(...netWorths);
    const minNetWorth = Math.min(...netWorths);
    const avgNetWorth = netWorths.reduce((a, b) => a + b, 0) / netWorths.length;

    const firstNetWorth = netWorths[0];
    const lastNetWorth = netWorths[netWorths.length - 1];
    const totalChange = lastNetWorth - firstNetWorth;
    const totalChangePercent = firstNetWorth !== 0 ? (totalChange / Math.abs(firstNetWorth)) * 100 : 0;

    return {
      maxNetWorth,
      minNetWorth,
      avgNetWorth,
      totalChange,
      totalChangePercent,
    };
  }, [filteredHistory]);

  const chartData = useMemo(() => {
    const validHistory = filteredHistory.filter(h => !h.isFiltered);
    if (validHistory.length === 0) return null;

    const netWorths = validHistory.map(h => h.netWorth);
    const max = Math.max(...netWorths, 0);
    const min = Math.min(...netWorths, 0);
    const range = max - min || 1;

    const points = filteredHistory.map((h, index) => {
      const validIndex = filteredHistory.slice(0, index + 1).filter(p => !p.isFiltered).length - 1;
      const validLength = validHistory.length;
      const x = validLength > 1 ? (validIndex / (validLength - 1)) * 100 : 50;
      const y = max === min ? 50 : 100 - ((h.netWorth - min) / range) * 80 - 10;
      return { x, y, data: h };
    });

    const validPoints = points.filter(p => !p.data.isFiltered);
    let pathD = '';
    if (validPoints.length > 1) {
      pathD = `M ${validPoints[0].x} ${validPoints[0].y}`;
      for (let i = 1; i < validPoints.length; i++) {
        const prev = validPoints[i - 1];
        const curr = validPoints[i];
        const cp1x = prev.x + (curr.x - prev.x) / 3;
        const cp1y = prev.y;
        const cp2x = prev.x + (curr.x - prev.x) * 2 / 3;
        const cp2y = curr.y;
        pathD += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`;
      }
    }

    const fillD = validPoints.length > 1 
      ? pathD + ` L ${validPoints[validPoints.length - 1].x} 100 L ${validPoints[0].x} 100 Z`
      : '';

    let allPathD = '';
    if (points.length > 1) {
      allPathD = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const cp1x = prev.x + (curr.x - prev.x) / 3;
        const cp1y = prev.y;
        const cp2x = prev.x + (curr.x - prev.x) * 2 / 3;
        const cp2y = curr.y;
        allPathD += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`;
      }
    }

    return { points, pathD, fillD, allPathD, max, min, range, validPoints };
  }, [filteredHistory, trendType]);

  const showYearSeparators = useMemo(() => {
    if (trendType === 'yearly') return false;
    const validHistory = filteredHistory.filter(h => !h.isFiltered);
    if (validHistory.length < 2) return false;
    const firstYear = validHistory[0].year;
    const lastYear = validHistory[validHistory.length - 1].year;
    return firstYear !== lastYear;
  }, [filteredHistory, trendType]);

  const formatMonthLabel = (year: number, month: number) => {
    return `${year}年${month.toString().padStart(2, '0')}月`;
  };

  const formatSmartAmount = (amount: number, useUnit: string): string => {
    const absValue = Math.abs(amount);
    if (useUnit === 'w') {
      return (amount / 10000).toFixed(1) + 'w';
    } else if (useUnit === 'k') {
      if (absValue >= 10000) {
        return Math.round(amount / 1000) + 'k';
      } else {
        return (amount / 1000).toFixed(1) + 'k';
      }
    } else {
      return Math.round(amount).toString();
    }
  };

  const getNiceStep = (range: number, tickCount: number): number => {
    if (range <= 0) return 1;
    const roughStep = range / (tickCount - 1);
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
    const normalized = roughStep / magnitude;

    let niceNormalized: number;
    if (normalized <= 1) niceNormalized = 1;
    else if (normalized <= 2) niceNormalized = 2;
    else if (normalized <= 5) niceNormalized = 5;
    else niceNormalized = 10;

    return niceNormalized * magnitude;
  };

  const yAxisConfig = useMemo(() => {
    if (!chartData) return { ticks: [], unit: '元' };

    const validNetWorths = chartData.validPoints.map(p => p.data.netWorth);
    if (validNetWorths.length === 0) return { ticks: [], unit: '元' };

    const max = Math.max(...validNetWorths, 0);
    const min = Math.min(...validNetWorths, 0);
    const range = max - min;
    const tickCount = 7;

    const absMax = Math.max(Math.abs(max), Math.abs(min));
    let unit: '元' | 'k' | 'w';
    if (absMax >= 1000000) {
      unit = 'w';
    } else if (absMax >= 10000) {
      unit = 'k';
    } else {
      unit = '元';
    }

    const step = getNiceStep(range, tickCount);
    const niceMin = Math.floor(min / step) * step;
    const niceMax = Math.ceil(max / step) * step;

    const ticks = [];
    for (let value = niceMax; value >= niceMin - step / 2; value -= step) {
      if (ticks.length >= tickCount) break;
      ticks.push({
        value,
        label: formatSmartAmount(value, unit),
        rawValue: value
      });
    }

    return { ticks, unit };
  }, [chartData]);

  const goToRecordForAttribution = (year: number, month?: number) => {
    if (month !== undefined) {
      onPageChange('record', { year, month, mode: 'monthly' });
    } else {
      onPageChange('record', { year, mode: 'yearly' });
    }
  };

  const getSelectedSnapshots = (): AccountSnapshot[] => {
    if (!selectedData || !('month' in selectedData)) return [];
    return getAccountSnapshotsByMonth(selectedData.year, selectedData.month);
  };

  const handleMouseEnter = useCallback((point: any, e: React.MouseEvent) => {
    setHoveredPoint({
      ...point,
      clientX: e.clientX,
      clientY: e.clientY
    });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (hoveredPoint) {
      setHoveredPoint(prev => prev ? { ...prev, clientX: e.clientX, clientY: e.clientY } : null);
    }
  }, [hoveredPoint]);

  const handleMouseLeave = useCallback(() => {
    setHoveredPoint(null);
  }, []);

  const getTooltipPosition = () => {
    if (!hoveredPoint || !tooltipRef.current) return { left: 0, top: 0 };
    
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const chartRect = chartRef.current?.getBoundingClientRect();
    if (!chartRect) return { left: 0, top: 0 };

    let left = hoveredPoint.clientX - chartRect.left;
    let top = hoveredPoint.clientY - chartRect.top - tooltipRect.height - 16;

    if (left + tooltipRect.width > chartRect.width) {
      left = chartRect.width - tooltipRect.width - 8;
    }
    if (left < 8) left = 8;
    if (top < 8) top = hoveredPoint.clientY - chartRect.top + 16;

    return { left, top };
  };

  const tooltipPos = getTooltipPosition();

  const SkeletonCard = () => (
    <Card className="bg-white">
      <CardContent className="p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-100 rounded"></div>
          <div className="flex justify-between">
            <div className="h-3 bg-gray-200 rounded w-16"></div>
            <div className="h-3 bg-gray-200 rounded w-16"></div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="pb-6 bg-gray-50 min-h-screen overflow-x-hidden">
      <header className="bg-white px-4 py-3 flex justify-between items-center fixed top-0 left-0 right-0 z-50 max-w-md mx-auto shadow-sm">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => onPageChange('home')}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-lg font-semibold">资产趋势</h1>
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
          <div className="relative">
            <button
              className="flex items-center gap-1 px-4 py-2 bg-white rounded-lg border border-gray-200 text-sm font-medium transition-all hover:shadow-md"
              onClick={() => setShowTrendDropdown(!showTrendDropdown)}
            >
              {trendType === 'monthly' ? '月度趋势' : '年度趋势'}
              <ChevronDown size={16} className={`text-gray-400 transition-transform ${showTrendDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showTrendDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50 min-w-[120px] animate-in fade-in zoom-in-95 duration-200">
                <button
                  className={`w-full px-4 py-2 text-left text-sm transition-colors ${trendType === 'monthly' ? 'text-white' : 'hover:bg-gray-50'}`}
                  style={{ backgroundColor: trendType === 'monthly' ? themeConfig.primary : undefined }}
                  onClick={() => {
                    setTrendType('monthly');
                    setShowTrendDropdown(false);
                  }}
                >
                  月度趋势
                </button>
                <button
                  className={`w-full px-4 py-2 text-left text-sm transition-colors ${trendType === 'yearly' ? 'text-white' : 'hover:bg-gray-50'}`}
                  style={{ backgroundColor: trendType === 'yearly' ? themeConfig.primary : undefined }}
                  onClick={() => {
                    setTrendType('yearly');
                    setShowTrendDropdown(false);
                  }}
                >
                  年度趋势
                </button>
              </div>
            )}
          </div>

          {trendType === 'monthly' && (
            <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)} className="flex-1">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="6">近6月</TabsTrigger>
                <TabsTrigger value="12">近1年</TabsTrigger>
                <TabsTrigger value="all">全部</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        </div>

        {trendType === 'monthly' && (
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 overflow-x-auto scrollbar-hide">
            {[
              { key: 'all', label: '全部', emoji: '📊' },
              { key: 'salary', label: '工资', emoji: '💰' },
              { key: 'bonus', label: '奖金', emoji: '🎁' },
              { key: 'investment', label: '投资', emoji: '📈' },
              { key: 'expense', label: '支出', emoji: '🛒' },
              { key: 'abnormal', label: '异常', emoji: '⚠️' },
            ].map(item => (
              <button
                key={item.key}
                className={`px-3 py-1.5 rounded-md text-xs whitespace-nowrap transition-all duration-200 ${
                  filterTag === item.key
                    ? 'bg-white shadow-sm text-gray-800 scale-105'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-200/50'
                }`}
                onClick={() => setFilterTag(item.key as FilterTag)}
              >
                {item.emoji} {item.label}
              </button>
            ))}
          </div>
        )}

        {isLoading ? (
          <SkeletonCard />
        ) : filteredHistory.filter(h => !h.isFiltered).length === 0 ? (
          <Card className="bg-white">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3 animate-pulse">
                <TrendingUp size={28} className="text-gray-400" />
              </div>
              <p className="text-gray-500 font-medium">筛选结果为空</p>
              <p className="text-sm text-gray-400 mt-1">尝试选择其他筛选条件</p>
            </CardContent>
          </Card>
        ) : history.length === 0 ? (
          <Card className="bg-white">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <TrendingUp size={28} className="text-gray-400" />
              </div>
              <p className="text-gray-500 font-medium">还没有足够的数据</p>
              <p className="text-sm text-gray-400 mt-1">请至少记录两个月的余额数据</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="bg-white shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="relative h-72 w-full" ref={chartRef}>
                  <div className="absolute left-0 top-0 bottom-12 w-14 flex flex-col justify-between text-xs text-gray-400">
                    {yAxisConfig.ticks.map((tick, index) => (
                      <span key={index} className="transition-all duration-300">{tick.label}</span>
                    ))}
                  </div>

                  <div 
                    className="absolute left-14 right-0 top-0 bottom-12"
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                  >
                    <svg
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                      className="w-full h-full"
                    >
                      <defs>
                        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={themeConfig.primary} stopOpacity="0.3" />
                          <stop offset="100%" stopColor={themeConfig.primary} stopOpacity="0.05" />
                        </linearGradient>
                        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                          <feMerge>
                            <feMergeNode in="coloredBlur"/>
                            <feMergeNode in="SourceGraphic"/>
                          </feMerge>
                        </filter>
                      </defs>

                      {[10, 30, 50, 70, 90].map(y => (
                        <line 
                          key={y} 
                          x1="0" 
                          y1={y} 
                          x2="100" 
                          y2={y} 
                          stroke="#f0f0f0" 
                          strokeWidth="0.5"
                          strokeDasharray="2,2"
                        />
                      ))}

                      {chartData?.fillD && (
                        <path d={chartData.fillD} fill="url(#areaGradient)" className="transition-all duration-500" />
                      )}

                      {chartData?.allPathD && filterTag !== 'all' && (
                        <path
                          d={chartData.allPathD}
                          fill="none"
                          stroke="#d1d5db"
                          strokeWidth="1"
                          strokeDasharray="4,4"
                          strokeOpacity="0.5"
                        />
                      )}

                      {chartData?.pathD && (
                        <path
                          d={chartData.pathD}
                          fill="none"
                          stroke={themeConfig.primary}
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="transition-all duration-500"
                          filter="url(#glow)"
                        />
                      )}

                      {chartData?.points.map((point, index) => {
                        const nodeStyle = getNodeStyle(point.data.changePercent, point.data.isFiltered || false);
                        const isValidPoint = !point.data.isFiltered;
                        const isHovered = hoveredPoint?.data === point.data;
                        
                        return (
                          <g key={index}>
                            {nodeStyle.pulse && isValidPoint && (
                              <circle
                                cx={point.x}
                                cy={point.y}
                                r={nodeStyle.size * 1.5}
                                fill={nodeStyle.color}
                                fillOpacity="0.2"
                                className="animate-ping"
                                style={{ animationDuration: '2s' }}
                              />
                            )}
                            
                            {isHovered && isValidPoint && (
                              <circle
                                cx={point.x}
                                cy={point.y}
                                r={(isHovered ? nodeStyle.size * 1.3 : nodeStyle.size) + 4}
                                fill={nodeStyle.color}
                                fillOpacity="0.1"
                                className="transition-all duration-200"
                              />
                            )}

                            <circle
                              cx={point.x}
                              cy={point.y}
                              r={isHovered ? nodeStyle.size * 1.3 : nodeStyle.size}
                              fill={isValidPoint ? nodeStyle.color : '#ffffff'}
                              stroke={nodeStyle.stroke}
                              strokeWidth={isValidPoint ? 2 : 1}
                              strokeDasharray={!isValidPoint ? '2,2' : undefined}
                              fillOpacity={nodeStyle.opacity}
                              className="cursor-pointer transition-all duration-200"
                              onMouseEnter={(e) => handleMouseEnter(point, e)}
                              onClick={() => setSelectedData(point.data)}
                              filter={isValidPoint && (nodeStyle.pulse || isHovered) ? 'url(#glow)' : undefined}
                            />

                            {nodeStyle.label && isValidPoint && (
                              <text
                                x={point.x}
                                y={point.y - nodeStyle.size - 6}
                                textAnchor="middle"
                                fontSize="10"
                                fill={nodeStyle.color}
                                fontWeight="bold"
                                className="transition-all duration-300"
                                style={{ opacity: isHovered ? 1 : 0.8 }}
                              >
                                {nodeStyle.label}
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </svg>

                    {hoveredPoint && (
                      <div
                        ref={tooltipRef}
                        className="absolute z-50 pointer-events-none"
                        style={{
                          left: tooltipPos.left,
                          top: tooltipPos.top,
                          transition: 'all 0.15s ease-out'
                        }}
                      >
                        <div className="bg-gray-900/95 text-white text-xs rounded-lg px-3 py-2 shadow-xl backdrop-blur-sm border border-gray-700/50">
                          <div className="font-semibold mb-1">
                            {trendType === 'yearly'
                              ? `${hoveredPoint.data.year}年`
                              : `${hoveredPoint.data.year}年${'month' in hoveredPoint.data ? hoveredPoint.data.month.toString().padStart(2, '0') : '01'}月`
                            }
                          </div>
                          <div className="text-gray-300">
                            净资产: <span className="text-white font-medium">{formatBalance(hoveredPoint.data.netWorth)}</span>
                          </div>
                          {hoveredPoint.data.change !== 0 && (
                            <div className={`text-xs mt-1 ${hoveredPoint.data.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {hoveredPoint.data.change >= 0 ? '+' : ''}{formatBalance(hoveredPoint.data.change)}
                              ({hoveredPoint.data.change >= 0 ? '+' : ''}{hoveredPoint.data.changePercent.toFixed(1)}%)
                            </div>
                          )}
                          {hoveredPoint.data.attribution && (
                            <div className="flex flex-wrap gap-1 mt-1.5 pt-1.5 border-t border-gray-700">
                              {hoveredPoint.data.attribution.tags.slice(0, 2).map(tag => (
                                <span key={tag} className="text-xs bg-gray-800 px-1.5 py-0.5 rounded">
                                  {getAttributionTagEmoji(tag as any)}{getAttributionTagLabel(tag as any)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div 
                          className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 bg-gray-900/95 rotate-45 border-r border-b border-gray-700/50"
                        />
                      </div>
                    )}
                  </div>

                  <div className="absolute left-14 right-0 bottom-0 h-10 flex justify-between items-end text-xs text-gray-400">
                    {trendType === 'yearly' ? (
                      (filteredHistory as TrendPoint[]).filter(h => !h.isFiltered).map((h, i) => (
                        <span key={i} className="transition-all duration-300">{h.year}年</span>
                      ))
                    ) : (
                      (filteredHistory as TrendPoint[]).filter(h => !h.isFiltered).length <= 6 ? (
                        (filteredHistory as TrendPoint[]).filter(h => !h.isFiltered).map((h, i) => (
                          <span key={i} className="transition-all duration-300">{h.month}月</span>
                        ))
                      ) : (
                        <>
                          <span>{(filteredHistory as TrendPoint[]).filter(h => !h.isFiltered)[0]?.month}月</span>
                          {showYearSeparators && (
                            <span style={{ color: themeConfig.primary }} className="font-medium">
                              {(filteredHistory as TrendPoint[]).filter(h => !h.isFiltered)[0]?.year}
                            </span>
                          )}
                          <span>{(filteredHistory as TrendPoint[]).filter(h => !h.isFiltered)[Math.floor((filteredHistory as TrendPoint[]).filter(h => !h.isFiltered).length / 2)]?.month}月</span>
                          {showYearSeparators && (
                            <span style={{ color: themeConfig.primary }} className="font-medium">
                              {(filteredHistory as TrendPoint[]).filter(h => !h.isFiltered)[(filteredHistory as TrendPoint[]).filter(h => !h.isFiltered).length - 1]?.year}
                            </span>
                          )}
                          <span>{(filteredHistory as TrendPoint[]).filter(h => !h.isFiltered)[(filteredHistory as TrendPoint[]).filter(h => !h.isFiltered).length - 1]?.month}月</span>
                        </>
                      )
                    )}
                  </div>
                </div>

                <p className="text-center text-xs text-gray-400 mt-3">
                  点击节点查看详情，悬停查看预览
                </p>
              </CardContent>
            </Card>

            {stats && (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { 
                    icon: TrendingUp, 
                    color: 'text-green-500', 
                    bg: 'bg-green-50', 
                    label: '最高净资产', 
                    value: stats.maxNetWorth 
                  },
                  { 
                    icon: TrendingDown, 
                    color: 'text-red-500', 
                    bg: 'bg-red-50', 
                    label: '最低净资产', 
                    value: stats.minNetWorth 
                  },
                  { 
                    icon: Calendar, 
                    color: 'text-blue-500', 
                    bg: 'bg-blue-50', 
                    label: '平均净资产', 
                    value: stats.avgNetWorth 
                  },
                  { 
                    icon: stats.totalChange >= 0 ? TrendingUp : TrendingDown, 
                    color: stats.totalChange >= 0 ? 'text-green-500' : 'text-red-500', 
                    bg: stats.totalChange >= 0 ? 'bg-green-50' : 'bg-red-50', 
                    label: '总变化', 
                    value: stats.totalChange,
                    showSign: true,
                    valueColor: stats.totalChange >= 0 ? 'text-green-600' : 'text-red-500'
                  },
                ].map((stat, index) => (
                  <Card key={index} className="bg-white hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center`}>
                          <stat.icon size={16} className={stat.color} />
                        </div>
                        <span className="text-xs text-gray-500">{stat.label}</span>
                      </div>
                      <div className={`text-lg font-bold ${stat.valueColor || 'text-gray-900'}`}>
                        {stat.showSign && stat.value >= 0 ? '+' : ''}{formatBalance(stat.value)}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <Dialog 
        open={!!selectedData} 
        onOpenChange={(open) => {
          if (!open) {
            setSelectedData(null);
            setExpandedSnapshots(false);
          }
        }}
      >
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader className="sticky top-0 bg-white z-10 pb-2 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg">
                {selectedData && ('month' in selectedData
                  ? formatMonthLabel(selectedData.year, selectedData.month)
                  : `${selectedData.year}年`
                )}
              </DialogTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  setSelectedData(null);
                  setExpandedSnapshots(false);
                }}
              >
                <X size={18} />
              </Button>
            </div>
          </DialogHeader>
          
          {selectedData && (
            <div className="space-y-4 py-2">
              <div 
                className="rounded-xl p-4 text-white"
                style={{ 
                  background: `linear-gradient(135deg, ${themeConfig.gradientFrom} 0%, ${themeConfig.gradientTo} 100%)` 
                }}
              >
                <div className="text-white/80 text-sm mb-1">净资产</div>
                <div className="text-3xl font-bold mb-2">{formatBalance(selectedData.netWorth)}</div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-white/70">较上期</span>
                  <span className={`font-semibold ${selectedData.change >= 0 ? 'text-white' : 'text-red-100'}`}>
                    {selectedData.change >= 0 ? '+' : ''}{formatBalance(selectedData.change)}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${selectedData.change >= 0 ? 'bg-white/20' : 'bg-red-500/30'}`}>
                    {selectedData.change >= 0 ? '+' : ''}{selectedData.changePercent.toFixed(1)}%
                  </span>
                </div>
              </div>

              {selectedData.attribution ? (
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-100">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-medium text-gray-600">变化归因</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      selectedData.attribution.fluctuationLevel === 'normal' ? 'bg-green-100 text-green-700' :
                      selectedData.attribution.fluctuationLevel === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {selectedData.attribution.fluctuationLevel === 'normal' ? '正常' :
                       selectedData.attribution.fluctuationLevel === 'warning' ? '需关注' : '异常'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {selectedData.attribution.tags.map(tag => (
                      <span 
                        key={tag} 
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-white rounded-full text-sm shadow-sm border border-gray-100"
                      >
                        <span>{getAttributionTagEmoji(tag as any)}</span>
                        <span className="text-gray-700">{getAttributionTagLabel(tag as any)}</span>
                      </span>
                    ))}
                  </div>
                  {selectedData.attribution.note && (
                    <p className="text-sm text-gray-600 bg-white/50 rounded-lg p-3 leading-relaxed">
                      {selectedData.attribution.note}
                    </p>
                  )}
                </div>
              ) : (
                <div className="bg-orange-50 rounded-xl p-4 flex items-start gap-3 border border-orange-100">
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle size={20} className="text-orange-500" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-orange-800 mb-1">本月未记录变化原因</div>
                    <p className="text-xs text-orange-600 leading-relaxed">建议补充记录归因信息，以便后续分析资产变化趋势和制定财务规划。</p>
                  </div>
                </div>
              )}

              {('month' in selectedData) && (
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <button
                    className="flex items-center justify-between w-full p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                    onClick={() => setExpandedSnapshots(!expandedSnapshots)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">账户余额快照</span>
                      <span className="text-xs text-gray-400 font-normal">({getSelectedSnapshots().length}个账户)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">
                        {expandedSnapshots ? '收起' : '展开'}
                      </span>
                      <ChevronDown 
                        size={18} 
                        className={`text-gray-400 transition-transform duration-200 ${expandedSnapshots ? 'rotate-180' : ''}`} 
                      />
                    </div>
                  </button>
                  
                  {expandedSnapshots && (
                    <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                      {getSelectedSnapshots().map((snapshot, index) => (
                        <div 
                          key={snapshot.accountId} 
                          className="flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                              snapshot.accountType === 'credit' || snapshot.accountType === 'debt' 
                                ? 'bg-red-50' 
                                : 'bg-blue-50'
                            }`}>
                              <Icon 
                                name={snapshot.accountIcon} 
                                size={18}
                                className={snapshot.accountType === 'credit' || snapshot.accountType === 'debt' ? 'text-red-500' : 'text-blue-500'}
                              />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-800">{snapshot.accountName}</div>
                              <div className="text-xs text-gray-400">
                                {snapshot.accountType === 'credit' ? '信用卡' :
                                 snapshot.accountType === 'debt' ? '债务' :
                                 snapshot.accountType === 'investment' ? '投资' :
                                 snapshot.accountType === 'digital' ? '电子钱包' : '储蓄账户'}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-sm font-semibold ${
                              snapshot.accountType === 'credit' || snapshot.accountType === 'debt' 
                                ? 'text-red-500' 
                                : 'text-gray-900'
                            }`}>
                              {snapshot.accountType === 'credit' || snapshot.accountType === 'debt' ? '-' : ''}
                              ¥{formatBalance(Math.abs(snapshot.balance))}
                            </div>
                            {snapshot.change !== undefined && snapshot.change !== 0 && (
                              <div className={`text-xs flex items-center justify-end gap-0.5 ${
                                snapshot.change >= 0 ? 'text-green-500' : 'text-red-500'
                              }`}>
                                {snapshot.change >= 0 ? (
                                  <TrendingUp size={10} />
                                ) : (
                                  <TrendingDown size={10} />
                                )}
                                <span>
                                  {snapshot.change >= 0 ? '+' : ''}{formatBalance(Math.abs(snapshot.change))}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 h-11"
                  onClick={() => {
                    if ('month' in selectedData) {
                      onPageChange('record-logs', { year: selectedData.year, month: selectedData.month, mode: 'monthly' });
                    } else {
                      onPageChange('record-logs', { year: selectedData.year, mode: 'yearly' });
                    }
                  }}
                >
                  查看完整记账
                </Button>
                <Button
                  className="flex-1 h-11 text-white"
                  style={{ backgroundColor: themeConfig.primary }}
                  onClick={() => goToRecordForAttribution(selectedData.year, 'month' in selectedData ? selectedData.month : undefined)}
                >
                  <Edit3 size={16} className="mr-2" />
                  {selectedData.attribution ? '编辑备注' : '补充记录'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}