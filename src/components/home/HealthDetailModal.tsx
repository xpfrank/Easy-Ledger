import { useMemo, useState } from 'react';
import { X, Activity, ChevronDown, BarChart2, Info } from 'lucide-react';
import type { HealthScore } from '@/types';
import {
  getReferenceIntervals,
  getIgnoredSuggestions,
  estimateMonthlyExpense,
  getAllAttributions,
} from '@/lib/storage';
import {
  CATEGORY_KEYS,
  CATEGORY_META,
  getCategoryPercentages,
  getIntervalStatus,
  NEUTRAL_STATUS_LABEL,
  generateOptimizationSuggestions,
  type AssetCategoryKey,
} from '@/lib/allocation-config';

interface HealthDetailModalProps {
  healthScore: HealthScore;
  primaryColor: string;
  onClose: () => void;
  onAdjustIntervals?: () => void;
  onAdjustCategoryInterval?: (category: AssetCategoryKey) => void;
  onViewTrend?: () => void;
  currentAllocations?: {
    cash: number;
    stable: number;
    invest: number;
    insure: number;
  };
  hideBalance?: boolean;
  baseCurrencySymbol?: string;
}

/** 状态标签配色 */
const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  below: { bg: '#e8f5ff', color: '#0b6eb5' },
  above: { bg: '#fff3e6', color: '#c57a00' },
  within: { bg: '#e8faf2', color: '#0f7a48' },
  empty: { bg: '#f3f4f6', color: '#9ca3af' },
};

/** 进度条 + 区间标记 */
function ProgressBarWithRange({
  value,
  min,
  max,
  color,
}: {
  value: number;
  min: number;
  max: number;
  color: string;
}) {
  return (
    <div className="relative h-[6px] w-full bg-gray-100 rounded-full overflow-visible">
      <div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ width: `${Math.min(value, 100)}%`, backgroundColor: color }}
      />
      <div
        className="absolute top-[-3px] bottom-[-3px] w-[1.5px] bg-gray-400/70 rounded-full"
        style={{ left: `${Math.min(min, 100)}%` }}
      />
      <div
        className="absolute top-[-3px] bottom-[-3px] w-[1.5px] bg-gray-400/70 rounded-full"
        style={{ left: `${Math.min(max, 100)}%` }}
      />
    </div>
  );
}

/** 迷你波动趋势柱状图（基于归因记录的 changePercent） */
function MiniVolatilityBar({ primaryColor }: { primaryColor: string }) {
  const attributions = getAllAttributions();
  const sorted = [...attributions].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });
  const recent = sorted.slice(-12);

  if (recent.length < 2) {
    return <span className="text-[10px] text-gray-300">—</span>;
  }

  const rates = recent.map((a) => a.changePercent);
  const maxRate = Math.max(...rates, 1);
  const minRate = Math.min(...rates, -1);
  const range = maxRate - minRate || 1;

  return (
    <div className="flex items-end gap-[2px] h-6">
      {recent.map((a, i) => {
        const normalized = ((a.changePercent - minRate) / range) * 100;
        const height = Math.max(normalized, 10);
        const isLast = i === recent.length - 1;
        const isNeg = a.changePercent < 0;
        return (
          <div
            key={`${a.year}-${a.month}`}
            className="flex-1 rounded-t-[2px]"
            style={{
              height: `${height}%`,
              backgroundColor: isLast ? primaryColor : isNeg ? '#e8a87a40' : `${primaryColor}40`,
              minWidth: 3,
            }}
          />
        );
      })}
    </div>
  );
}

