import { useState, useEffect, useMemo, useRef } from 'react';
import { ArrowLeft, TrendingUp, TrendingDown, Calendar, ChevronDown, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { PageRoute, ThemeType, MonthlyNetWorth, AttributionTag } from '@/types';
import { formatAmountNoSymbol, getSettings, getMonthlyAttribution, getYearlyAttribution, getAttributionTagLabel, getAttributionTagEmoji, getAccountsForMonth } from '@/lib/storage';
import { calculateNetWorth, calculateTotalAssets, calculateTotalLiabilities } from '@/lib/calculator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  ReferenceDot,
} from 'recharts';

const AnimatedPulseDot = ({ cx, cy, r, fill, stroke, strokeWidth, isMin }: any) => {
  const color = isMin ? LOW_POINT_COLOR : stroke;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r * 2} fill={color} opacity={0.15}>
        <animate attributeName="r" values={`${r};${r * 2.5};${r}`} dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.15;0;0.15" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={strokeWidth} opacity={0.4} />
      <circle cx={cx} cy={cy} r={r * 0.6} fill="none" stroke={color} strokeWidth={strokeWidth * 0.8} opacity={0.6} />
      <circle cx={cx} cy={cy} r={r * 0.35} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
    </g>
  );
};

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
    tags: AttributionTag[];
    note?: string;
    fluctuationLevel: 'normal' | 'warning' | 'abnormal';
  };
  isFiltered?: boolean;
  hasData?: boolean;
}

interface TrendPoint extends MonthlyNetWorth {
  attribution?: {
    tags: AttributionTag[];
    note?: string;
    fluctuationLevel: 'normal' | 'warning' | 'abnormal';
  };
  isFiltered?: boolean;
  hasData?: boolean;
}

interface QuarterlyNetWorth {
  year: number;
  quarter: number;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  _originalMonths: TrendPoint[];
  fullLabel: string;
  label: string;
}

interface MonthRowProps {
  month: TrendPoint;
  themeColor: string;
  formatBalance: (n: number) => string;
  onView: () => void;
  onAddAttribution: () => void;
  showDivider: boolean;
}

function MonthRow({ month, themeColor, formatBalance, onView, onAddAttribution, showDivider }: MonthRowProps) {
  const changeVal = month.change ?? 0;
  const isUp = changeVal >= 0;
  const hasAttribution = month.attribution?.tags?.length;

  return (
    <div className={`${showDivider ? 'mb-3' : ''}`}>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3.5">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-sm font-bold text-gray-900">
            {month.year}年{month.month.toString().padStart(2, '0')}月
          </span>
          <span className="text-base font-bold" style={{ color: themeColor }}>
            ¥{formatBalance(month.netWorth)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
            {hasAttribution ? (
              <>
                {month.attribution!.tags.slice(0, 2).map((tag: AttributionTag, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium"
                    style={{
                      backgroundColor: `${themeColor}15`,
                      color: themeColor,
                    }}
                  >
                    <span>{getAttributionTagEmoji(tag)}</span>
                    <span>{getAttributionTagLabel(tag)}</span>
                  </span>
                ))}
                {changeVal !== 0 && (
                  <span className={`text-xs font-semibold ${isUp ? 'text-green-600' : 'text-red-500'}`}>
                    {isUp ? '+' : ''}¥{formatBalance(Math.abs(changeVal))}
                  </span>
                )}
              </>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-yellow-500 text-xs">⚠️</span>
                <span className="text-xs text-gray-400">暂无归因数据</span>
                <button
                  onClick={onAddAttribution}
                  className="inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full border font-medium transition-colors hover:opacity-80"
                  style={{
                    borderColor: themeColor,
                    color: themeColor,
                    backgroundColor: `${themeColor}08`,
                  }}
                >
                  <span>+</span>
                  <span>补充归因</span>
                </button>
              </div>
            )}
          </div>

          <button
            onClick={onView}
            className="flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors hover:opacity-80"
            style={{
              borderColor: `${themeColor}40`,
              color: themeColor,
              backgroundColor: `${themeColor}08`,
            }}
          >
            查看
          </button>
        </div>
      </div>
    </div>
  );
}

function aggregateToQuarter(data: TrendPoint[]): QuarterlyNetWorth[] {
  const quarterMap: Record<string, TrendPoint[]> = {};

  data.forEach((item) => {
    const quarter = Math.ceil(item.month / 3);
    const key = `${item.year}-Q${quarter}`;
    if (!quarterMap[key]) {
      quarterMap[key] = [];
    }
    quarterMap[key].push(item);
  });

  return Object.entries(quarterMap).map(([key, months]) => {
    const [yearStr, quarterStr] = key.split('-Q');
    const year = parseInt(yearStr);
    const quarterNum = parseInt(quarterStr);
    const lastMonth = months.sort((a: TrendPoint, b: TrendPoint) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    })[months.length - 1];

    return {
      year,
      quarter: quarterNum,
      netWorth: lastMonth.netWorth,
      totalAssets: lastMonth.totalAssets,
      totalLiabilities: lastMonth.totalLiabilities,
      _originalMonths: months,
      fullLabel: `${year}年第${quarterNum}季度`,
      label: `${year.toString().slice(2)}Q${quarterNum}`,
    };
  }).sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.quarter - b.quarter;
  });
}

