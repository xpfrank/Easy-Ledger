import { useState, useEffect, useMemo, useRef } from 'react';
import { ArrowLeft, TrendingUp, TrendingDown, Calendar, ChevronDown, Edit3, AlertTriangle, BarChart3 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { PageRoute, ThemeType, MonthlyNetWorth, AccountSnapshot } from '@/types';
import { formatAmountNoSymbol, getSettings, getMonthlyAttribution, getAccountSnapshotsByMonth } from '@/lib/storage';
import { calculateNetWorth, calculateTotalAssets, calculateTotalLiabilities } from '@/lib/calculator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { THEMES, getAttributionTagLabel, getAttributionTagEmoji } from '@/types';
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
}

interface TrendPoint extends MonthlyNetWorth {
  attribution?: {
    tags: string[];
    note?: string;
    fluctuationLevel: 'normal' | 'warning' | 'abnormal';
  };
  isFiltered?: boolean;
}

export function TrendPage({ onPageChange }: TrendPageProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('12');
  const [trendType, setTrendType] = useState<TrendType>('monthly');
  const [showTrendDropdown, setShowTrendDropdown] = useState(false);
  const [monthlyHistory, setMonthlyHistory] = useState<TrendPoint[]>([]);
  const [yearlyHistory, setYearlyHistory] = useState<YearlyNetWorth[]>([]);
  const [selectedData, setSelectedData] = useState<TrendPoint | null>(null);
  const [theme, setTheme] = useState<ThemeType>('blue');
  const [hideBalance, setHideBalance] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; data: TrendPoint } | null>(null);
  const [filterTag, setFilterTag] = useState<FilterTag>('all');
  const [expandedSnapshots, setExpandedSnapshots] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  const themeConfig = THEMES[theme] || THEMES.blue;

  // 格式化金额，支持隐藏显示
  const formatBalance = (amount: number): string => {
    if (hideBalance) {
      return '******';
    }
    return formatAmountNoSymbol(amount);
  };

  // 获取节点样式（根据变化幅度）
  const getNodeStyle = (changePercent: number, isFiltered: boolean): { size: number; color: string; stroke: string; pulse: boolean; label?: string } => {
    const absPercent = Math.abs(changePercent);

    if (!isFiltered && filterTag !== 'all') {
      // 非目标月份：灰色空心
      return { size: 8, color: '#d1d5db', stroke: '#9ca3af', pulse: false };
    }

    if (absPercent > 30) {
      // 异常波动：20px，橙色/红色，脉冲动画，标签
      const emoji = changePercent > 0 ? '📈' : '📉';
      return {
        size: 20,
        color: changePercent > 0 ? '#fa8c16' : '#ff4d4f',
        stroke: changePercent > 0 ? '#ffffff' : '#ffffff',
        pulse: true,
        label: emoji
      };
    } else if (absPercent > 10) {
      // 警告波动：12px，绿色/红色
      return {
        size: 12,
        color: changePercent > 0 ? '#52c41a' : '#ff4d4f',
        stroke: '#ffffff',
        pulse: false
      };
    } else {
      // 正常波动：8px，蓝色
      return {
        size: 8,
        color: '#1890ff',
        stroke: '#ffffff',
        pulse: false
      };
    }
  };

  // 获取月度净资产历史（与首页逻辑一致，排除 includeInTotal=false 的账户）
  const getConsistentNetWorthHistory = (months: number): TrendPoint[] => {
    const data = JSON.parse(localStorage.getItem('simple-ledger-data') || '{}');
    const records = data.records || [];

    // 获取所有有记录的月份
    const monthSet = new Set<string>([]);
    records.forEach((r: any) => {
      monthSet.add(`${r.year}-${r.month.toString().padStart(2, '0')}`);
    });

    // 添加当前月份
    const now = new Date();
    monthSet.add(`${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`);

    // 排序
    const sortedMonths = Array.from(monthSet).sort();

    // 如果 months > 0，取最近N个月；否则取全部
    const filteredMonths = months > 0 ? sortedMonths.slice(-months) : sortedMonths;

    const history: TrendPoint[] = [];

    for (const monthKey of filteredMonths) {
      const [year, month] = monthKey.split('-').map(Number);
      // 使用与首页一致的计算函数
      const totalAssets = calculateTotalAssets(year, month);
      const totalLiabilities = calculateTotalLiabilities(year, month);
      const netWorth = totalAssets - totalLiabilities;

      // 计算上月数据用于对比
      let lastYear = year;
      let lastMonth = month - 1;
      if (lastMonth === 0) {
        lastYear--;
        lastMonth = 12;
      }
      const lastNetWorth = calculateNetWorth(lastYear, lastMonth);
      const change = netWorth - lastNetWorth;
      const changePercent = lastNetWorth !== 0 ? (change / Math.abs(lastNetWorth)) * 100 : 0;

      // 获取归因信息
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
  };

  // 获取年度净资产历史（与首页逻辑一致）
  const getConsistentYearlyNetWorthHistory = (): YearlyNetWorth[] => {
    const data = JSON.parse(localStorage.getItem('simple-ledger-data') || '{}');
    const records = data.records || [];

    // 获取所有有记录的年份
    const yearSet = new Set<number>([]);
    records.forEach((r: any) => {
      yearSet.add(r.year);
    });

    // 添加当前年份
    const now = new Date();
    yearSet.add(now.getFullYear());

    // 排序
    const sortedYears = Array.from(yearSet).sort();

    const history: YearlyNetWorth[] = [];

    for (let i = 0; i < sortedYears.length; i++) {
      const year = sortedYears[i];

      // 获取该年度最后一个有记录的月份
      const yearRecords = records.filter((r: any) => r.year === year);
      let lastMonth = 12;
      if (yearRecords.length > 0) {
        lastMonth = Math.max(...yearRecords.map((r: any) => r.month));
      }

      // 使用与首页一致的计算函数
      const totalAssets = calculateTotalAssets(year, lastMonth);
      const totalLiabilities = calculateTotalLiabilities(year, lastMonth);
      const netWorth = totalAssets - totalLiabilities;

      // 计算上一年度数据用于对比
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
  };

  useEffect(() => {
    const settings = getSettings();
    const validThemes: ThemeType[] = ['blue', 'green', 'orange', 'dark', 'purple'];
    const themeValue = validThemes.includes(settings.theme as ThemeType) ? settings.theme : 'blue';
    setTheme(themeValue as ThemeType);
    setHideBalance(settings.hideBalance || false);
    // 当选择"全部"时，传入 0 表示获取所有数据
    const months = timeRange === 'all' ? 0 : parseInt(timeRange);
    // 使用与首页一致的计算逻辑
    setMonthlyHistory(getConsistentNetWorthHistory(months));
    setYearlyHistory(getConsistentYearlyNetWorthHistory());
  }, [timeRange]);

  // 当前显示的历史数据
  const history = trendType === 'monthly' ? monthlyHistory : yearlyHistory;

  // 根据筛选标签计算是否过滤
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

  // 计算图表数据
  const chartData = useMemo(() => {
    const validHistory = filteredHistory.filter(h => !h.isFiltered);
    if (validHistory.length === 0) return null;

    const netWorths = validHistory.map(h => h.netWorth);
    const max = Math.max(...netWorths, 0);
    const min = Math.min(...netWorths, 0);
    const range = max - min || 1;

    // 计算坐标点
    const points = filteredHistory.map((h, index) => {
      const validIndex = filteredHistory.slice(0, index + 1).filter(p => !p.isFiltered).length - 1;
      const validLength = validHistory.length;
      const x = validLength > 1 ? (validIndex / (validLength - 1)) * 100 : 50;
      const y = max === min ? 50 : 100 - ((h.netWorth - min) / range) * 80 - 10;
      return { x, y, data: h };
    });

    // 生成 SVG 路径（仅连接非过滤点）
    const validPoints = points.filter(p => !p.data.isFiltered);
    const pathD = validPoints.length > 0
      ? `M ${validPoints[0].x} ${validPoints[0].y} ` +
        validPoints.slice(1).map((p, i) => {
          const prev = validPoints[i];
          const cp1x = prev.x + (p.x - prev.x) / 3;
          const cp1y = prev.y;
          const cp2x = prev.x + (p.x - prev.x) * 2 / 3;
          const cp2y = p.y;
          return `C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p.x} ${p.y}`;
        }).join(' ')
      : '';

    // 生成填充区域路径
    const lastValidPoint = validPoints[validPoints.length - 1];
    const firstValidPoint = validPoints[0];
    const fillD = pathD + ` L ${lastValidPoint?.x || 0} 100 L ${firstValidPoint?.x || 0} 100 Z`;

    return { points, pathD, fillD, max, min, range, validPoints };
  }, [filteredHistory, trendType]);

  // 判断是否需要显示年份分隔（跨年度时，仅月度趋势）
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

  // 智能金额格式化 - 根据数值大小自动选择合适的单位和精度
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

  // 计算规整的刻度间隔
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

  // 计算Y轴刻度 - 智能生成等距、规整的刻度
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

  // 跳转到记账页面补充记录
  const goToRecordForAttribution = (year: number, month?: number) => {
    if (month !== undefined) {
      onPageChange('record', { year, month, mode: 'monthly' });
    } else {
      onPageChange('record', { year, mode: 'yearly' });
    }
  };

  // 获取选中数据的账户快照
  const getSelectedSnapshots = (): AccountSnapshot[] => {
    if (!selectedData || !selectedData.month) return [];
    return getAccountSnapshotsByMonth(selectedData.year, selectedData.month);
  };

  return (
    <div className="pb-6 bg-gray-50 min-h-screen overflow-x-hidden">
      {/* 标题栏 - 使用 fixed 定位确保始终可见 */}
      <header className="bg-white px-4 py-3 flex justify-between items-center fixed top-0 left-0 right-0 z-50 max-w-md mx-auto shadow-sm">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => onPageChange('home')}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-lg font-semibold">资产趋势</h1>
        </div>
      </header>

      {/* 占位元素，防止内容被固定标题栏遮挡 */}
      <div className="h-14"></div>

      <div className="p-4 space-y-4">
        {/* 趋势类型切换 + 时间范围选择 */}
        <div className="flex gap-2">
          {/* 趋势类型下拉 */}
          <div className="relative">
            <button
              className="flex items-center gap-1 px-4 py-2 bg-white rounded-lg border border-gray-200 text-sm font-medium"
              onClick={() => setShowTrendDropdown(!showTrendDropdown)}
            >
              {trendType === 'monthly' ? '月度趋势' : '年度趋势'}
              <ChevronDown size={16} className="text-gray-400" />
            </button>

            {showTrendDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50 min-w-[120px]">
                <button
                  className={`w-full px-4 py-2 text-left text-sm ${trendType === 'monthly' ? 'text-white' : 'hover:bg-gray-50'}`}
                  style={{ backgroundColor: trendType === 'monthly' ? themeConfig.primary : undefined }}
                  onClick={() => {
                    setTrendType('monthly');
                    setShowTrendDropdown(false);
                  }}
                >
                  月度趋势
                </button>
                <button
                  className={`w-full px-4 py-2 text-left text-sm ${trendType === 'yearly' ? 'text-white' : 'hover:bg-gray-50'}`}
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

          {/* 时间范围选择（仅月度趋势显示） */}
          {trendType === 'monthly' && (
            <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)} className="flex-1">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="6">近6个月</TabsTrigger>
                <TabsTrigger value="12">近1年</TabsTrigger>
                <TabsTrigger value="all">全部</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        </div>

        {/* 筛选栏（仅月度趋势显示） */}
        {trendType === 'monthly' && (
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 overflow-x-auto">
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
                className={`px-3 py-1.5 rounded-md text-xs whitespace-nowrap transition-colors ${
                  filterTag === item.key
                    ? 'bg-white shadow text-gray-800'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
                onClick={() => setFilterTag(item.key as FilterTag)}
              >
                {item.emoji} {item.label}
              </button>
            ))}
          </div>
        )}

        {filteredHistory.filter(h => !h.isFiltered).length === 0 ? (
          <Card className="bg-white">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <TrendingUp size={28} className="text-gray-400" />
              </div>
              <p className="text-gray-500">筛选结果为空</p>
              <p className="text-sm text-gray-400 mt-1">尝试选择其他筛选条件</p>
            </CardContent>
          </Card>
        ) : history.length === 0 ? (
          <Card className="bg-white">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <TrendingUp size={28} className="text-gray-400" />
              </div>
              <p className="text-gray-500">还没有足够的数据</p>
              <p className="text-sm text-gray-400 mt-1">请至少记录两个月的余额数据</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* 折线图 */}
            <Card className="bg-white">
              <CardContent className="p-4">
                <div className="relative h-64 w-full" ref={chartRef}>
                  {/* Y轴标签 - 智能单位 */}
                  <div className="absolute left-0 top-0 bottom-12 w-14 flex flex-col justify-between text-xs text-gray-400">
                    {yAxisConfig.ticks.map((tick, index) => (
                      <span key={index}>{tick.label}</span>
                    ))}
                  </div>

                  {/* 图表区域 */}
                  <div className="absolute left-14 right-0 top-0 bottom-12">
                    <svg
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                      className="w-full h-full"
                      onMouseLeave={() => setHoveredPoint(null)}
                    >
                      {/* 网格线 */}
                      <line x1="0" y1="10" x2="100" y2="10" stroke="#f0f0f0" strokeWidth="0.5" />
                      <line x1="0" y1="50" x2="100" y2="50" stroke="#f0f0f0" strokeWidth="0.5" />
                      <line x1="0" y1="90" x2="100" y2="90" stroke="#f0f0f0" strokeWidth="0.5" />

                      {/* 填充区域 */}
                      {chartData?.fillD && (
                        <defs>
                          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={themeConfig.primary} stopOpacity="0.4" />
                            <stop offset="100%" stopColor={themeConfig.primary} stopOpacity="0.05" />
                          </linearGradient>
                        </defs>
                      )}
                      {chartData?.fillD && (
                        <path d={chartData.fillD} fill="url(#areaGradient)" />
                      )}

                      {/* 折线 */}
                      {chartData?.pathD && (
                        <path
                          d={chartData.pathD}
                          fill="none"
                          stroke={themeConfig.primary}
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}

                      {/* 数据点 - 根据变化幅度分层 */}
                      {chartData?.points.map((point, index) => {
                        const nodeStyle = getNodeStyle(point.data.changePercent, point.data.isFiltered || false);
                        const isValidPoint = !point.data.isFiltered;
                        return (
                          <g key={index}>
                            {/* 悬停区域（更大，便于触摸） */}
                            <circle
                              cx={point.x}
                              cy={point.y}
                              r="8"
                              fill="transparent"
                              className="cursor-pointer"
                              onMouseEnter={() => setHoveredPoint(point)}
                              onClick={() => setSelectedData(point.data)}
                            />
                            {/* 可见的数据点 */}
                            {isValidPoint ? (
                              <>
                                {/* 脉冲动画背景（仅异常波动） */}
                                {nodeStyle.pulse && (
                                  <circle
                                    cx={point.x}
                                    cy={point.y}
                                    r={nodeStyle.size * 1.5}
                                    fill={nodeStyle.color}
                                    fillOpacity="0.3"
                                    className="animate-ping"
                                  />
                                )}
                                <circle
                                  cx={point.x}
                                  cy={point.y}
                                  r={hoveredPoint?.data === point.data ? nodeStyle.size * 1.2 : nodeStyle.size}
                                  fill={nodeStyle.color}
                                  stroke={nodeStyle.stroke}
                                  strokeWidth="2"
                                  className="cursor-pointer transition-all duration-200"
                                  onMouseEnter={() => setHoveredPoint(point)}
                                  onClick={() => setSelectedData(point.data)}
                                />
                                {/* 标签（仅异常波动） */}
                                {nodeStyle.label && (
                                  <text
                                    x={point.x}
                                    y={point.y - nodeStyle.size - 4}
                                    textAnchor="middle"
                                    fontSize="8"
                                    fill={nodeStyle.color}
                                  >
                                    {nodeStyle.label}
                                  </text>
                                )}
                              </>
                            ) : (
                              /* 过滤掉的点：空心灰色 */
                              <>
                                <circle
                                  cx={point.x}
                                  cy={point.y}
                                  r="3"
                                  fill="#ffffff"
                                  stroke="#d1d5db"
                                  strokeWidth="1"
                                  strokeDasharray="2,2"
                                />
                              </>
                            )}
                          </g>
                        );
                      })}
                    </svg>

                    {/* 悬停提示 */}
                    {hoveredPoint && (
                      <div
                        className="absolute bg-gray-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg pointer-events-none z-10"
                        style={{
                          left: `${Math.min(Math.max(hoveredPoint.x, 15), 85)}%`,
                          top: `${Math.max(hoveredPoint.y - 15, 5)}%`,
                          transform: 'translate(-50%, -100%)',
                        }}
                      >
                        <div className="font-medium">
                          {trendType === 'yearly'
                            ? `${hoveredPoint.data.year}年`
                            : `${hoveredPoint.data.year}年${hoveredPoint.data.month?.toString().padStart(2, '0') || '01'}月`
                          }
                        </div>
                        <div className="text-gray-300">
                          余额: {formatBalance(hoveredPoint.data.netWorth)}
                        </div>
                        {hoveredPoint.data.attribution && (
                          <div className="text-gray-400 mt-1">
                            {hoveredPoint.data.attribution.tags.map(tag =>
                              `${getAttributionTagEmoji(tag as any)}${getAttributionTagLabel(tag as any)}`
                            ).join(' ')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* X轴标签 */}
                  <div className="absolute left-14 right-0 bottom-0 h-10 flex justify-between items-end text-xs text-gray-400">
                    {trendType === 'yearly' ? (
                      (filteredHistory as TrendPoint[]).filter(h => !h.isFiltered).map((h, i) => (
                        <span key={i}>{h.year}年</span>
                      ))
                    ) : (
                      (filteredHistory as TrendPoint[]).filter(h => !h.isFiltered).length <= 6 ? (
                        (filteredHistory as TrendPoint[]).filter(h => !h.isFiltered).map((h, i) => (
                          <span key={i}>{h.month}月</span>
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

                <p className="text-center text-xs text-gray-400 mt-2">
                  点击图表节点查看详情
                </p>
              </CardContent>
            </Card>

            {/* 数据摘要 */}
            {stats && (
              <div className="grid grid-cols-2 gap-3">
                <Card className="bg-white">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp size={16} className="text-green-500" />
                      <span className="text-xs text-gray-500">最高净资产</span>
                    </div>
                    <div className="text-lg font-semibold">{formatBalance(stats.maxNetWorth)}</div>
                  </CardContent>
                </Card>
                <Card className="bg-white">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingDown size={16} className="text-red-500" />
                      <span className="text-xs text-gray-500">最低净资产</span>
                    </div>
                    <div className="text-lg font-semibold">{formatBalance(stats.minNetWorth)}</div>
                  </CardContent>
                </Card>
                <Card className="bg-white">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar size={16} className="text-blue-500" />
                      <span className="text-xs text-gray-500">平均净资产</span>
                    </div>
                    <div className="text-lg font-semibold">{formatBalance(stats.avgNetWorth)}</div>
                  </CardContent>
                </Card>
                <Card className="bg-white">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      {stats.totalChange >= 0 ? (
                        <TrendingUp size={16} className="text-green-500" />
                      ) : (
                        <TrendingDown size={16} className="text-red-500" />
                      )}
                      <span className="text-xs text-gray-500">总变化</span>
                    </div>
                    <div className={`text-lg font-semibold ${stats.totalChange >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {stats.totalChange >= 0 ? '+' : ''}{formatBalance(stats.totalChange)}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}
      </div>

      {/* 详情弹窗 */}
      <Dialog open={!!selectedData} onOpenChange={() => {
        setSelectedData(null);
        setExpandedSnapshots(false);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedData && (selectedData.month
                ? formatMonthLabel(selectedData.year, selectedData.month)
                : `${selectedData.year}年`
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedData && (
            <div className="space-y-4 py-4">
              {/* 基本信息 */}
              <div className="text-center">
                <div className="text-sm text-gray-500 mb-1">净资产</div>
                <div className="text-3xl font-bold text-sky-600">
                  {formatBalance(selectedData.netWorth)}
                </div>
                <div className={`text-lg font-medium mt-1 ${selectedData.change >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {selectedData.change >= 0 ? '+' : ''}{formatBalance(selectedData.change)}
                  ({hideBalance ? '******' : `${selectedData.changePercent >= 0 ? '+' : ''}${selectedData.changePercent.toFixed(2)}%`})
                </div>
              </div>

              {/* 归因信息 */}
              {selectedData.attribution ? (
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    {selectedData.attribution.tags.map(tag => (
                      <span key={tag} className="text-sm">
                        {getAttributionTagEmoji(tag as any)} {getAttributionTagLabel(tag as any)}
                      </span>
                    ))}
                  </div>
                  {selectedData.attribution.note && (
                    <p className="text-sm text-gray-600">{selectedData.attribution.note}</p>
                  )}
                </div>
              ) : (
                <div className="bg-orange-50 rounded-lg p-4 flex items-start gap-2">
                  <AlertTriangle size={18} className="text-orange-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-orange-700">本月未记录变化原因</div>
                    <p className="text-xs text-orange-600 mt-1">建议补充记录，以便后续回看分析</p>
                  </div>
                </div>
              )}

              {/* 账户快照 */}
              {selectedData.month && (
                <div className="border-t border-gray-100 pt-4">
                  <button
                    className="flex items-center justify-between w-full text-sm font-medium text-gray-700 mb-2"
                    onClick={() => setExpandedSnapshots(!expandedSnapshots)}
                  >
                    <span>各账户余额</span>
                    <span className={expandedSnapshots ? 'text-gray-400' : ''}>
                      {expandedSnapshots ? '收起' : '展开'}
                    </span>
                  </button>
                  {expandedSnapshots && (
                    <div className="space-y-2">
                      {getSelectedSnapshots().map(snapshot => (
                        <div key={snapshot.accountId} className="flex items-center justify-between text-sm py-1 border-b border-gray-50 last:border-0">
                          <div className="flex items-center gap-2">
                            <Icon name={snapshot.accountIcon} size={16} />
                            <span>{snapshot.accountName}</span>
                          </div>
                          <div className="text-right">
                            <span className={snapshot.accountType === 'credit' || snapshot.accountType === 'debt' ? 'text-red-500' : ''}>
                              ¥{formatBalance(snapshot.balance)}
                            </span>
                            {snapshot.change !== undefined && snapshot.change !== 0 && (
                              <div className={`text-xs ${snapshot.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {snapshot.change >= 0 ? '↑+' : '↓'}{formatBalance(snapshot.change)}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 操作按钮 */}
              <div className="flex gap-2 pt-4 border-t border-gray-100">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    if (selectedData.month) {
                      onPageChange('record-logs', { year: selectedData.year, month: selectedData.month, mode: 'monthly' });
                    } else {
                      onPageChange('record-logs', { year: selectedData.year, mode: 'yearly' });
                    }
                  }}
                >
                  查看完整记账
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => goToRecordForAttribution(selectedData.year, selectedData.month)}
                >
                  <Edit3 size={14} className="mr-1" />
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
