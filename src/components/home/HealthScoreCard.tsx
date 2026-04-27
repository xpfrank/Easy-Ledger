import { Activity } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { HealthScore } from '@/types';

interface HealthScoreCardProps {
  healthScore: HealthScore;
  primaryColor: string;
  onClick?: () => void;
}

function getLevelColor(level: string): { bg: string; text: string } {
  switch (level) {
    case 'A':
      return { bg: '#f0fdf4', text: '#16a34a' };
    case 'B+':
      return { bg: '#f0fdf4', text: '#16a34a' };
    case 'B':
      return { bg: '#fffbeb', text: '#ca8a04' };
    case 'C':
      return { bg: '#fffbeb', text: '#ca8a04' };
    case 'D':
      return { bg: '#fef2f2', text: '#dc2626' };
    default:
      return { bg: '#f0fdf4', text: '#16a34a' };
  }
}

export function HealthScoreCard({ healthScore, primaryColor, onClick }: HealthScoreCardProps) {
  const configColor = getLevelColor(healthScore.configScore.level);
  const volatilityColor = getLevelColor(healthScore.volatilityScore.level);

  return (
    <Card className="bg-white cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: `${primaryColor}15` }}>
              <Activity size={16} style={{ color: primaryColor }} />
            </div>
            <span className="font-semibold text-sm text-gray-800">资产健康度分析</span>
          </div>
          <span className="text-lg font-bold" style={{ color: primaryColor }}>
            {healthScore.score}<span className="text-xs font-normal" style={{ color: `${primaryColor}99` }}>/100</span>
          </span>
        </div>

        {/* 三格子卡片 */}
        <div className="grid grid-cols-3 gap-2">
          {/* 配置评分 */}
          <div className="rounded-xl p-3 text-center" style={{ backgroundColor: configColor.bg }}>
            <div className="text-xl font-bold" style={{ color: configColor.text }}>
              {healthScore.configScore.level}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">配置评分</div>
            <div className="text-xs mt-0.5" style={{ color: configColor.text }}>
              {healthScore.configScore.cashRatio < 20
                ? '现金占比低'
                : healthScore.configScore.cashRatio > 40
                  ? '现金占比高'
                  : '现金合理'}
            </div>
          </div>

          {/* 波动控制 */}
          <div className="rounded-xl p-3 text-center" style={{ backgroundColor: volatilityColor.bg }}>
            <div className="text-xl font-bold" style={{ color: volatilityColor.text }}>
              {healthScore.volatilityScore.level}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">波动控制</div>
            <div className="text-xs mt-0.5" style={{ color: volatilityColor.text }}>
              {healthScore.volatilityScore.standardDeviation > 15 ? '波动较大' : '波动正常'}
            </div>
          </div>

          {/* 归因完整度 */}
          <div 
            className="rounded-xl p-3 text-center" 
            style={{ backgroundColor: `${primaryColor}10` }}
          >
            <div className="text-xl font-bold" style={{ color: primaryColor }}>
              {healthScore.attributionCompleteness}%
            </div>
            <div className="text-xs text-gray-500 mt-0.5">归因完整</div>
            <div className="text-xs mt-0.5" style={{ color: `${primaryColor}cc` }}>
              {healthScore.attributionCompleteness >= 80 ? '本月记录中' : '待补全'}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
