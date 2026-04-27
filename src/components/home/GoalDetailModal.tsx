import { X, TrendingUp, Target } from 'lucide-react';
import { formatAmountNoSymbol } from '@/lib/storage';
import type { YearlyGoal } from '@/types';

interface GoalDetailModalProps {
  goal: YearlyGoal;
  goalProgress: {
    progress: number;
    estimatedMonthsToGoal: number;
    isOnTrack: boolean;
    monthlyGrowthRate: number;
  };
  currentNetWorth: number;
  hideBalance: boolean;
  primaryColor: string;
  onClose: () => void;
  onEdit?: () => void;
}

export function GoalDetailModal({
  goal,
  goalProgress,
  currentNetWorth,
  hideBalance,
  primaryColor,
  onClose,
  onEdit,
}: GoalDetailModalProps) {
  const remaining = goal.targetAmount - currentNetWorth;
  const { progress, estimatedMonthsToGoal, isOnTrack, monthlyGrowthRate } = goalProgress;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Target size={18} style={{ color: primaryColor }} />
            <span className="font-bold text-gray-800">{goal.year}年度目标详情</span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"
          >
            <X size={14} className="text-gray-500" />
          </button>
        </div>

        <div className="text-center mb-6">
          <div className="text-5xl font-bold mb-1" style={{ color: primaryColor }}>
            {hideBalance ? '**%' : `${progress.toFixed(1)}%`}
          </div>
          <div className="text-sm text-gray-400">目标完成度</div>
        </div>

        <div className="space-y-3 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">当前净资产</span>
            <span className="font-medium text-gray-800">
              ¥{hideBalance ? '******' : formatAmountNoSymbol(currentNetWorth)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">目标金额</span>
            <span className="font-medium text-gray-800">
              ¥{hideBalance ? '******' : formatAmountNoSymbol(goal.targetAmount)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">还需增长</span>
            <span className={`font-medium ${remaining > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
              ¥{hideBalance ? '******' : formatAmountNoSymbol(remaining)}
            </span>
          </div>
        </div>

        {estimatedMonthsToGoal > 0 && monthlyGrowthRate > 0 && (
          <div
            className="rounded-xl p-3 flex items-start gap-2"
            style={{ backgroundColor: `${primaryColor}12` }}
          >
            <TrendingUp
              size={14}
              className="mt-0.5 flex-shrink-0"
              style={{ color: primaryColor }}
            />
            <span className="text-xs leading-relaxed" style={{ color: primaryColor }}>
              按当前月均增长 ¥{hideBalance ? '******' : `${(monthlyGrowthRate / 10000).toFixed(1)}万`}，
              {isOnTrack
                ? `预计提前 ${estimatedMonthsToGoal} 个月达成目标`
                : `预计还需 ${estimatedMonthsToGoal} 个月达成目标`}
            </span>
          </div>
        )}

        {onEdit && (
          <button
            onClick={onEdit}
            className="w-full mt-4 py-3 rounded-xl text-white font-medium"
            style={{ backgroundColor: primaryColor }}
          >
            编辑目标
          </button>
        )}
      </div>
    </div>
  );
}