// 用于选中和悬停数据的联合类型
type TrendData = TrendPoint | YearlyNetWorth | QuarterlyNetWorth;

// 问题1修复：定义淡红色用于最低谷标注
const LOW_POINT_COLOR = '#f87171'; // 淡红色

export function TrendPage({ onPageChange }: TrendPageProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('12');
  const [trendType, setTrendType] = useState<TrendType>('monthly');
  const [showTrendDropdown, setShowTrendDropdown] = useState(false);
  const [monthlyHistory, setMonthlyHistory] = useState<TrendPoint[]>([]);
  const [yearlyHistory, setYearlyHistory] = useState<YearlyNetWorth[]>([]);
  const [selectedData, setSelectedData] = useState<TrendData | null>(null);
  const [theme, setTheme] = useState<ThemeType>('blue');
  const [hideBalance, setHideBalance] = useState(false);
  const [filterTag, setFilterTag] = useState<FilterTag>('all');
  // 年份区间选择器状态
  const [yearRange, setYearRange] = useState<{ start: number; end: number }>(() => {
    const now = new Date();
    return { start: now.getFullYear() - 4, end: now.getFullYear() };
  });
  // 季度聚合视图状态
  const [quarterlyHistory, setQuarterlyHistory] = useState<QuarterlyNetWorth[]>([]);
  // 是否使用季度聚合视图
  const useQuarterlyView = timeRange === 'all' && monthlyHistory.length > 24;
  // 问题3修复：聚合节点展开状态
  const [expandedAggregate, setExpandedAggregate] = useState<{
    label: string;
    fullLabel: string;
    months: TrendPoint[];
  } | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const themeConfig = THEMES[theme] || THEMES.blue;

  // 格式化金额，支持隐藏显示，金额超过 10 万时以"万"为单位
  const formatBalance = (amount: number): string => {
    if (hideBalance) {
      return '******';
    }
    // 金额超过 10 万时，以"万"为单位显示
    if (Math.abs(amount) >= 100000) {
      return (amount / 10000).toFixed(1) + '万';
    }
    return formatAmountNoSymbol(amount);
  };

  // 获取月度净资产历史（与首页逻辑一致，排除 includeInTotal=false 的账户）
  const getConsistentNetWorthHistory = (months: number): TrendPoint[] => {
    const data = JSON.parse(localStorage.getItem('simple-ledger-data') || '{}');
    const records = data.records || [];

    // 获取当前年月
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentKey = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;

    // 获取所有有记录的月份
    const monthSet = new Set<string>([]);
    records.forEach((r: any) => {
      const recordKey = `${r.year}-${r.month.toString().padStart(2, '0')}`;
      monthSet.add(recordKey);
    });

    // 添加当前月份（标记是否有记录）
    monthSet.add(currentKey);

    // 如果是"全部"模式，添加未来2个月作为占位（待记录）
    if (months === 0) {
      let futureYear = currentYear;
      let futureMonth = currentMonth + 1;
      if (futureMonth > 12) {
        futureMonth = 1;
        futureYear++;
      }
      const futureKey1 = `${futureYear}-${futureMonth.toString().padStart(2, '0')}`;
      monthSet.add(futureKey1);

      futureMonth++;
      if (futureMonth > 12) {
        futureMonth = 1;
        futureYear++;
      }
      const futureKey2 = `${futureYear}-${futureMonth.toString().padStart(2, '0')}`;
      monthSet.add(futureKey2);
    }

    // 重新排序
    const allMonths = Array.from(monthSet).sort();

    // 如果 months > 0，取最近N个月（包括当前月）；否则取全部
    const filteredMonths = months > 0 ? allMonths.slice(-months) : allMonths;

    const history: TrendPoint[] = [];
    const hasRecordSet = new Set(records.map((r: any) => `${r.year}-${r.month.toString().padStart(2, '0')}`));

    for (const monthKey of filteredMonths) {
      const [year, month] = monthKey.split('-').map(Number);
      
      // 检查当月是否有真实记录
      const hasRecord = hasRecordSet.has(monthKey);
      
      let netWorth: number;
      let totalAssets: number;
      let totalLiabilities: number;

      if (hasRecord) {
        // 有记录，使用正常计算
        const accounts = getAccountsForMonth(year, month).filter(a => !a.isHidden);
        totalAssets = calculateTotalAssets(accounts, year, month);
        totalLiabilities = calculateTotalLiabilities(accounts, year, month);
        netWorth = totalAssets - totalLiabilities;
      } else {
        // 无记录，净资产设为 0（表示该月无数据）
        totalAssets = 0;
        totalLiabilities = 0;
        netWorth = 0;
      }

      // 计算上月数据用于对比
      let lastYear = year;
      let lastMonth = month - 1;
      if (lastMonth === 0) {
        lastYear--;
        lastMonth = 12;
      }
      
      // 上月数据：尝试获取上月记录，如果没有则用 0
      const lastMonthKey = `${lastYear}-${lastMonth.toString().padStart(2, '0')}`;
      let lastNetWorth: number;
      if (hasRecordSet.has(lastMonthKey)) {
        const lastMonthAccounts = getAccountsForMonth(lastYear, lastMonth).filter(a => !a.isHidden);
        lastNetWorth = calculateNetWorth(lastMonthAccounts, lastYear, lastMonth);
      } else {
        lastNetWorth = 0;
      }
      
      const change = netWorth - lastNetWorth;
      const changePercent = lastNetWorth !== 0 ? (change / Math.abs(lastNetWorth)) * 100 : 0;

      // 获取归因信息（仅当月有记录时）
      const attribution = hasRecord ? getMonthlyAttribution(year, month) : undefined;
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
        isFiltered: false,
        hasData: hasRecord
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
      const accounts = getAccountsForMonth(year, lastMonth).filter(a => !a.isHidden);
      const totalAssets = calculateTotalAssets(accounts, year, lastMonth);
      const totalLiabilities = calculateTotalLiabilities(accounts, year, lastMonth);
      const netWorth = totalAssets - totalLiabilities;

      // 计算上一年度数据用于对比
      const lastYearAccounts = getAccountsForMonth(year - 1, 12).filter(a => !a.isHidden);
      const lastYearNetWorth = calculateNetWorth(lastYearAccounts, year - 1, 12);
      const change = netWorth - lastYearNetWorth;
      const changePercent = lastYearNetWorth !== 0 ? (change / Math.abs(lastYearNetWorth)) * 100 : 0;

      const yearlyAttr = getYearlyAttribution(year);
      let fluctuationLevel: 'normal' | 'warning' | 'abnormal' = 'normal';
      if (Math.abs(changePercent) > 30) fluctuationLevel = 'abnormal';
      else if (Math.abs(changePercent) > 10) fluctuationLevel = 'warning';

      history.push({
        year,
        netWorth,
        totalAssets,
        totalLiabilities,
        change,
        changePercent,
        hasData: yearRecords.length > 0,
        attribution: yearlyAttr ? {
          tags: yearlyAttr.tags as unknown as AttributionTag[],
          note: yearlyAttr.note,
          fluctuationLevel,
        } : undefined,
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
  }, [timeRange, trendType, yearRange]);

  // 加载月度历史数据
  useEffect(() => {
    const months = timeRange === 'all' ? 0 : parseInt(timeRange);
    setMonthlyHistory(getConsistentNetWorthHistory(months));
  }, [timeRange]);

  // 单独处理年度数据加载
  useEffect(() => {
    const yearlyData = getConsistentYearlyNetWorthHistory();
    const filteredData = yearlyData.filter(y => y.year >= yearRange.start && y.year <= yearRange.end);
    setYearlyHistory(filteredData);
  }, [yearRange]);

  // 计算季度聚合数据（当数据跨度超过24个月时）
  useEffect(() => {
    if (useQuarterlyView && monthlyHistory.length > 0) {
      const quarterlyData = aggregateToQuarter(monthlyHistory);
      setQuarterlyHistory(quarterlyData);
    } else {
      setQuarterlyHistory([]);
    }
  }, [monthlyHistory, useQuarterlyView]);

  // 当前显示的历史数据（根据是否启用季度视图自动切换）
  const history = trendType === 'monthly' 
    ? (useQuarterlyView ? quarterlyHistory as any : monthlyHistory) 
    : yearlyHistory;

  // 根据筛选标签计算是否过滤
  const filteredHistory = useMemo(() => {
    if (filterTag === 'all') return history;

    return history.map((point: TrendPoint | YearlyNetWorth | QuarterlyNetWorth) => {
      const hasAttribution = 'attribution' in point && point.attribution && point.attribution.tags?.length > 0;
      if (!hasAttribution) {
        return { ...point, isFiltered: true };
      }

      let shouldShow = false;
      switch (filterTag) {
        case 'salary':
          shouldShow = point.attribution!.tags.includes('salary') || point.attribution!.tags.includes('salary_income');
          break;
        case 'bonus':
          shouldShow = point.attribution!.tags.includes('bonus') || point.attribution!.tags.includes('year_end_bonus');
          break;
        case 'investment':
          shouldShow = point.attribution!.tags.includes('investment');
          break;
        case 'expense':
          shouldShow = point.attribution!.tags.includes('large_expense');
          break;
        case 'abnormal':
          shouldShow = point.attribution!.fluctuationLevel === 'abnormal';
          break;
        default:
          shouldShow = true;
      }

      return { ...point, isFiltered: !shouldShow };
    });
  }, [history, filterTag, trendType]);

  // 为 Recharts 准备格式化数据（需要在 extremePointsInfo 之前计算）
  const rechartsData = useMemo(() => {
    const validHistory = filteredHistory.filter((h: any) => !h.isFiltered);
    if (validHistory.length === 0) return [];

    if (useQuarterlyView) {
      return (validHistory as QuarterlyNetWorth[]).map((h: QuarterlyNetWorth, index: number) => ({
        label: h.label,
        fullLabel: h.fullLabel,
        netWorth: h.netWorth,
        year: h.year,
        quarter: h.quarter,
        data: h,
        dataKey: `Q-${h.year}-${h.quarter}`,
        _originalMonths: h._originalMonths,
        index,
      }));
    }

    return validHistory.map((h: any, index: number) => {
      const month = 'month' in h ? (h as TrendPoint).month : 0;
      return {
        label: trendType === 'yearly' 
          ? `${h.year}` 
          : `${h.year}-${month.toString().padStart(2, '0')}`,
        fullLabel: trendType === 'yearly'
          ? `${h.year}年`
          : `${h.year}年${month.toString().padStart(2, '0')}月`,
        netWorth: h.netWorth,
        year: h.year,
        month,
        data: h,
        dataKey: `M-${h.year}-${month}`,
        index,
      };
    });
  }, [filteredHistory, trendType, useQuarterlyView]);

  // 计算极值点信息 - 直接从 rechartsData 计算以确保 key 一致
  let extremePointsInfo: {
    maxPoint: any;
    minPoint: any;
    maxKey: string;
    minKey: string;
    maxData: any;
    minData: any;
  } = { maxPoint: null, minPoint: null, maxKey: '', minKey: '', maxData: null, minData: null };

  if (rechartsData.length > 0) {
    const validData = rechartsData.filter((r: any) => r.netWorth !== undefined);
    if (validData.length > 0) {
      const maxData = validData.reduce((max: any, r: any) => r.netWorth > max.netWorth ? r : max, validData[0]);
      const minData = validData.reduce((min: any, r: any) => r.netWorth < min.netWorth ? r : min, validData[0]);
      extremePointsInfo = {
        maxPoint: maxData.data,
        minPoint: minData.data,
        maxKey: maxData.dataKey,
        minKey: minData.dataKey,
        maxData,
        minData,
      };
    }
  }

  // 计算统计数据 - 只计算有效数据点
  const stats = useMemo(() => {
    const validData = filteredHistory.filter((h: any) => !h.isFiltered);

    if (validData.length === 0) return null;
    if (validData.length === 1) {
      return {
        maxNetWorth: validData[0].netWorth,
        minNetWorth: validData[0].netWorth,
        avgNetWorth: validData[0].netWorth,
        totalChange: 0,
        totalChangePercent: 0,
        hasOnlyOneValidPoint: true
      };
    }

    const netWorths = validData.map((h: any) => h.netWorth);
    const maxNetWorth = Math.max(...netWorths);
    const minNetWorth = Math.min(...netWorths);
    const avgNetWorth = netWorths.reduce((a: number, b: number) => a + b, 0) / netWorths.length;

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
      hasOnlyOneValidPoint: false
    };
  }, [filteredHistory]);

  // 获取高低点图例信息
  const getAbnormalLegend = () => {
    const validData = filteredHistory.filter((h: any) => !h.isFiltered);
    if (validData.length <= 1) return null;

    const maxPoint = validData.reduce((max: any, p: any) => p.netWorth > max.netWorth ? p : max, validData[0]);
    const minPoint = validData.reduce((min: any, p: any) => p.netWorth < min.netWorth ? p : min, validData[0]);

    const allYears = new Set(validData.map((p: any) => p.year));
    const showYearInLabel = allYears.size > 1;

    const isYearlyTrend = 'netWorth' in validData[0] && !('month' in validData[0]) && !('quarter' in validData[0]);
    const isQuarterly = 'quarter' in maxPoint;

    const maxLabel = isQuarterly 
      ? `第${maxPoint.quarter}季度` 
      : ('month' in maxPoint ? `${maxPoint.month}月` : (isYearlyTrend ? '' : '1月'));
    const minLabel = isQuarterly 
      ? `第${minPoint.quarter}季度` 
      : ('month' in minPoint ? `${minPoint.month}月` : (isYearlyTrend ? '' : '1月'));

    return {
      maxPoint: { year: maxPoint.year, label: maxLabel, netWorth: maxPoint.netWorth, showYear: showYearInLabel || isYearlyTrend || isQuarterly },
      minPoint: { year: minPoint.year, label: minLabel, netWorth: minPoint.netWorth, showYear: showYearInLabel || isYearlyTrend || isQuarterly },
      hasBoth: maxPoint !== minPoint,
      themeColor: themeConfig.primary,
      lowPointColor: LOW_POINT_COLOR,
    };
  };

  const abnormalLegend = getAbnormalLegend();

  return (
    <div className="pb-6 bg-gray-50 min-h-screen overflow-x-hidden">
      {/* 标题栏 */}
      <header className="bg-white px-4 py-3 flex justify-between items-center fixed top-0 left-0 right-0 z-50 max-w-md mx-auto shadow-sm">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => onPageChange('home')}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-lg font-semibold">资产趋势</h1>
        </div>
      </header>

      {/* 占位元素 */}
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

          {/* 时间范围选择（月度趋势）/ 年份区间选择（年度趋势） */}
          {trendType === 'monthly' ? (
            <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)} className="flex-1">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="6">近6月</TabsTrigger>
                <TabsTrigger value="12">近1年</TabsTrigger>
                <TabsTrigger value="all">全部</TabsTrigger>
              </TabsList>
            </Tabs>
          ) : (
            <div className="flex items-center gap-2 px-2">
              <span className="text-sm text-gray-600">年份区间:</span>
              <input
                type="number"
                value={yearRange.start}
                onChange={(e) => setYearRange({ ...yearRange, start: parseInt(e.target.value) || 2020 })}
                className="w-20 px-2 py-1 border rounded text-sm"
                min="2000"
                max="2100"
              />
              <span>-</span>
              <input
                type="number"
                value={yearRange.end}
                onChange={(e) => setYearRange({ ...yearRange, end: parseInt(e.target.value) || 2025 })}
                className="w-20 px-2 py-1 border rounded text-sm"
                min="2000"
                max="2100"
              />
            </div>
          )}
        </div>

        {/* 筛选栏（月度趋势和年度趋势都显示） */}
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

        {filteredHistory.filter((h: any) => !h.isFiltered).length === 0 ? (
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
            {/* 折线图 - Recharts 版 */}
            <Card className="bg-white shadow-sm">
              <CardContent className="p-4">
                {/* 图表区域 */}
                {rechartsData.length > 0 ? (
                  <div className="relative h-48" ref={chartRef}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart 
                        data={rechartsData}
                        margin={{ top: 25, right: 10, left: 0, bottom: 0 }}
                        onClick={(data) => {
                          if (data && data.activePayload && data.activePayload[0] && data.activePayload[0].payload) {
                            const payload = data.activePayload[0].payload;
                            if (useQuarterlyView && payload._originalMonths && payload._originalMonths.length > 0) {
                              setExpandedAggregate({
                                label: payload.label,
                                fullLabel: payload.fullLabel,
                                months: payload._originalMonths,
                              });
                            } else if (payload.data) {
                              setSelectedData(payload.data);
                            }
                          }
                        }}
                      >
                        <defs>
                          <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={themeConfig.primary} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={themeConfig.primary} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis 
                          dataKey="label" 
                          tick={{ fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                          allowDataOverflow={true}
                          interval={rechartsData.length > 16 ? 2 : rechartsData.length > 8 ? 1 : 0}
                          tickFormatter={(value) => {
                            if (trendType === 'yearly') return value;
                            const item = rechartsData.find(d => d.label === value);
                            if (!item) return value;
                            if (useQuarterlyView) {
                              if (item.quarter === 1) return `${item.year}年`;
                              return value;
                            }
                            if (item.month === 1) return `${item.year}年`;
                            return value.split('-')[1] + '月';
                          }}
                        />
                        <YAxis 
                          tick={{ fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v) => {
                            if (Math.abs(v) >= 10000) return (v / 10000).toFixed(1) + 'w';
                            return v.toString();
                          }}
                          width={40}
                        />
                        <Tooltip
                          formatter={(value: number) => [`¥${formatBalance(value)}`, '净资产']}
                          labelFormatter={(label, payload) => {
                            if (payload && payload[0] && payload[0].payload) {
                              return payload[0].payload.fullLabel || label;
                            }
                            return label;
                          }}
                          contentStyle={{ fontSize: 12, borderRadius: 8 }}
                          content={({ active, payload }) => {
                            if (!active || !payload || !payload[0]) return null;
                            const data = payload[0].payload;
                            const isQuarterly = data._originalMonths && data._originalMonths.length > 0;
                            return (
                              <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200 text-xs">
                                <div className="font-medium text-gray-900 mb-1">{data.fullLabel}</div>
                                <div className="text-gray-500">
                                  净资产: <span className="text-gray-900 font-semibold">¥{formatBalance(data.netWorth)}</span>
                                </div>
                                {isQuarterly && data._originalMonths.length > 0 && (
                                  <div className="pt-2 border-t border-gray-100 mt-2">
                                    <div className="text-gray-500 mb-1.5">🔍 本季度月度余额明细：</div>
                                    {data._originalMonths.map((m: any, idx: number) => (
                                      <div key={idx} className="flex justify-between py-0.5 text-gray-600">
                                        <span>{m.year}年{m.month.toString().padStart(2, '0')}月</span>
                                        <span className="font-medium">¥{formatBalance(m.netWorth)}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {!isQuarterly && data.data.attribution && data.data.attribution.tags && data.data.attribution.tags.length > 0 && (
                                  <div className="text-gray-400 mt-1 flex gap-1">
                                    {data.data.attribution.tags.slice(0, 2).map((tag: AttributionTag, i: number) => (
                                      <span key={i}>{getAttributionTagEmoji(tag)}{getAttributionTagLabel(tag)}</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          }}
                          cursor={{ stroke: themeConfig.primary, strokeWidth: 1, strokeDasharray: '4 4' }}
                        />
                        {/* 年度分割线 */}
                        {rechartsData.map((item: any, index: number) => {
                          if (index > 0) {
                            if (trendType === 'monthly' && !useQuarterlyView && item.month === 1) {
                              return (
                                <ReferenceLine
                                  key={`boundary-${item.year}`}
                                  x={item.label}
                                  stroke="#9ca3af"
                                  strokeWidth={1}
                                  ifOverflow="extendDomain"
                                />
                              );
                            }
                            if (useQuarterlyView && item.quarter === 1) {
                              return (
                                <ReferenceLine
                                  key={`boundary-${item.year}-Q${item.quarter}`}
                                  x={item.label}
                                  stroke="#9ca3af"
                                  strokeWidth={1}
                                  ifOverflow="extendDomain"
                                />
                              );
                            }
                          }
                          return null;
                        })}
                        {/* 极值点标记 - 使用自定义动画组件 */}
                        {extremePointsInfo.maxData && rechartsData.length > 0 && (
                          <ReferenceDot
                            x={extremePointsInfo.maxData.label}
                            y={extremePointsInfo.maxData.netWorth}
                            shape={(props: any) => (
                              <AnimatedPulseDot
                                cx={props.cx}
                                cy={props.cy}
                                r={8}
                                fill={themeConfig.primary}
                                stroke={themeConfig.primary}
                                strokeWidth={1}
                                isMin={false}
                              />
                            )}
                          />
                        )}
                        {extremePointsInfo.minData && extremePointsInfo.maxData !== extremePointsInfo.minData && rechartsData.length > 0 && (
                          <ReferenceDot
                            x={extremePointsInfo.minData.label}
                            y={extremePointsInfo.minData.netWorth}
                            shape={(props: any) => (
                              <AnimatedPulseDot
                                cx={props.cx}
                                cy={props.cy}
                                r={8}
                                fill={LOW_POINT_COLOR}
                                stroke={LOW_POINT_COLOR}
                                strokeWidth={1}
                                isMin={true}
                              />
                            )}
                          />
                        )}
                        <Area
                          type="monotone"
                          dataKey="netWorth"
                          stroke={themeConfig.primary}
                          fill="url(#netWorthGradient)"
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 6, fill: themeConfig.primary, stroke: '#fff', strokeWidth: 2 }}
                          style={{ cursor: 'pointer' }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-48 flex items-center justify-center text-gray-400">
                    暂无数据
                  </div>
                )}

                <p className="text-center text-xs text-gray-400 mt-3 whitespace-nowrap">
                  点击节点查看详情，悬停查看预览
                </p>

                {/* 图例说明 - 高低点标注 */}
                {abnormalLegend && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-center gap-4 sm:gap-6">
                      {abnormalLegend.maxPoint && (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm"
                              style={{ backgroundColor: abnormalLegend.themeColor }}
                            ></span>
                            <span className="text-xs font-medium text-gray-600">最高点</span>
                          </div>
                          <span className="text-xs text-gray-500 whitespace-nowrap">
                            {abnormalLegend.maxPoint.showYear ? `${abnormalLegend.maxPoint.year}年` : ''}{abnormalLegend.maxPoint.label}
                          </span>
                        </div>
                      )}
                      {abnormalLegend.hasBoth && abnormalLegend.minPoint && (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm animate-pulse"
                              style={{ backgroundColor: abnormalLegend.lowPointColor }}
                            ></span>
                            <span className="text-xs font-medium text-gray-600">最低点</span>
                          </div>
                          <span className="text-xs text-gray-500 whitespace-nowrap">
                            {abnormalLegend.minPoint.showYear ? `${abnormalLegend.minPoint.year}年` : ''}{abnormalLegend.minPoint.label}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 数据摘要 */}
            {stats && !stats.hasOnlyOneValidPoint && (
              <div className="grid grid-cols-2 gap-3">
                <Card className="bg-white shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                        <TrendingUp size={16} className="text-green-500" />
                      </div>
                      <span className="text-xs text-gray-500">最高净资产</span>
                    </div>
                    <div className="text-lg font-semibold mt-1">{formatBalance(stats.maxNetWorth)}</div>
                  </CardContent>
                </Card>
                <Card className="bg-white shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                        <TrendingDown size={16} className="text-red-500" />
                      </div>
                      <span className="text-xs text-gray-500">最低净资产</span>
                    </div>
                    <div className="text-lg font-semibold mt-1">{formatBalance(stats.minNetWorth)}</div>
                  </CardContent>
                </Card>
                <Card className="bg-white shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                        <Calendar size={16} className="text-blue-500" />
                      </div>
                      <span className="text-xs text-gray-500">平均净资产</span>
                    </div>
                    <div className="text-lg font-semibold mt-1">{formatBalance(stats.avgNetWorth)}</div>
                  </CardContent>
                </Card>
                <Card className="bg-white shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${stats.totalChange >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                        {stats.totalChange >= 0 ? (
                          <TrendingUp size={16} className="text-green-500" />
                        ) : (
                          <TrendingDown size={16} className="text-red-500" />
                        )}
                      </div>
                      <span className="text-xs text-gray-500">总变化</span>
                    </div>
                    <div className={`text-lg font-semibold mt-1 ${stats.totalChange >= 0 ? 'text-green-600' : 'text-red-500'}`}>
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
      <Dialog open={!!selectedData && !('_originalMonths' in (selectedData ?? {}))} onOpenChange={() => setSelectedData(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-0">
            <DialogTitle className="text-base font-bold">
              {selectedData && (
                'month' in selectedData
                  ? `${selectedData.year}年${String(selectedData.month).padStart(2, '0')}月`
                  : `${(selectedData as any).year}年`
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedData && (
            <div className="px-5 pb-5 pt-4 space-y-3">

              <div
                className="px-5 py-4 rounded-xl text-white text-center"
                style={{
                  background: `linear-gradient(135deg, ${themeConfig.gradientFrom} 0%, ${themeConfig.gradientTo} 100%)`,
                }}
              >
                <div className="text-white/80 text-xs mb-1">净资产</div>
                <div className="text-3xl font-bold tracking-tight">
                  ¥{formatBalance(selectedData.netWorth)}
                </div>
                {'change' in selectedData && (selectedData as any).change !== 0 && (
                  <div className={`text-sm font-medium mt-1.5 ${
                    (selectedData as any).change >= 0 ? 'text-white' : 'text-red-200'
                  }`}>
                    {(selectedData as any).change >= 0 ? '+' : ''}
                    ¥{formatBalance(Math.abs((selectedData as any).change))}
                    <span className="text-white/70 text-xs ml-1.5">
                      ({hideBalance ? '******' : `${(selectedData as any).changePercent >= 0 ? '+' : ''}${(selectedData as any).changePercent.toFixed(1)}%`})
                    </span>
                  </div>
                )}
              </div>

              {'attribution' in selectedData && selectedData.attribution ? (
                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">变化归因</span>
                    <button
                      onClick={() => {
                        const d = selectedData as TrendPoint;
                        onPageChange('record', {
                          year: d.year,
                          month: d.month,
                          mode: 'monthly',
                          openAttributionEdit: true,
                        });
                        setSelectedData(null);
                      }}
                      className="text-xs font-medium px-2.5 py-1 rounded-full border transition-colors"
                      style={{
                        borderColor: `${themeConfig.primary}50`,
                        color: themeConfig.primary,
                        backgroundColor: `${themeConfig.primary}08`,
                      }}
                    >
                      编辑归因
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {selectedData.attribution.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium"
                        style={{
                          backgroundColor: `${themeConfig.primary}15`,
                          color: themeConfig.primary,
                        }}
                      >
                        {getAttributionTagEmoji(tag)}
                        {getAttributionTagLabel(tag)}
                      </span>
                    ))}
                  </div>

                  {selectedData.attribution.note && (
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {selectedData.attribution.note}
                    </p>
                  )}
                </div>
              ) : (
                <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={16} className="text-orange-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-orange-700 mb-0.5">
                        {'month' in selectedData ? '本月' : '本年'}未记录变化原因
                      </div>
                      <p className="text-xs text-orange-500">
                        补充归因有助于后续回顾分析资产变化
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      const isMonthly = 'month' in selectedData;
                      onPageChange('record', {
                        year: (selectedData as any).year,
                        ...(isMonthly ? { month: (selectedData as TrendPoint).month } : {}),
                        mode: isMonthly ? 'monthly' : 'yearly',
                        openAttributionEdit: true,
                      });
                      setSelectedData(null);
                    }}
                    className="mt-3 w-full text-sm font-semibold py-2.5 rounded-lg text-white transition-opacity hover:opacity-90"
                    style={{
                      background: `linear-gradient(135deg, ${themeConfig.gradientFrom} 0%, ${themeConfig.gradientTo} 100%)`,
                    }}
                  >
                    + 补充归因
                  </button>
                </div>
              )}

            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!selectedData && '_originalMonths' in selectedData} onOpenChange={() => setSelectedData(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-0">
            <DialogTitle className="text-base font-bold">
              {(selectedData as any)?.fullLabel || '季度详情'}
            </DialogTitle>
          </DialogHeader>

          {selectedData && '_originalMonths' in selectedData && (
            <>
              <div
                className="mx-5 mt-4 mb-1 px-5 py-4 rounded-xl text-white text-center"
                style={{
                  background: `linear-gradient(135deg, ${themeConfig.gradientFrom} 0%, ${themeConfig.gradientTo} 100%)`,
                }}
              >
                <div className="text-white/80 text-xs mb-1">季度末净资产</div>
                <div className="text-3xl font-bold tracking-tight">
                  ¥{formatBalance(selectedData.netWorth)}
                </div>
              </div>

              <div className="px-5 pb-5">
                <div className="flex items-center gap-2 mb-3 text-sm text-gray-700">
                  <span className="text-base">🔍</span>
                  <span className="font-medium">本季度月度余额明细</span>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-0">
                  {(selectedData as any)._originalMonths
                    .slice()
                    .sort((a: any, b: any) => a.year !== b.year ? a.year - b.year : a.month - b.month)
                    .map((month: any, idx: number, arr: any[]) => (
                      <MonthRow
                        key={idx}
                        month={month}
                        themeColor={themeConfig.primary}
                        formatBalance={formatBalance}
                        showDivider={idx < arr.length - 1}
                        onView={() => {
                          onPageChange('record-logs', { year: month.year, month: month.month, mode: 'monthly' });
                          setSelectedData(null);
                        }}
                        onAddAttribution={() => {
                          onPageChange('record', { year: month.year, month: month.month, mode: 'monthly', openAttributionEdit: true });
                          setSelectedData(null);
                        }}
                      />
                    ))}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

{/* 季度聚合节点展开弹窗 */}
      <Dialog open={!!expandedAggregate} onOpenChange={() => setExpandedAggregate(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-0">
            <DialogTitle className="text-base font-bold">
              {expandedAggregate?.fullLabel}
            </DialogTitle>
          </DialogHeader>

          {expandedAggregate && (
            <>
              <div
                className="mx-5 mt-4 mb-1 px-5 py-4 rounded-xl text-white text-center"
                style={{
                  background: `linear-gradient(135deg, ${themeConfig.gradientFrom} 0%, ${themeConfig.gradientTo} 100%)`,
                }}
              >
                <div className="text-white/80 text-xs mb-1">季度末净资产</div>
                <div className="text-3xl font-bold tracking-tight">
                  ¥{formatBalance(
                    expandedAggregate.months[expandedAggregate.months.length - 1]?.netWorth || 0
                  )}
                </div>
              </div>

              <div className="px-5 pb-5">
                <div className="flex items-center gap-2 mb-3 text-sm text-gray-700">
                  <span className="text-base">🔍</span>
                  <span className="font-medium">本季度月度余额明细</span>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-0">
                  {expandedAggregate.months
                    .slice()
                    .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month)
                    .map((month, idx, arr) => (
                      <MonthRow
                        key={idx}
                        month={month}
                        themeColor={themeConfig.primary}
                        formatBalance={formatBalance}
                        showDivider={idx < arr.length - 1}
                        onView={() => {
                          onPageChange('record-logs', { year: month.year, month: month.month, mode: 'monthly' });
                          setExpandedAggregate(null);
                        }}
                        onAddAttribution={() => {
                          onPageChange('record', { year: month.year, month: month.month, mode: 'monthly', openAttributionEdit: true });
                          setExpandedAggregate(null);
                        }}
                      />
                    ))}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
