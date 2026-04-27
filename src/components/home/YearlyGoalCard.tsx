import { TrendingUp, Target } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { YearlyGoal } from '@/types';
import { formatAmountNoSymbol } from '@/lib/storage';
import { calculateGoalProgress } from '@/lib/health-calculator';

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
  onClick?: () => void;
  onSetGoal?: () => void;
}

export function YearlyGoalCard({ goal, goalProgress, currentNetWorth, primaryColor, hideBalance, onClick, onSetGoal }: YearlyGoalCardProps) {
const progressData = goalProgress || (goal ? calculateGoalProgress(currentNetWorth, goal) : null);
  if (!goal || !progressData) {
    return (
      <Card className="bg-white cursor-pointer hover:shadow-md transition-shadow" onClick={onSetGoal || onClick}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: `${primaryColor}15` }}>
                <Target size={14} style={{ color: primaryColor }} />
              </div>
              <span className="font-semibold text-sm text-gray-800">年度目标</span>
            </div>
            <span className="text-xs px-3 py-1 rounded-full text-white" style={{ backgroundColor: primaryColor }}>
              去设置
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-2 ml-9">设置年度净资产目标，追踪达成进度</p>
        </CardContent>
      </Card>
    );
  }

  const { progress, estimatedMonthsToGoal, isOnTrack, monthlyGrowthRate } = progressData;
  const remaining = goal.targetAmount - currentNetWorth;

  return (
    <Card className="bg-white cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: `${primaryColor}15` }}>
              <Target size={14} style={{ color: primaryColor }} />
            </div>
            <span className="font-semibold text-sm text-gray-800">
              {goal.year}年度目标
            </span>
          </div>
          <span className="text-xs text-gray-400">
            目标：¥{hideBalance ? '****' : `${(goal.targetAmount / 10000).toFixed(0)}万`}
          </span>
        </div>

        {/* 大进度数字 + 剩余金额 */}
        <div className="flex items-end justify-between mb-2">
          <span className="text-2xl font-bold" style={{ color: primaryColor }}>
            {hideBalance ? '**%' : `${progress.toFixed(1)}%`}
          </span>
          <span className="text-xs text-gray-500">
            还差 ¥{hideBalance ? '****' : formatAmountNoSymbol(remaining)}
          </span>
        </div>

        {/* 进度条 */}
        <div className="w-full h-2 bg-gray-100 rounded-full mb-2">
          <div
            className="h-2 rounded-full transition-all"
            style={{ width: `${Math.min(progress, 100)}%`, backgroundColor: primaryColor }}
          />
        </div>

        {/* 预测文字 */}
        {progress >= 100 ? (
          <div className="flex items-center gap-1 text-xs text-emerald-500">
            <TrendingUp size={12} />
            已达成年度目标
          </div>
        ) : estimatedMonthsToGoal > 0 ? (
          <div className="flex items-center gap-1 text-xs" style={{ color: primaryColor }}>
            <TrendingUp size={12} />
            {isOnTrack
              ? `按当前速度，预计提前${estimatedMonthsToGoal}个月达成目标`
              : `预计还需 ${estimatedMonthsToGoal} 个月达成目标`}
          </div>
        ) : estimatedMonthsToGoal === 0 && monthlyGrowthRate > 0 ? (
          <div className="flex items-center gap-1 text-xs text-emerald-500">
            <TrendingUp size={12} />
            即将达成目标
          </div>
        ) : estimatedMonthsToGoal === -1 ? (
          <div className="flex items-center gap-1 text-xs text-red-500">
            <TrendingUp size={12} />
            当前趋势下难以达成目标
          </div>
        ) : (
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <TrendingUp size={12} />
            暂无足够数据预测达成时间
          </div>
        )}
      </CardContent>
    </Card>
  );
}
