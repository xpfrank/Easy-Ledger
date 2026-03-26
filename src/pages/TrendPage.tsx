import { useState, useEffect, useMemo, useRef } from 'react';
import { ArrowLeft, TrendingUp, TrendingDown, Calendar, ChevronDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { PageRoute, MonthlyNetWorth, ThemeType } from '@/types';
import { formatAmountNoSymbol, getSettings } from '@/lib/storage';
import { calculateNetWorth, calculateTotalAssets, calculateTotalLiabilities } from '@/lib/calculator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { THEMES } from '@/types';

interface TrendPageProps {
  navigate: (route: PageRoute) => void;
}

const TrendPage = ({ navigate }: TrendPageProps) => {
  const [records, setRecords] = useState<any[]>([]);
  const [theme, setTheme] = useState<ThemeType>('light');
  const [isMounted, setIsMounted] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [showMonthDialog, setShowMonthDialog] = useState(false);
  const [timeRange, setTimeRange] = useState<'6' | '12' | 'all'>('6');

  useEffect(() => {
    setIsMounted(true);
    loadSettings();
    loadRecords();
  }, []);

  const loadSettings = async () => {
    const settings = await getSettings();
    setTheme(settings.theme);
  };

  const loadRecords = () => {
    const saved = localStorage.getItem('monthly_records');
    if (saved) {
      setRecords(JSON.parse(saved));
    }
  };

  // 处理月度净资产数据（修复：排除借出资产，与首页保持一致）
  const monthlyData = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    
    records.forEach(record => {
      if (!grouped[record.month]) {
        grouped[record.month] = [];
      }
      grouped[record.month].push(record);
    });

    const months = Object.keys(grouped).sort();
    return months.map(month => {
      const monthRecords = grouped[month];
      const totalAssets = calculateTotalAssets(monthRecords);
      const totalLiabilities = calculateTotalLiabilities(monthRecords);
      const netWorth = totalAssets - totalLiabilities;

      return {
        month,
        netWorth,
        totalAssets,
        totalLiabilities,
        records: monthRecords,
      };
    });
  }, [records]);

  // 根据时间范围筛选
  const filteredData = useMemo(() => {
    const reversed = [...monthlyData].reverse();
    
    switch (timeRange) {
      case '6':
        return reversed.slice(0, 6).reverse();
      case '12':
        return reversed.slice(0, 12).reverse();
      default:
        return reversed.reverse();
    }
  }, [monthlyData, timeRange]);

  // 趋势变化计算
  const trendData = useMemo(() => {
    if (filteredData.length < 2) return null;

    const first = filteredData[0];
    const last = filteredData[filteredData.length - 1];
    const change = last.netWorth - first.netWorth;
    const changePercent = first.netWorth !== 0 
      ? (change / Math.abs(first.netWorth)) * 100 
      : 0;

    return {
      startValue: first.netWorth,
      endValue: last.netWorth,
      change,
      changePercent,
      isPositive: change >= 0,
    };
  }, [filteredData]);

  if (!isMounted) return null;

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 ${theme === 'dark' ? 'dark' : ''}`}>
      {/* 顶部导航栏 */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('home')}
                className="hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-xl font-bold text-gray-800 dark:text-white">资产趋势</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* 时间范围选择 */}
        <div className="mb-6">
          <Tabs
            value={timeRange}
            onValueChange={(v) => setTimeRange(v as any)}
            className="w-full"
          >
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="6">近6个月</TabsTrigger>
              <TabsTrigger value="12">近12个月</TabsTrigger>
              <TabsTrigger value="all">全部</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* 趋势概览 */}
        {trendData && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {filteredData[0]?.month} - {filteredData[filteredData.length - 1]?.month}
                </p>
                <p className="text-3xl font-bold mt-2 text-gray-800 dark:text-white">
                  ¥{formatAmountNoSymbol(trendData.endValue)}
                </p>
                <div className={`flex items-center gap-1 mt-2 ${
                  trendData.isPositive ? 'text-green-600' : 'text-red-600'
                }`}>
                  {trendData.isPositive ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  <span className="text-sm font-medium">
                    {trendData.isPositive ? '+' : ''}
                    ¥{formatAmountNoSymbol(trendData.change)} 
                    ({trendData.isPositive ? '+' : ''}{trendData.changePercent.toFixed(1)}%)
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 月度趋势列表 */}
        <div className="space-y-3">
          {filteredData.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <p>暂无趋势数据</p>
            </div>
          ) : (
            filteredData.map((item, index) => (
              <Card 
                key={item.month}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => {
                  setSelectedMonth(item.month);
                  setShowMonthDialog(true);
                }}
              >
                <CardContent className="py-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <span className="font-medium text-gray-800 dark:text-white">
                          {item.month}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        净资产：¥{formatAmountNoSymbol(item.netWorth)}
                      </p>
                    </div>
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* 月度详情弹窗 */}
      <Dialog open={showMonthDialog} onOpenChange={setShowMonthDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedMonth} 资产详情</DialogTitle>
          </DialogHeader>
          {selectedMonth && (
            <div className="space-y-4 mt-2">
              {filteredData.find(d => d.month === selectedMonth)?.records.map((record, idx) => (
                <div key={idx} className="flex justify-between py-2 border-b last:border-0">
                  <span className="text-gray-600 dark:text-gray-300">{record.accountName}</span>
                  <span className={`font-medium ${
                    Number(record.balance) >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    ¥{formatAmountNoSymbol(Number(record.balance))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TrendPage;