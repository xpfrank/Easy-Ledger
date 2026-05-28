import { Target } from 'lucide-react';
import type { YearlyGoal } from '@/types';
import { calculateGoalProgress } from '@/lib/health-calculator';

interface GoalBadgeProps {
  goal: YearlyGoal | null;
  currentNetWorth: number;
  onClick?: () => void;
}

export function GoalBadge({ goal, currentNetWorth, onClick }: GoalBadgeProps) {
  if (!goal) return null;

  const { progress } = calculateGoalProgress(currentNetWorth, goal);

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-transform active:scale-95"
      style={{
        backgroundColor: 'rgba(255,255,255,0.25)',
        color: '#ffffff',
        border: '1px solid rgba(255,255,255,0.35)',
      }}
    >
      <Target size={12} />
      {progress.toFixed(0)}%
    </button>
  );
}