export function HealthDetailModal({
  healthScore,
  primaryColor,
  onClose,
  onAdjustIntervals,
  onAdjustCategoryInterval,
  onViewTrend,
  currentAllocations,
  hideBalance = false,
}: HealthDetailModalProps) {
  const intervals = getReferenceIntervals();
  const [ignored] = useState(getIgnoredSuggestions());
  const [showNormal, setShowNormal] = useState(false);
  const [showFormula, setShowFormula] = useState(false);
  const monthlyExpense = estimateMonthlyExpense();

  const configRows = useMemo(() => {
    if (!currentAllocations) return null;
    const total = CATEGORY_KEYS.reduce((s, k) => s + currentAllocations[k], 0);
    if (total === 0) return null;
    const pcts = getCategoryPercentages(currentAllocations);
    return CATEGORY_KEYS.map((key) => {
      const { min, max } = intervals[key];
      const status = getIntervalStatus(pcts[key], min, max, currentAllocations[key] > 0);
      return { key, label: CATEGORY_META[key].shortLabel, color: CATEGORY_META[key].color, pct: pcts[key], min, max, status };
    });
  }, [currentAllocations, intervals]);

  const suggestions = useMemo(() => {
    if (!currentAllocations) return [];
    return generateOptimizationSuggestions(currentAllocations, intervals, ignored, monthlyExpense);
  }, [currentAllocations, intervals, ignored, monthlyExpense]);

  const anomalyRows = configRows?.filter((r) => r.status === 'below' || r.status === 'above') || [];
  const normalRows = configRows?.filter((r) => r.status === 'within' || r.status === 'empty') || [];

  const getSuggestionForCategory = (key: AssetCategoryKey) =>
    suggestions.find((s) => s.category === key);

  const conclusionText = useMemo(() => {
    const anomalyCount = anomalyRows.length;
    if (anomalyCount === 0) return '所有配置类别均在参考区间内';
    if (anomalyCount === 1) return '有 1 项配置偏离参考区间';
    return `有 ${anomalyCount} 项配置偏离参考区间`;
  }, [anomalyRows]);

  const scoreWeights = [
    { label: '配置结构', weight: 40, score: healthScore.configScore.score },
    { label: '波动控制', weight: 30, score: healthScore.volatilityScore.score },
    { label: '归因完整', weight: 30, score: healthScore.attributionCompleteness },
  ];

  const sd = healthScore.volatilityScore.standardDeviation;
  const volatilityLevel = sd <= 2 ? '很平稳' : sd <= 5 ? '较平稳' : sd <= 10 ? '适中' : '偏大';
  const volatilityColor = sd <= 2 ? '#0f7a48' : sd <= 5 ? '#0b6eb5' : sd <= 10 ? '#8a5e00' : '#c57a00';
  const volatilityBg = sd <= 2 ? '#e8faf2' : sd <= 5 ? '#e8f5ff' : sd <= 10 ? '#fff8e6' : '#fff3e6';

  const barColor = sd <= 20 ? '#22c55e' : sd <= 40 ? '#3b82f6' : sd <= 60 ? '#eab308' : sd <= 80 ? '#f97316' : '#ef4444';

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />

      <div
        className="relative bg-white rounded-t-[22px] shadow-2xl w-full max-w-sm flex flex-col overflow-hidden"
        style={{ maxHeight: '85dvh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── 顶部标题 ── */}
        <div className="shrink-0 px-5 pt-3 pb-1.5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: `${primaryColor}15` }}>
                <Activity size={16} style={{ color: primaryColor }} />
              </div>
              <span className="text-base font-bold text-gray-800">资产健康分析</span>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
              <X size={16} className="text-gray-500" />
            </button>
          </div>
          <p className="text-[12px] text-gray-400 mt-0.5">基于你设定的参考区间计算，不代表标准答案</p>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-2 space-y-2">
          {/* ── 综合分：居中大数字 + 右侧三条进度条 ── */}
          <div className="rounded-xl p-3 flex gap-3 items-center" style={{ background: `${primaryColor}10` }}>
            <div className="flex flex-col items-center justify-center shrink-0 w-16 relative">
              <div className="text-[32px] font-extrabold leading-none" style={{ color: primaryColor }}>
                {hideBalance ? '**' : healthScore.score}
              </div>
              <div className="flex items-center gap-0.5 mt-0.5">
                <span className="text-[11px] text-gray-500">综合分</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setShowFormula(!showFormula); }}
                  className="w-3.5 h-3.5 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${primaryColor}15` }}
                >
                  <Info size={9} style={{ color: primaryColor }} />
                </button>
              </div>

            </div>
            <div className="flex-1 space-y-1">
              {scoreWeights.map((w) => (
                <div key={w.label} className="flex items-center gap-1.5">
                  <span className="text-[11px] text-gray-500 w-12 shrink-0">{w.label}</span>
                  <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${w.score}%`, backgroundColor: primaryColor }} />
                  </div>
                  <span className="text-[11px] font-bold w-5 text-right shrink-0">{hideBalance ? '**' : w.score}</span>
                </div>
              ))}

            </div>
          </div>

          {/* ── 一句话结论 ── */}
          <p className="text-[13px] text-gray-600 font-medium px-0.5">{conclusionText}</p>

          {/* ── 异常项 ── */}
          {anomalyRows.length > 0 && (
            <div className="space-y-1.5">
              {anomalyRows.map((row) => {
                const sug = getSuggestionForCategory(row.key);
                const style = STATUS_STYLES[row.status] || STATUS_STYLES.empty;
                return (
                  <div key={row.key} className="rounded-xl border border-gray-100 p-2.5 bg-white">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: row.color }} />
                      <span className="text-[13px] font-bold text-gray-800 flex-1">{row.label}</span>
                      {/* 百分比胶囊 */}
                      <span
                        className="text-[12px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: `${row.color}12`, color: row.color }}
                      >
                        {hideBalance ? '***' : `${row.pct}%`}
                      </span>
                      {/* 状态标签：不同颜色 */}
                      <span
                        className="text-[11px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: style.bg, color: style.color }}
                      >
                        {NEUTRAL_STATUS_LABEL[row.status]}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[11px] text-gray-400 shrink-0">{hideBalance ? '区间 ***' : `区间 ${row.min}–${row.max}%`}</span>
                      <div className="flex-1">
                        <ProgressBarWithRange value={row.pct} min={row.min} max={row.max} color={row.color} />
                      </div>
                    </div>
                    {sug && (
                      <p className="text-[13px] text-gray-500 leading-relaxed">· {sug.text}</p>
                    )}
                    {onAdjustCategoryInterval && (
                      <button
                        type="button"
                        className="text-[12px] font-bold mt-0.5"
                        style={{ color: primaryColor }}
                        onClick={() => onAdjustCategoryInterval(row.key)}
                      >
                        调整该类参考区间 ›
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── 正常项折叠 ── */}
          {normalRows.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowNormal(!showNormal)}
                className="flex items-center gap-1 text-[13px] text-gray-400 font-medium"
              >
                <ChevronDown size={13} className={`transition-transform ${showNormal ? 'rotate-180' : ''}`} />
                正常项（{normalRows.length}）
              </button>
              {showNormal && (
                <div className="mt-1.5 space-y-1">
                  {normalRows.map((row) => (
                    <div key={row.key} className="rounded-lg bg-gray-50 px-2.5 py-1.5">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: row.color }} />
                        <span className="text-[13px] font-semibold text-gray-700 flex-1">{row.label}</span>
                        <span
                          className="text-[12px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ backgroundColor: `${row.color}12`, color: row.color }}
                        >
                          {hideBalance ? '***' : `${row.pct}%`}
                        </span>
                      </div>
                      <ProgressBarWithRange value={row.pct} min={row.min} max={row.max} color={row.color} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── 波动控制 ── */}
          <div className="rounded-xl border border-gray-100 p-2.5 bg-white">
            <div className="flex items-center gap-1.5 mb-1.5">
              <BarChart2 size={13} style={{ color: primaryColor }} />
              <span className="text-[13px] font-bold text-gray-800">波动控制</span>
              <span
                className="text-[11px] font-semibold px-1.5 py-[1px] rounded-full ml-auto"
                style={{ backgroundColor: volatilityBg, color: volatilityColor }}
              >
                {volatilityLevel}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[11px] text-gray-400">标准差</span>
                  <span className="text-[14px] font-extrabold" style={{ color: primaryColor }}>{hideBalance ? '***' : `${sd}%`}</span>
                </div>
                <div className="relative h-[5px] bg-gray-100 rounded-full">
                  <div
                    className="absolute top-[-2px] bottom-[-2px] w-[3px] rounded-full"
                    style={{
                      left: `${Math.min(sd, 100)}%`,
                      backgroundColor: barColor,
                    }}
                  />
                  {[20, 40, 60, 80].map(m => (
                    <div key={m} className="absolute top-[-2px] bottom-[-2px] w-[1px] bg-gray-300" style={{ left: `${m}%` }} />
                  ))}
                </div>
                <div className="flex justify-between mt-0.5">
                  {[0, 20, 40, 60, 80, 100].map(m => (
                    <span key={m} className="text-[9px] text-gray-300">{m}%</span>
                  ))}
                </div>
              </div>
              <div className="w-[70px] shrink-0">
                <MiniVolatilityBar primaryColor={primaryColor} />
                <p className="text-[9px] text-gray-300 text-center mt-0.5">近12月趋势</p>
              </div>
            </div>

            {onViewTrend && (
              <button
                type="button"
                className="text-[12px] font-bold mt-1"
                style={{ color: primaryColor }}
                onClick={onViewTrend}
              >
                查看完整波动曲线 ›
              </button>
            )}
          </div>
        </div>

        {/* ── 底部按钮 ── */}
        <div
          className="shrink-0 px-4 pt-1.5 pb-2 flex flex-col gap-1.5 border-t border-gray-100"
          style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
        >
          {onAdjustIntervals && (
            <button
              type="button"
              onClick={onAdjustIntervals}
              className="w-full py-2 rounded-xl text-[14px] font-bold border-2"
              style={{ borderColor: primaryColor, color: primaryColor }}
            >
              调整参考区间
            </button>
          )}
          <button
            onClick={onClose}
            className="w-full py-2 rounded-xl text-[14px] font-bold text-white"
            style={{ background: `linear-gradient(135deg, ${primaryColor}, #0b6eb5)` }}
          >
            知道了
          </button>
        </div>
      </div>

      {/* 计分说明弹窗 */}
      {showFormula && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-6" onClick={() => setShowFormula(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xs p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[13px] font-bold text-gray-800">综合分计算方式</span>
              <button onClick={() => setShowFormula(false)} className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                <X size={12} className="text-gray-500" />
              </button>
            </div>
            <p className="text-[14px] font-bold text-gray-700 mb-3 text-center" style={{ color: primaryColor }}>
              综合分 = 配置×40% + 波动×30% + 归因×30%
            </p>
            <div className="space-y-2.5">
              <div className="rounded-lg bg-gray-50 p-2.5">
                <p className="text-[13px] font-bold text-gray-700 mb-0.5">配置结构（满分100，权重40%）</p>
                <p className="text-[12px] text-gray-500 leading-relaxed">四类资产各25分：在参考区间内得100分，偏离按 (偏离百分点×4) 扣分，最低0分。总分 = 四类平均。</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-2.5">
                <p className="text-[13px] font-bold text-gray-700 mb-0.5">波动控制（满分100，权重30%）</p>
                <p className="text-[12px] text-gray-500 leading-relaxed">σ≤2%→100分，2–5%→80–100分，5–10%→60–80分，10–20%→40–60分，&gt;20%→20分</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-2.5">
                <p className="text-[13px] font-bold text-gray-700 mb-0.5">归因完整（满分100，权重30%）</p>
                <p className="text-[12px] text-gray-500 leading-relaxed">已归因月份÷应归因月份(1月~当月)×100，每年1月重置</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowFormula(false)}
              className="w-full py-2 rounded-xl text-[13px] font-bold text-white mt-4"
              style={{ background: `linear-gradient(135deg, ${primaryColor}, #0b6eb5)` }}
            >
              知道了
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
