import { useState, useEffect, useMemo, useRef } from 'react';
import { ArrowLeft, TrendingUp, TrendingDown, Calendar, ChevronDown, Edit3, AlertTriangle } from 'lucide-react';
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

// 用于选中和悬停数据的联合类型
type TrendData = TrendPoint | YearlyNetWorth;

// 低谷点详细信息接口
interface LowPointInfo {
  year: number;
  month: number;
  netWorth: number;
}

// 问题1修复：定义淡红色用于最低谷标注
const LOW_POINT_COLOR = '#f87171'; // 淡红色
// const LOW_POINT_BG_COLOR = "#fef2f2"; // eslint-disable-line @typescript-eslint/no-unused-vars

export function TrendPage({ onPageChange }: TrendPageProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('12');
  const [trendType, setTrendType] = useState<TrendType>('monthly');
  const [showTrendDropdown, setShowTrendDropdown] = useState(false);
  const [monthlyHistory, setMonthlyHistory] = useState<TrendPoint[]>([]);
  const [yearlyHistory, setYearlyHistory] = useState<YearlyNetWorth[]>([]);
  const [selectedData, setSelectedData] = useState<TrendData | null>(null);
  const [theme, setTheme] = useState<ThemeType>('blue');
  const [hideBalance, setHideBalance] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; data: TrendData; index: number } | null>(null);
  const [filterTag, setFilterTag] = useState<FilterTag>('all');
  const [expandedSnapshots, setExpandedSnapshots] = useState(false);
  // 问题3修复：聚合节点展开状态
  const [expandedAggregate, setExpandedAggregate] = useState<{
    label: string;
    months: { year: number; month: number; netWorth: number }[];
  } | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const themeConfig = THEMES[theme] || THEMES.blue;

  // 格式化金额，支持隐藏显示
  const formatBalance = (amount: number): string => {
    if (hideBalance) {
      return '******';
    }
    return formatAmountNoSymbol(amount);
  };

  // 获取节点样式 - 默认不显示，悬停/选中时显示小圆点（缩小约一半）
  const getNodeStyle = (changePercent: number, isFiltered: boolean): {
    size: number;
    color: string;
    pulse: boolean;
    strokeWidth: number;
  } => {
    const absPercent = Math.abs(changePercent);

    if (!isFiltered && filterTag !== 'all') {
      // 非目标月份：不显示
      return {
        size: 0,
        color: '#d1d5db',
        pulse: false,
        strokeWidth: 0
      };
    }

    if (absPercent > 30) {
      // 异常波动：1.5px小圆点 + 轻微扩散脉冲动画
      return {
        size: 1.5,
        color: themeConfig.primary,
        pulse: true,
        strokeWidth: 0.5
      };
    } else if (absPercent > 10) {
      // 警告波动：1px超精致小圆点
      return {
        size: 1,
        color: themeConfig.primary,
        pulse: false,
        strokeWidth: 0.3
      };
    } else {
      // 正常波动：悬停时显示1px小圆点
      return {
        size: 1,
        color: themeConfig.primary,
        pulse: false,
        strokeWidth: 0.2
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

  // 计算统计数据 - 只计算有效数据点
  const stats = useMemo(() => {
    // Bug 2修复：只使用有效数据点计算统计数据
    const validData = filteredHistory.filter(h => !h.isFiltered);

    if (validData.length === 0) return null;
    if (validData.length === 1) {
      // Bug 2修复：只有1个有效节点时，不显示高低谷
      return {
        maxNetWorth: validData[0].netWorth,
        minNetWorth: validData[0].netWorth,
        avgNetWorth: validData[0].netWorth,
        totalChange: 0,
        totalChangePercent: 0,
        hasOnlyOneValidPoint: true
      };
    }

    const netWorths = validData.map(h => h.netWorth);
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
      hasOnlyOneValidPoint: false
    };
  }, [filteredHistory]);
  // 问题1修复：计算极值点信息（使用filteredHistory）
  const extremePointsInfo = useMemo(() => {
    const validData = filteredHistory.filter(h => !h.isFiltered);
    if (validData.length === 0) return { maxPoint: null as TrendData | null, minPoint: null as TrendData | null };

    const maxPoint = validData.reduce((max, p) => p.netWorth > max.netWorth ? p : max, validData[0]);
    const minPoint = validData.reduce((min, p) => p.netWorth < min.netWorth ? p : min, validData[0]);

    return { maxPoint, minPoint };
  }, [filteredHistory]);

  // 检查是否为最高/最低净资产点（问题1修复：使用extremePointsInfo判断）
  const isExtremePoint = (point: TrendData): { isMax: boolean; isMin: boolean } => {
    if (!('netWorth' in point)) return { isMax: false, isMin: false };
    // 只判断是否是全局最高点和全局最低点
    return {
      isMax: extremePointsInfo.maxPoint !== null && point.netWorth === extremePointsInfo.maxPoint.netWorth,
      isMin: extremePointsInfo.minPoint !== null && point.netWorth === extremePointsInfo.minPoint.netWorth
    };
  };


  // 计算图表数据 - 优化为更平滑的曲线和年份感知
  const chartData = useMemo(() => {
    const validHistory = filteredHistory.filter(h => !h.isFiltered);
    if (validHistory.length === 0) return null;

    const netWorths = validHistory.map(h => h.netWorth);
    const max = Math.max(...netWorths, 0);
    const min = Math.min(...netWorths, 0);

    // 增加上下边距，让曲线不贴边
    const padding = (max - min) * 0.12 || max * 0.12 || 1000;
    const chartMax = max + padding;
    const chartMin = Math.max(0, min - padding);
    const range = chartMax - chartMin || 1;

    // 计算坐标点 - 使用所有数据点（包括过滤的，用于保持时间连续性）
    const points = filteredHistory.map((h, index) => {
      const validIndex = filteredHistory.slice(0, index + 1).filter(p => !p.isFiltered).length - 1;
      const validLength = validHistory.length;
      const x = validLength > 1 ? (validIndex / (validLength - 1)) * 100 : 50;
      const y = 100 - ((h.netWorth - chartMin) / range) * 80 - 10; // 10-90 的范围，留出边距
      return { x, y, data: h, index };
    });

    // 生成平滑的 SVG 路径
    const validPoints = points.filter(p => !p.data.isFiltered);

    // 生成平滑曲线 - 使用 Catmull-Rom 样条
    const generateSmoothPath = (points: typeof validPoints) => {
      if (points.length === 0) return '';
      if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

      let path = `M ${points[0].x} ${points[0].y}`;

      for (let i = 0; i < points.length - 1; i++) {
        const curr = points[i];
        const next = points[i + 1];

        // 计算控制点，使曲线更平滑
        const tension = 0.35;
        const cp1x = curr.x + (next.x - curr.x) * tension;
        const cp1y = curr.y;
        const cp2x = next.x - (next.x - curr.x) * tension;
        const cp2y = next.y;

        path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`;
      }

      return path;
    };

    const pathD = generateSmoothPath(validPoints);

    // 生成填充区域路径 - 添加渐变填充
    const fillD = validPoints.length > 0
      ? pathD + ` L ${validPoints[validPoints.length - 1].x} 100 L ${validPoints[0].x} 100 Z`
      : '';

    // 计算年份分割线位置
    const yearBoundaries: { x: number; year: number }[] = [];
    if (trendType === 'monthly') {
      let lastYear = -1;
      validPoints.forEach((point, _index) => {
        const data = point.data as TrendPoint;
        if (data.year !== lastYear) {
          yearBoundaries.push({ x: point.x, year: data.year });
          lastYear = data.year;
        }
      });
    }

    return { points, pathD, fillD, max: chartMax, min: chartMin, range, validPoints, yearBoundaries };
  }, [filteredHistory, trendType]);

  // 智能金额格式化
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

  // 计算Y轴刻度
  const yAxisConfig = useMemo(() => {
    if (!chartData) return { ticks: [], unit: '元' };

    const validNetWorths = chartData.validPoints.map(p => p.data.netWorth);
    if (validNetWorths.length === 0) return { ticks: [], unit: '元' };

    const max = Math.max(...validNetWorths, 0);
    const min = Math.min(...validNetWorths, 0);
    const range = max - min;
    const tickCount = 5;

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

  // 生成X轴标签 - 年份感知优化 + 问题3修复：全部维度动态聚合
  // 问题3修复：当数据>12个月时，按季度/半年度聚合展示
  const xAxisLabels = useMemo(() => {
    if (!chartData) return [];

    const validPoints = chartData.validPoints;
    if (validPoints.length === 0) return [];

    const labels: {
      x: number;
      label: string;
      isYear: boolean;
      isBoundary?: boolean;
      isAggregated?: boolean;
      aggregatedMonths?: { year: number; month: number; netWorth: number }[];
      aggregatedLabel?: string;
    }[] = [];

    if (trendType === 'yearly') {
      // 年度趋势：显示所有年份
      validPoints.forEach((point, _index) => {
        labels.push({
          x: point.x,
          label: `${point.data.year}`,
          isYear: true
        });
      });
    } else {
      // 月度趋势：智能显示标签，带年份感知
      const totalPoints = validPoints.length;
      let lastYear = -1;

      // 问题3修复：动态聚合规则
      // 如果是"全部"维度且数据>12个月，使用聚合展示
      const shouldAggregate = timeRange === 'all' && totalPoints > 12;

      if (shouldAggregate) {
        // 聚合模式：按季度或半年度聚合
        const quarterMap: Record<string, { points: typeof validPoints; label: string }> = {};

        validPoints.forEach((point, _index) => {
          const data = point.data as TrendPoint;
          // 确定聚合标识（季度 Q1-Q4 或半年 H1/H2）
          let aggKey: string;
          let aggLabel: string;

          if (totalPoints > 36) {
            // 数据超过3年：按半年度聚合 (H1/H2)
            const halfYear = data.month <= 6 ? 'H1' : 'H2';
            aggKey = `${data.year}-${halfYear}`;
            aggLabel = `${data.year}年${halfYear === 'H1' ? '上半年' : '下半年'}`;
          } else {
            // 数据在1-3年：按季度聚合
            const quarter = Math.ceil(data.month / 3);
            aggKey = `${data.year}-Q${quarter}`;
            aggLabel = `${data.year}Q${quarter}`;
          }

          if (!quarterMap[aggKey]) {
            quarterMap[aggKey] = { points: [], label: aggLabel };
          }
          quarterMap[aggKey].points.push(point);
        });

        // 生成聚合标签
        const sortedKeys = Object.keys(quarterMap).sort();
        // const aggCount = sortedKeys.length; // eslint-disable-line @typescript-eslint/no-unused-vars // 聚合数量 - 保留供将来使用

        sortedKeys.forEach((key) => {
          const aggData = quarterMap[key];
          // 使用聚合组第一个点的x坐标（居中）
          const firstPoint = aggData.points[0];
          const lastPoint = aggData.points[aggData.points.length - 1];
          const centerX = (firstPoint.x + lastPoint.x) / 2;

          labels.push({
            x: centerX,
            label: aggData.label,
            isYear: true,
            isBoundary: true,
            isAggregated: true,
            aggregatedMonths: aggData.points.map(p => ({
              year: (p.data as TrendPoint).year,
              month: (p.data as TrendPoint).month,
              netWorth: p.data.netWorth
            })),
            aggregatedLabel: aggData.label
          });
        });
      } else {
        // 非聚合模式：原有逻辑
        validPoints.forEach((point, index) => {
          const data = point.data as TrendPoint;
          const isFirst = index === 0;
          const isLast = index === totalPoints - 1;
          const isYearBoundary = data.year !== lastYear;

          // 常规月份标签显示策略
          let shouldShowMonth = false;
          if (totalPoints <= 8) {
            shouldShowMonth = true;
          } else if (totalPoints <= 16) {
            shouldShowMonth = index % 2 === 0 || isFirst || isLast;
          } else {
            shouldShowMonth = index % 3 === 0 || isFirst || isLast;
          }

          // 年份边界：显示年份 + 月份组合（如"1月 2026"），避免月份被吞掉
          if (isYearBoundary && !isFirst) {
            if (data.month === 1) {
              // 1月：显示"1月 2026"，年份单独放上方
              labels.push({
                x: point.x,
                label: `${data.month}月`,
                isYear: false,
                isBoundary: true
              });
              // 在更上方单独添加年份标签
              labels.push({
                x: point.x,
                label: `${data.year}`,
                isYear: true,
                isBoundary: true
              });
            } else {
              // 其他跨年月份：正常显示月份，年份在下方
              labels.push({
                x: point.x,
                label: `${data.month}月`,
                isYear: false,
                isBoundary: true
              });
            }
          } else if (shouldShowMonth) {
            // 常规月份标签显示
            labels.push({
              x: point.x,
              label: `${data.month}月`,
              isYear: false
            });
          }

          lastYear = data.year;
        });
      }
    }

    return labels;
  }, [chartData, trendType, timeRange]);

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
    if (!selectedData || !('month' in selectedData)) return [];
    return getAccountSnapshotsByMonth(selectedData.year, selectedData.month);
  };

  // Bug 1 & Bug 2 修复：获取异常点说明 - 修正低谷识别逻辑
  // 问题1修复：确保只识别全局最高和全局最低点
  // 问题2修复：统一格式，确保低谷也显示完整金额
  const getAbnormalLegend = () => {
    // Bug 2修复：只遍历有效数据点，排除isFiltered的节点
    const validData = filteredHistory.filter(h => !h.isFiltered);

    // Bug 2修复：兜底逻辑 - 若所有节点数据为空或只有1个，隐藏标注
    if (validData.length <= 1) return null;

    // Bug 2修复：重新计算有效节点的净资产值，精准识别实际最低值
    const maxPoint = validData.reduce((max, p) => p.netWorth > max.netWorth ? p : max, validData[0]);
    const minPoint = validData.reduce((min, p) => p.netWorth < min.netWorth ? p : min, validData[0]);

    // Bug 2修复：确保minPoint有有效的month属性（月度趋势）
    if (!('month' in minPoint)) return null;

    // Bug 1修复：检查是否需要显示年份（同年度数据可简化）
    const allYears = new Set(validData.map(p => p.year));
    const showYearInLabel = allYears.size > 1;

    // Bug 1修复：返回包含完整年月信息的高低谷数据
    // 问题2修复：统一格式 - 最高点: {年份}年{月份}月 ¥{金额}
    const maxPointInfo: LowPointInfo & { showYear: boolean } = {
      year: maxPoint.year,
      month: ('month' in maxPoint) ? (maxPoint as TrendPoint).month : 1,
      netWorth: maxPoint.netWorth,
      showYear: showYearInLabel
    };

    const minPointInfo: LowPointInfo & { showYear: boolean } = {
      year: minPoint.year,
      month: ('month' in minPoint) ? (minPoint as TrendPoint).month : 1,
      netWorth: minPoint.netWorth,
      showYear: showYearInLabel
    };
    return {
      maxPoint: maxPointInfo,
      minPoint: minPointInfo,
      hasBoth: maxPoint !== minPoint,
      // Bug 3修复：统一使用主题色
      themeColor: themeConfig.primary,
      // 问题1修复：最低谷使用淡红色
      lowPointColor: LOW_POINT_COLOR
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

          {/* 时间范围选择（仅月度趋势显示） */}
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
            {/* 折线图 - 视觉优化版 */}
            <Card className="bg-white shadow-sm">
              <CardContent className="p-4">
                <div className="relative h-64 w-full" ref={chartRef}>
                  {/* Y轴标签 */}
                  <div className="absolute left-0 top-2 bottom-12 w-12 flex flex-col justify-between text-xs text-gray-400 text-right pr-2">
                    {yAxisConfig.ticks.map((tick, index) => (
                      <span key={index}>{tick.label}</span>
                    ))}
                  </div>

                  {/* 图表区域 */}
                  <div className="absolute left-12 right-2 top-2 bottom-12">
                    {/* 网格线背景 */}
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                      {yAxisConfig.ticks.map((_, index) => (
                        <div key={index} className="w-full h-px bg-gray-100" />
                      ))}
                    </div>

                    {/* 年份分割线（仅月度趋势） */}
                    {trendType === 'monthly' && chartData?.yearBoundaries.map((boundary, index) => (
                      index > 0 && (
                        <div
                          key={boundary.year}
                          className="absolute top-0 bottom-0 w-px bg-gray-200 border-l border-dashed border-gray-300 pointer-events-none"
                          style={{ left: `${boundary.x}%` }}
                        >
                          <span className="absolute -top-1 left-1 text-[10px] text-gray-400 font-medium">
                            {boundary.year}
                          </span>
                        </div>
                      )
                    ))}

                    <svg
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                      className="w-full h-full relative z-10"
                      onMouseLeave={() => setHoveredPoint(null)}
                    >
                      {/* 渐变定义 */}
                      <defs>
                        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={themeConfig.primary} stopOpacity="0.25" />
                          <stop offset="60%" stopColor={themeConfig.primary} stopOpacity="0.05" />
                          <stop offset="100%" stopColor={themeConfig.primary} stopOpacity="0" />
                        </linearGradient>
                        <linearGradient id="lineGradient" x1="0" y1="0" x2="100" y2="0">
                          <stop offset="0%" stopColor={themeConfig.primary} />
                          <stop offset="100%" stopColor={themeConfig.primary} />
                        </linearGradient>

                        {/* 脉冲动画定义 - 精致的小点扩散效果 */}
                        <style>{`
                          @keyframes pulse-dot {
                            0% { r: 2; opacity: 1; }
                            50% { r: 4; opacity: 0.6; }
                            100% { r: 2; opacity: 1; }
                          }
                          .pulse-dot {
                            animation: pulse-dot 2s ease-in-out infinite;
                          }
                        `}</style>
                      </defs>

                      {/* 填充区域 - 面积图效果 */}
                      {chartData?.fillD && (
                        <path d={chartData.fillD} fill="url(#areaGradient)" />
                      )}

                      {/* 折线 - 2px粗细，圆角端点 */}
                      {chartData?.pathD && (
                        <path
                          d={chartData.pathD}
                          fill="none"
                          stroke="url(#lineGradient)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="drop-shadow-sm"
                        />
                      )}

                      {/* 数据点 - 默认不显示，悬停/选中时显示 */}
                      {chartData?.points.map((point, index) => {
                        const nodeStyle = getNodeStyle(point.data.changePercent, point.data.isFiltered || false);
                        const isValidPoint = !point.data.isFiltered;
                        const isSelected = selectedData === point.data;
                        const isHovered = hoveredPoint?.index === index;
                        const extreme = isExtremePoint(point.data);
                        const isExtreme = extreme.isMax || extreme.isMin;

                        // 只有悬停、选中或极端点才显示圆点
                        const shouldShowDot = isValidPoint && (isHovered || isSelected || isExtreme);

                        return (
                          <g key={index}>
                            {/* 悬停热区（更大，便于触摸） */}
                            <circle
                              cx={point.x}
                              cy={point.y}
                              r="8"
                              fill="transparent"
                              className="cursor-pointer"
                              onMouseEnter={() => setHoveredPoint(point)}
                              onClick={() => setSelectedData(point.data)}
                            />

                            {/* 可见的数据点 - 默认隐藏，交互时显示 */}
                            {isValidPoint ? (
                              <>
                                {/* 普通/警告节点：悬停/选中时显示小圆点 */}
                                {shouldShowDot && nodeStyle.size > 0 && !isExtreme && (
                                  <>
                                    {/* 白边背景 */}
                                    <circle
                                      cx={point.x}
                                      cy={point.y}
                                      r={nodeStyle.size + nodeStyle.strokeWidth + 1}
                                      fill="#ffffff"
                                      className="transition-all duration-200"
                                    />

                                    {/* 节点本体 */}
                                    <circle
                                      cx={point.x}
                                      cy={point.y}
                                      r={nodeStyle.size}
                                      fill={nodeStyle.color}
                                      className={`cursor-pointer transition-all duration-200 ${nodeStyle.pulse ? 'pulse-dot' : ''}`}
                                      onMouseEnter={() => setHoveredPoint(point)}
                                      onClick={() => setSelectedData(point.data)}
                                    />
                                  </>
                                )}

                                {/* 问题1修复：最高/最低净资产特殊强调 - 区分颜色 */}
                                {isExtreme && (
                                  <>
                                    {/* 问题1修复：最低谷使用淡红色，最高使用主题色 */}
                                    {extreme.isMin ? (
                                      <>
                                        {/* 外圈强调效果 - 淡红色 */}
                                        <circle
                                          cx={point.x}
                                          cy={point.y}
                                          r={5}
                                          fill="none"
                                          stroke={LOW_POINT_COLOR}
                                          strokeWidth="1.5"
                                          opacity="0.6"
                                        />
                                        {/* 核心圆点 - 淡红色 */}
                                        <circle
                                          cx={point.x}
                                          cy={point.y}
                                          r={3}
                                          fill={LOW_POINT_COLOR}
                                          className="pulse-dot"
                                          onMouseEnter={() => setHoveredPoint(point)}
                                          onClick={() => setSelectedData(point.data)}
                                        />
                                      </>
                                    ) : (
                                      <>
                                        {/* 外圈强调效果 - 主题色 */}
                                        <circle
                                          cx={point.x}
                                          cy={point.y}
                                          r={5}
                                          fill="none"
                                          stroke={themeConfig.primary}
                                          strokeWidth="1.5"
                                          opacity="0.6"
                                        />
                                        {/* 核心圆点 - 主题色 */}
                                        <circle
                                          cx={point.x}
                                          cy={point.y}
                                          r={3}
                                          fill={themeConfig.primary}
                                          className="pulse-dot"
                                          onMouseEnter={() => setHoveredPoint(point)}
                                          onClick={() => setSelectedData(point.data)}
                                        />
                                      </>
                                    )}
                                  </>
                                )}

                                {/* 选中状态：虚线环 */}
                                {isSelected && !isExtreme && (
                                  <circle
                                    cx={point.x}
                                    cy={point.y}
                                    r={nodeStyle.size + 4}
                                    fill="none"
                                    stroke={themeConfig.primary}
                                    strokeWidth="0.8"
                                    strokeDasharray="2,1.5"
                                    opacity="0.7"
                                  />
                                )}
                              </>
                            ) : (
                              /* 过滤掉的点：不显示 */
                              null
                            )}
                          </g>
                        );
                      })}

                      {/* 悬停指示线 */}
                      {hoveredPoint && (
                        <line
                          x1={hoveredPoint.x}
                          y1="0"
                          x2={hoveredPoint.x}
                          y2="100"
                          stroke={themeConfig.primary}
                          strokeWidth="0.5"
                          strokeDasharray="3,3"
                          opacity="0.4"
                        />
                      )}
                    </svg>

                    {/* 悬停提示 - 优化样式，显示完整日期，支持聚合节点 */}
                    {hoveredPoint && (
                      <div
                        className="absolute bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl pointer-events-none z-20 whitespace-nowrap"
                        style={{
                          left: `${Math.min(Math.max(hoveredPoint.x, 15), 85)}%`,
                          top: `${Math.max(hoveredPoint.y - 15, 8)}%`,
                          transform: 'translate(-50%, -100%)',
                        }}
                      >
                        <div className="font-medium mb-1">
                          {trendType === 'yearly'
                            ? `${hoveredPoint.data.year}年`
                            : `${hoveredPoint.data.year}年${'month' in hoveredPoint.data ? hoveredPoint.data.month.toString().padStart(2, '0') : '01'}月`
                          }
                        </div>
                        <div className="text-gray-300 text-sm">
                          净资产: <span className="text-white font-semibold">{formatBalance(hoveredPoint.data.netWorth)}</span>
                        </div>
                        {hoveredPoint.data.attribution && hoveredPoint.data.attribution.tags.length > 0 && (
                          <div className="text-gray-400 mt-1.5 text-[10px] flex gap-1">
                            {hoveredPoint.data.attribution.tags.slice(0, 2).map((tag, i) => (
                              <span key={i}>{getAttributionTagEmoji(tag as any)}{getAttributionTagLabel(tag as any)}</span>
                            ))}
                          </div>
                        )}
                        {/* 问题3修复：显示聚合节点详情提示 */}
                        {xAxisLabels.find(l => l.x === hoveredPoint.x)?.isAggregated && (
                          <div className="text-gray-400 mt-1.5 text-[10px] border-t border-gray-700 pt-1.5">
                            点击展开查看详情
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* X轴标签 - 年份感知优化 + 问题3修复：聚合节点可点击展开 */}
                  <div className="absolute left-12 right-2 bottom-0 h-10 flex items-end text-xs text-gray-400">
                    {xAxisLabels.map((label, index) => (
                      <span
                        key={index}
                        className={`absolute whitespace-nowrap ${label.isYear ? 'font-semibold text-gray-600' : ''} ${label.isAggregated ? 'cursor-pointer hover:text-blue-500 transition-colors' : ''}`}
                        style={{
                          left: `${label.x}%`,
                          transform: 'translateX(-50%)',
                        }}
                        onClick={() => {
                          // 问题3修复：点击聚合节点时展开详情
                          if (label.isAggregated && label.aggregatedMonths) {
                            setExpandedAggregate({
                              label: label.aggregatedLabel || label.label,
                              months: label.aggregatedMonths
                            });
                          }
                        }}
                      >
                        {label.isBoundary ? (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] inline-block ${label.isAggregated ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' : 'bg-gray-100'}`}>
                            {label.label}
                          </span>
                        ) : (
                          label.label
                        )}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 图例说明 - 问题1 & 问题2修复：高低谷颜色区分 + 左右排版 + 金额格式化 */}
                {abnormalLegend && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-center gap-4 sm:gap-6">
                      {/* 最高点 - 左侧 */}
                      {abnormalLegend.maxPoint && (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5">
                            {/* 问题1修复：最高点使用主题色，带描边 */}
                            <span
                              className="w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm"
                              style={{ backgroundColor: abnormalLegend.themeColor }}
                            ></span>
                            <span className="text-xs font-medium text-gray-600">最高点</span>
                          </div>
                          <span className="text-xs text-gray-500 whitespace-nowrap">
                            {abnormalLegend.maxPoint.showYear ? `${abnormalLegend.maxPoint.year}年` : ''}{abnormalLegend.maxPoint.month}月
                          </span>
                          <span className="text-xs font-semibold whitespace-nowrap" style={{ color: abnormalLegend.themeColor }}>
                            {/* 问题2修复：金额超过10万用万为单位显示 */}
                            ¥{abnormalLegend.maxPoint.netWorth >= 100000 
                              ? (abnormalLegend.maxPoint.netWorth / 10000).toFixed(1) + '万'
                              : formatBalance(abnormalLegend.maxPoint.netWorth)}
                          </span>
                        </div>
                      )}
                      {/* 最低点 - 右侧 */}
                      {abnormalLegend.hasBoth && abnormalLegend.minPoint && (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5">
                            {/* 问题1修复：最低谷使用淡红色，带描边和脉冲动画 */}
                            <span
                              className="w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm animate-pulse"
                              style={{ backgroundColor: abnormalLegend.lowPointColor }}
                            ></span>
                            <span className="text-xs font-medium text-gray-600">最低点</span>
                          </div>
                          <span className="text-xs text-gray-500 whitespace-nowrap">
                            {abnormalLegend.minPoint.showYear ? `${abnormalLegend.minPoint.year}年` : ''}{abnormalLegend.minPoint.month}月
                          </span>
                          <span className="text-xs font-semibold whitespace-nowrap" style={{ color: abnormalLegend.lowPointColor }}>
                            {/* 问题2修复：金额超过10万用万为单位显示 */}
                            ¥{abnormalLegend.minPoint.netWorth >= 100000 
                              ? (abnormalLegend.minPoint.netWorth / 10000).toFixed(1) + '万'
                              : formatBalance(abnormalLegend.minPoint.netWorth)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <p className="text-center text-xs text-gray-400 mt-3">
                  点击节点查看详情，{timeRange === 'all' && monthlyHistory.length > 12 ? '点击聚合节点展开详情，' : ''}悬停查看预览
                </p>
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
      <Dialog open={!!selectedData} onOpenChange={() => {
        setSelectedData(null);
        setExpandedSnapshots(false);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedData && ('month' in selectedData
                ? `${selectedData.year}年${selectedData.month.toString().padStart(2, '0')}月`
                : `${selectedData.year}年`
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedData && (
            <div className="space-y-4 py-4">
              {/* 基本信息 */}
              <div className="text-center p-4 bg-gray-50 rounded-xl">
                <div className="text-sm text-gray-500 mb-1">净资产</div>
                <div className="text-3xl font-bold" style={{ color: themeConfig.primary }}>
                  {formatBalance(selectedData.netWorth)}
                </div>
                <div className={`text-sm font-medium mt-1 ${selectedData.change >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {selectedData.change >= 0 ? '+' : ''}{formatBalance(selectedData.change)}
                  <span className="text-xs ml-1 text-gray-400">
                    ({hideBalance ? '******' : `${selectedData.changePercent >= 0 ? '+' : ''}${selectedData.changePercent.toFixed(2)}%`})
                  </span>
                </div>
              </div>

              {/* 归因信息 */}
              {selectedData.attribution ? (
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {selectedData.attribution.tags.map(tag => (
                      <span key={tag} className="text-sm bg-white px-2 py-1 rounded-md shadow-sm">
                        {getAttributionTagEmoji(tag as any)} {getAttributionTagLabel(tag as any)}
                      </span>
                    ))}
                  </div>
                  {selectedData.attribution.note && (
                    <p className="text-sm text-gray-600 mt-2">{selectedData.attribution.note}</p>
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
              {('month' in selectedData) && (
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
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {getSelectedSnapshots().map(snapshot => (
                        <div key={snapshot.accountId} className="flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                          <div className="flex items-center gap-2">
                            <Icon name={snapshot.accountIcon} size={16} />
                            <span className="text-gray-700">{snapshot.accountName}</span>
                          </div>
                          <div className="text-right">
                            <span className={snapshot.accountType === 'credit' || snapshot.accountType === 'debt' ? 'text-red-500' : 'text-gray-900'}>
                              ¥{formatBalance(snapshot.balance)}
                            </span>
                            {snapshot.change !== undefined && snapshot.change !== 0 && (
                              <div className={`text-xs ${snapshot.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {snapshot.change >= 0 ? '↑+' : '↓'}{formatBalance(Math.abs(snapshot.change))}
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
                  variant="outline"
                  className="flex-1"
                  onClick={() => goToRecordForAttribution(selectedData.year, 'month' in selectedData ? selectedData.month : undefined)}
                >
                  <Edit3 size={14} className="mr-1" />
                  {selectedData.attribution ? '编辑备注' : '补充记录'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 问题3修复：聚合节点展开弹窗 */}
      <Dialog open={!!expandedAggregate} onOpenChange={() => setExpandedAggregate(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{expandedAggregate?.label}</DialogTitle>
          </DialogHeader>
          {expandedAggregate && (
            <div className="space-y-2 py-2 max-h-64 overflow-y-auto">
              {expandedAggregate.months
                .sort((a, b) => {
                  if (a.year !== b.year) return a.year - b.year;
                  return a.month - b.month;
                })
                .map((month, index) => (
                  <div key={index} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <span className="text-sm text-gray-600">
                      {month.year}年{month.month.toString().padStart(2, '0')}月
                    </span>
                    <span className="text-sm font-medium" style={{ color: themeConfig.primary }}>
                      ¥{formatBalance(month.netWorth)}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
