import { Target, TrendingUp, Calendar, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { YearlyGoal } from '@/types';
import { formatAmountNoSymbol, getBaseCurrency } from '@/lib/storage';
import { getCurrencyConfig } from '@/types';
import { calculateGoalProgress } from '@/lib/health-calculator';

// 色彩语义定义 - 精简为中性+主题色
const COLORS = {
  growth: '#22c55e',      // 实际增长 - 绿色（仅文字）
  target: '#3b82f6',      // 目标/预测 - 蓝色（仅文字）
  warning: '#f59e0b',     // 差额/警示 - 橙色（仅文字）
  neutral: '#6b7280',     // 中性
};

interface YearlyGoalCardProps {
  goal: YearlyGoal | null;
  goalProgress?: {
    progress: number;
    estimatedMonthsToGoal: number;
    isOnTrack: boolean;
    monthlyGrowthRate: number;
  } | null;
  currentNetWorth: number;
  primaryColor: string;
  hideBalance: boolean;
  baseCurrencySymbol?: string;
  onClick?: () => void;
  onSetGoal?: () => void;
}

export function YearlyGoalCard({ goal, goalProgress, currentNetWorth, primaryColor, hideBalance, baseCurrencySymbol, onClick, onSetGoal }: YearlyGoalCardProps) {
  const progressData = goalProgress || (goal ? calculateGoalProgress(currentNetWorth, goal) : null);
  const displaySymbol = baseCurrencySymbol || getCurrencyConfig(getBaseCurrency()).symbol;

  if (!goal || !progressData) {
    return (
      <Card 
        className="bg-white cursor-pointer hover:shadow-md transition-all active:scale-[0.98]" 
        onClick={onSetGoal || onClick}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: `${primaryColor}15` }}>
                <Target size={14} style={{ color: primaryColor }} />
              </div>
              <span className="font-bold text-sm text-gray-800" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>年度目标</span>
            </div>
            <span className="text-[10.5px] px-3 py-1 rounded-full text-white" style={{ backgroundColor: primaryColor }}>
              去设置
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-2 ml-9">设置年度净资产目标，追踪达成进度</p>
        </CardContent>
      </Card>
    );
  }

  const { progress, estimatedMonthsToGoal, isOnTrack: _isOnTrack, monthlyGrowthRate } = progressData;

  const fmtShort = (n: number): string => {
    if (hideBalance) return '****';
    const a = Math.abs(n);
    if (a >= 10000) return `${(n / 10000).toFixed(1)}万`;
    return formatAmountNoSymbol(n);
  };

  const getEstimateLabel = (): string => {
    if (progress >= 100) return '已达成';
    if (estimatedMonthsToGoal > 0) {
      const now = new Date();
      const tm = now.getMonth() + 1 + estimatedMonthsToGoal;
      const ty = now.getFullYear() + Math.floor((tm - 1) / 12);
      const mm = ((tm - 1) % 12) + 1;
      return `${ty}年${mm}月`;
    }
    if (estimatedMonthsToGoal === 0 && monthlyGrowthRate > 0) return '即将达成';
    return '暂无法预测';
  };

  const estimateLabel = getEstimateLabel();
  const isNearGoal = progress >= 90;
  const growthPrefix = monthlyGrowthRate >= 0 ? '+' : '';

  return (
    <Card 
      className="bg-white hover:shadow-md transition-all overflow-hidden"
    >
      <CardContent className="px-4 py-4">
        {/* 顶部标题 */}
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: `${primaryColor}15` }}>
              <Target size={14} style={{ color: primaryColor }} />
            </div>
            <span className="font-bold text-sm text-gray-800" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
              {goal.year}年度目标
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); onClick?.(); }}
              className="flex items-center gap-0.5 text-[11px] font-medium transition-colors active:opacity-70"
              style={{ color: primaryColor }}
            >
              查看详情
              <ChevronRight size={12} />
            </button>
          </div>
          {/* 目标金额 - 使用主题色 */}
          <span className="text-[10.5px] px-2.5 py-1 rounded-full font-bold"
            style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}>
            目标 {displaySymbol}{hideBalance ? '****' : `${(goal.targetAmount / 10000).toFixed(0)}万`}
          </span>
        </div>

        {/* 完成度百分比 + 预计达成时间（同一行） */}
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <span className="text-[26px] font-extrabold leading-[1] block mb-1" 
              style={{ color: primaryColor, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
              {hideBalance ? '**%' : `${progress.toFixed(1)}%`}
            </span>
            <span className="text-xs text-gray-400">目标完成度</span>
          </div>
          
          {/* 预计达成时间 - 与完成度同一行 */}
          <div className="text-right">
            <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
              <Calendar size={12} className="text-gray-400" />
              <span>预计达成时间</span>
            </div>
            <span className="text-sm font-bold text-gray-800">
              {estimateLabel}
            </span>
          </div>
        </div>

        {/* 进度条 */}
        <div className="w-full h-[6px] bg-gray-100 rounded-full mb-4 relative">
          <div
            className="h-full rounded-full transition-all duration-[1.3s]"
            style={{
              width: `${Math.min(progress, 100)}%`,
              background: `linear-gradient(90deg, #7dd3fc, ${primaryColor})`,
            }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 rounded-full shadow-sm"
            style={{ 
              left: `${Math.min(progress, 100)}%`,
              borderColor: isNearGoal ? COLORS.growth : COLORS.warning,
              transform: 'translate(-50%, -50%)'
            }}
          />
        </div>

        {/* 增长指标 - 缩小尺寸，去除底色，使用描边 */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg p-2.5 text-center border border-gray-100 bg-gray-50/50">
            <div className="flex items-center justify-center gap-1 text-[10px] mb-1 text-gray-500">
              <TrendingUp size={10} />
              本月净增
            </div>
            <div className="text-sm font-bold text-gray-800">
              {hideBalance ? '****' : `${growthPrefix}${fmtShort(monthlyGrowthRate || 0)}`}
            </div>
          </div>
          <div className="rounded-lg p-2.5 text-center border border-gray-100 bg-gray-50/50">
            <div className="flex items-center justify-center gap-1 text-[10px] mb-1 text-gray-500">
              <TrendingUp size={10} />
              月均增长
            </div>
            <div className="text-sm font-bold text-gray-800">
              {hideBalance ? '****' : `${growthPrefix}${fmtShort(monthlyGrowthRate || 0)}`}
            </div>
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
