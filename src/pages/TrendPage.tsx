import { useState, useEffect, useMemo, useRef } from 'react';
import { ArrowLeft, TrendingUp, TrendingDown, Calendar, ChevronDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { PageRoute, MonthlyNetWorth, ThemeType } from '@/types';
import { formatAmount, formatAmountNoSymbol, getSettings } from '@/lib/storage';
import { getNetWorthHistory, getYearlyNetWorthHistory } from '@/lib/calculator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { THEMES } from '@/types';

interface TrendPageProps {
  onPageChange: (page: PageRoute, params?: any) => void;
}

type TimeRange = '6' | '12' | 'all';
type TrendType = 'monthly' | 'yearly';

interface YearlyNetWorth {
  year: number;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  change: number;
  changePercent: number;
}

export function TrendPage({ onPageChange }: TrendPageProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('12');
  const [trendType, setTrendType] = useState<TrendType>('monthly');
  const [showTrendDropdown, setShowTrendDropdown] = useState(false);
  const [monthlyHistory, setMonthlyHistory] = useState<MonthlyNetWorth[]>([]);
  const [yearlyHistory, setYearlyHistory] = useState<YearlyNetWorth[]>([]);
  const [selectedData, setSelectedData] = useState<any | null>(null);
  const [theme, setTheme] = useState<ThemeType>('blue');
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; data: any } | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const themeConfig = THEMES[theme];

  useEffect(() => {
    const settings = getSettings();
    setTheme(settings.theme || 'blue');
    const months = timeRange === 'all' ? 999 : parseInt(timeRange);
    setMonthlyHistory(getNetWorthHistory(months));
    setYearlyHistory(getYearlyNetWorthHistory());
  }, [timeRange]);

  // 当前显示的历史数据
  const history = trendType === 'monthly' ? monthlyHistory : yearlyHistory;

  const stats = useMemo(() => {
    if (history.length === 0) return null;
    
    const netWorths = history.map(h => h.netWorth);
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
  }, [history]);

  // 计算图表数据
  const chartData = useMemo(() => {
    if (history.length === 0) return null;

    const netWorths = history.map(h => h.netWorth);
    const max = Math.max(...netWorths, 0);
    const min = Math.min(...netWorths, 0);
    const range = max - min || 1;

    // 计算坐标点
    const points = history.map((h, index) => {
      const x = (index / (history.length - 1 || 1)) * 100;
      const y = max === min ? 50 : 100 - ((h.netWorth - min) / range) * 80 - 10;
      return { x, y, data: h };
    });

    // 生成 SVG 路径
    const pathD = points.length > 0 
      ? `M ${points[0].x} ${points[0].y} ` + 
        points.slice(1).map((p, i) => {
          const prev = points[i];
          const cp1x = prev.x + (p.x - prev.x) / 3;
          const cp1y = prev.y;
          const cp2x = prev.x + (p.x - prev.x) * 2 / 3;
          const cp2y = p.y;
          return `C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p.x} ${p.y}`;
        }).join(' ')
      : '';

    // 生成填充区域路径
    const fillD = pathD + ` L ${points[points.length - 1]?.x || 0} 100 L ${points[0]?.x || 0} 100 Z`;

    return { points, pathD, fillD, max, min, range };
  }, [history, trendType]);

  // 判断是否需要显示年份分隔（跨年度时，仅月度趋势）
  const showYearSeparators = useMemo(() => {
    if (trendType === 'yearly') return false;
    if (history.length < 2) return false;
    const firstYear = history[0].year;
    const lastYear = history[history.length - 1].year;
    return firstYear !== lastYear;
  }, [history, trendType]);

  const formatMonthLabel = (year: number, month: number) => {
    return `${year}年${month.toString().padStart(2, '0')}月`;
  };

  // 智能金额格式化 - 根据数值大小自动选择合适的单位和精度
  const formatSmartAmount = (amount: number, useUnit: string): string => {
    const absValue = Math.abs(amount);
    
    if (useUnit === 'w') {
      // 万为单位：显示1位小数（如 1.5w）
      return (amount / 10000).toFixed(1) + 'w';
    } else if (useUnit === 'k') {
      // 千为单位：根据大小决定是否显示小数
      if (absValue >= 10000) {
        // 大于1万时显示整数（如 12k）
        return Math.round(amount / 1000) + 'k';
      } else {
        // 1千到1万之间显示1位小数（如 3.4k）
        return (amount / 1000).toFixed(1) + 'k';
      }
    } else {
      // 元为单位：显示整数
      return Math.round(amount).toString();
    }
  };

  // 计算规整的刻度间隔
  const getNiceStep = (range: number, tickCount: number): number => {
    if (range <= 0) return 1;
    const roughStep = range / (tickCount - 1);
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
    const normalized = roughStep / magnitude;
    
    // 选择规整的刻度间隔：1, 2, 5, 10 的倍数
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
    
    const { max, min } = chartData;
    const range = max - min;
    const tickCount = 7; // 生成7个刻度
    
    // 确定使用什么单位
    const absMax = Math.max(Math.abs(max), Math.abs(min));
    let unit: '元' | 'k' | 'w';
    if (absMax >= 1000000) {
      unit = 'w'; // 大于100万使用万为单位
    } else if (absMax >= 10000) {
      unit = 'k'; // 大于1万使用千为单位
    } else {
      unit = '元'; // 否则使用元
    }
    
    // 计算规整的刻度步长
    const step = getNiceStep(range, tickCount);
    
    // 计算规整的最小值和最大值
    const niceMin = Math.floor(min / step) * step;
    const niceMax = Math.ceil(max / step) * step;
    
    // 生成刻度
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

  return (
    <div className="pb-6 bg-gray-50 min-h-screen">
      {/* 标题栏 */}
      <header className="bg-white px-4 py-3 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => onPageChange('home')}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-lg font-semibold">资产趋势</h1>
        </div>
      </header>

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

        {history.length === 0 ? (
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
            {/* 折线图 - 优化样式参考图7 */}
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

                      {/* 数据点 - 带悬停效果 */}
                      {chartData?.points.map((point, index) => (
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
                          <circle
                            cx={point.x}
                            cy={point.y}
                            r={hoveredPoint?.data === point.data ? "5" : "3"}
                            fill={themeConfig.primary}
                            stroke="white"
                            strokeWidth="2"
                            className="cursor-pointer transition-all duration-200"
                            onMouseEnter={() => setHoveredPoint(point)}
                            onClick={() => setSelectedData(point.data)}
                          />
                          {/* 悬停时的外圈 */}
                          {hoveredPoint?.data === point.data && (
                            <circle
                              cx={point.x}
                              cy={point.y}
                              r="8"
                              fill="none"
                              stroke={themeConfig.primary}
                              strokeWidth="1"
                              strokeOpacity="0.5"
                            />
                          )}
                        </g>
                      ))}
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
                          余额: {formatAmountNoSymbol(hoveredPoint.data.netWorth)}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* X轴标签 */}
                  <div className="absolute left-14 right-0 bottom-0 h-10 flex justify-between items-end text-xs text-gray-400">
                    {trendType === 'yearly' ? (
                      // 年度趋势：显示年份
                      (history as YearlyNetWorth[]).map((h, i) => (
                        <span key={i}>{h.year}年</span>
                      ))
                    ) : (
                      // 月度趋势
                      (history as MonthlyNetWorth[]).length <= 6 ? (
                        (history as MonthlyNetWorth[]).map((h, i) => (
                          <span key={i}>{h.month}月</span>
                        ))
                      ) : (
                        <>
                          <span>{(history as MonthlyNetWorth[])[0]?.month}月</span>
                          {showYearSeparators && history.length > 3 && (
                            <span style={{ color: themeConfig.primary }} className="font-medium">{history[0]?.year}</span>
                          )}
                          {history.length > 4 && (
                            <span>{(history as MonthlyNetWorth[])[Math.floor(history.length / 2)]?.month}月</span>
                          )}
                          {showYearSeparators && (
                            <span style={{ color: themeConfig.primary }} className="font-medium">
                              {history[history.length - 1]?.year}
                            </span>
                          )}
                          <span>{(history as MonthlyNetWorth[])[history.length - 1]?.month}月</span>
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
                    <div className="text-lg font-semibold">{formatAmountNoSymbol(stats.maxNetWorth)}</div>
                  </CardContent>
                </Card>
                <Card className="bg-white">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingDown size={16} className="text-red-500" />
                      <span className="text-xs text-gray-500">最低净资产</span>
                    </div>
                    <div className="text-lg font-semibold">{formatAmountNoSymbol(stats.minNetWorth)}</div>
                  </CardContent>
                </Card>
                <Card className="bg-white">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar size={16} className="text-blue-500" />
                      <span className="text-xs text-gray-500">平均净资产</span>
                    </div>
                    <div className="text-lg font-semibold">{formatAmountNoSymbol(stats.avgNetWorth)}</div>
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
                      {stats.totalChange >= 0 ? '+' : ''}{formatAmountNoSymbol(stats.totalChange)}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}
      </div>

      {/* 详情弹窗 - 显示完整年月信息 */}
      <Dialog open={!!selectedData} onOpenChange={() => setSelectedData(null)}>
        <DialogContent>
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
              <div className="text-center">
                <div className="text-sm text-gray-500 mb-1">净资产</div>
                <div className="text-3xl font-bold text-sky-600">
                  {formatAmount(selectedData.netWorth)}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-400 mb-1">总资产</div>
                  <div className="text-lg font-medium">
                    {formatAmount(selectedData.totalAssets)}
                  </div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-400 mb-1">负资产</div>
                  <div className="text-lg font-medium text-red-500">
                    {formatAmount(selectedData.totalLiabilities)}
                  </div>
                </div>
              </div>
              <div className="flex justify-center items-center gap-4">
                <div className="text-center">
                  <div className="text-xs text-gray-400 mb-1">环比变化</div>
                  <div className={`text-lg font-medium ${selectedData.change >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {selectedData.change >= 0 ? '+' : ''}{formatAmountNoSymbol(selectedData.change)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-400 mb-1">变化率</div>
                  <div className={`text-lg font-medium ${selectedData.changePercent >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {selectedData.changePercent >= 0 ? '+' : ''}{selectedData.changePercent.toFixed(2)}%
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
