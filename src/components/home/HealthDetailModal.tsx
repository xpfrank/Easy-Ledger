import { X, Activity, CheckCircle, AlertTriangle } from 'lucide-react';
import type { HealthScore } from '@/types';

interface HealthDetailModalProps {
  healthScore: HealthScore;
  primaryColor: string;
  onClose: () => void;
}

function getLevelColor(level: string) {
  if (level === 'A' || level === 'B+') return { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' };
  if (level === 'B' || level === 'C') return { bg: '#fffbeb', text: '#ca8a04', border: '#fde68a' };
  return { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' };
}

export function HealthDetailModal({
  healthScore,
  primaryColor,
  onClose,
}: HealthDetailModalProps) {
  const configColor = getLevelColor(healthScore.configScore.level);
  const volatilityColor = getLevelColor(healthScore.volatilityScore.level);
  const completenessOk = healthScore.attributionCompleteness >= 80;
  const completenessColor = completenessOk
    ? { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' }
    : { bg: '#fffbeb', text: '#ca8a04', border: '#fde68a' };

  const currentMonth = new Date().getMonth() + 1;
  const recordedMonths = Math.round((healthScore.attributionCompleteness * currentMonth) / 100);

  const configDesc = (() => {
    const { cashRatio, investmentRatio } = healthScore.configScore;
    return `现金类账户占比 ${cashRatio.toFixed(0)}%，投资类占比 ${investmentRatio.toFixed(0)}%，${
      cashRatio >= 20 && cashRatio <= 40
        ? '配置合理'
        : cashRatio < 20
        ? '建议增加现金储备'
        : '现金比例偏高'
    }`;
  })();

  const volatilityDesc = (() => {
    const { standardDeviation, level } = healthScore.volatilityScore;
    if (level === 'A' || level === 'B+')
      return `资产波动稳定，标准差 ${standardDeviation}%，控制良好`;
    return `${currentMonth}月波动 ${standardDeviation}% 超出正常范围，建议关注大额支出原因`;
  })();

  const completenessDesc = completenessOk
    ? `本月已记录归因，本年度${currentMonth}个月中有 ${recordedMonths} 个月完整记录`
    : `本年度${currentMonth}个月中有 ${recordedMonths} 个月完整记录，建议补全缺失月份`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Activity size={18} style={{ color: primaryColor }} />
            <span className="font-bold text-gray-800">资产健康度分析</span>
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
            {healthScore.score}
          </div>
          <div className="text-sm text-gray-400">综合健康度评分</div>
        </div>

        <div className="space-y-3">
          <div
            className="rounded-xl p-3.5 border"
            style={{ backgroundColor: configColor.bg, borderColor: configColor.border }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-sm" style={{ color: configColor.text }}>
                配置评分 {healthScore.configScore.level}
              </span>
              <CheckCircle size={16} style={{ color: configColor.text }} />
            </div>
            <p className="text-xs" style={{ color: configColor.text }}>
              {configDesc}
            </p>
          </div>

          <div
            className="rounded-xl p-3.5 border"
            style={{
              backgroundColor: volatilityColor.bg,
              borderColor: volatilityColor.border,
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <span
                className="font-semibold text-sm"
                style={{ color: volatilityColor.text }}
              >
                波动控制 {healthScore.volatilityScore.level}
              </span>
              {healthScore.volatilityScore.level === 'C' ||
              healthScore.volatilityScore.level === 'D' ? (
                <AlertTriangle size={16} style={{ color: volatilityColor.text }} />
              ) : (
                <CheckCircle size={16} style={{ color: volatilityColor.text }} />
              )}
            </div>
            <p className="text-xs" style={{ color: volatilityColor.text }}>
              {volatilityDesc}
            </p>
          </div>

          <div
            className="rounded-xl p-3.5 border"
            style={{
              backgroundColor: completenessColor.bg,
              borderColor: completenessColor.border,
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <span
                className="font-semibold text-sm"
                style={{ color: completenessColor.text }}
              >
                归因完整 {healthScore.attributionCompleteness}%
              </span>
              <CheckCircle size={16} style={{ color: completenessColor.text }} />
            </div>
            <p className="text-xs" style={{ color: completenessColor.text }}>
              {completenessDesc}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}