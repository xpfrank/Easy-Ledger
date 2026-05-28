import { useMemo, useState } from 'react';
import { ChevronRight, Settings2, Droplets, Landmark, TrendingUp, Shield, Activity, BarChart2, FileText, Plus, Lock, Info, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { calculateNetWorth } from '@/lib/calculator';
import type { HealthScore } from '@/types';
import { getLifeStage, getReferenceIntervals, getAllAttributions, getAllYearlyAttributions, getAccountsForMonth, formatAmountNoSymbol } from '@/lib/storage';
import {
  CATEGORY_KEYS,
  CATEGORY_META,
  LIFE_STAGE_INTERVALS,
  getCategoryPercentages,
  getIntervalStatus,
  NEUTRAL_STATUS_LABEL,
  type IntervalStatus,
} from '@/lib/allocation-config';
import type { LifeStage } from '@/types';

/** 驾驶舱迷你波动柱状图 */
function CockpitMiniBar({ primaryColor }: { primaryColor: string }) {
  const attributions = getAllAttributions();
  const sorted = [...attributions].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });
  const recent = sorted.slice(-6);

  if (recent.length < 2) {
    return <span className="text-[8px] text-gray-300 shrink-0">—</span>;
  }

  const rates = recent.map((a) => a.changePercent);
  const maxR = Math.max(...rates, 0.1);
  const minR = Math.min(...rates, -0.1);
  const range = maxR - minR || 1;

  return (
    <div className="flex items-end gap-[1px] h-5 w-[36px] shrink-0">
      {recent.map((a) => {
        const normalized = ((a.changePercent - minR) / range) * 100;
        const height = Math.max(normalized, 10);
        const isNeg = a.changePercent < 0;
        return (
          <div
            key={`${a.year}-${a.month}`}
            className="flex-1 rounded-t-[1px]"
            style={{
              height: `${height}%`,
              backgroundColor: isNeg ? '#e8a87a60' : `${primaryColor}60`,
              minWidth: 2,
            }}
          />
        );
      })}
    </div>
  );
}

interface AssetCockpitCardProps {
  healthScore: HealthScore;
  scoreChange: number;
  primaryColor: string;
  onClick?: () => void;
  onStageClick?: () => void;
  onIntervalSettingsClick?: () => void;
  onClassifyClick?: () => void;
  onAddAccount?: () => void;
  classifiedCount?: number;
  totalCount?: number;
  isEmpty?: boolean;
  hideBalance?: boolean;
  currentAllocations?: {
    cash: number;
    stable: number;
    invest: number;
    insure: number;
  };
}

const STATUS_STYLE: Record<IntervalStatus, { bg: string; text: string }> = {
  below: { bg: '#e8f5ff', text: '#0b6eb5' },
  within: { bg: '#e8faf2', text: '#0f7a48' },
  above: { bg: '#fff3e6', text: '#c57a00' },
  empty: { bg: '#f9fafb', text: '#9ca3af' },
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
    <div className="relative h-[7px] w-full bg-gray-100 rounded-full overflow-visible">
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

const MONTH_NAMES = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

/** 分类图标映射（线性风格，替代 emoji） */
const CATEGORY_ICONS: Record<string, typeof Droplets> = {
  cash: Droplets,
  stable: Landmark,
  invest: TrendingUp,
  insure: Shield,
};

export function AssetCockpitCard({
  healthScore,
  scoreChange,
  primaryColor,
  onClick,
  onStageClick,
  onIntervalSettingsClick,
  onClassifyClick,
  onAddAccount,
  classifiedCount = 0,
  totalCount = 0,
  isEmpty = false,
  hideBalance = false,
  currentAllocations,
}: AssetCockpitCardProps) {
  const lifeStage = getLifeStage() as LifeStage;
  const stageMeta = LIFE_STAGE_INTERVALS[lifeStage];
  const intervals = getReferenceIntervals();
  const [attrTab, setAttrTab] = useState<'monthly' | 'yearly'>('monthly');
  const [showFormula, setShowFormula] = useState(false);
  const allAttributions = getAllAttributions();

  const nextLevelScore = useMemo(() => {
    const levels = [
      { level: 'A' as const, min: 90 },
      { level: 'B+' as const, min: 80 },
      { level: 'B' as const, min: 70 },
      { level: 'C' as const, min: 60 },
      { level: 'D' as const, min: 0 },
    ];
    const currentIdx = levels.findIndex((l) => l.level === healthScore.level);
    if (currentIdx <= 0) return null;
    return { level: levels[currentIdx - 1].level, diff: levels[currentIdx - 1].min - healthScore.score };
  }, [healthScore]);

  const needsClassify = classifiedCount < totalCount && totalCount > 0;

  const hasAllocations =
    currentAllocations &&
    (currentAllocations.cash > 0 ||
      currentAllocations.stable > 0 ||
      currentAllocations.invest > 0 ||
      currentAllocations.insure > 0);

  const configBreakdown = useMemo(() => {
    if (!currentAllocations || !hasAllocations) return null;
    const pcts = getCategoryPercentages(currentAllocations);
    return CATEGORY_KEYS.map((key) => {
      const { min, max } = intervals[key];
      const status = getIntervalStatus(pcts[key], min, max, currentAllocations[key] > 0);
      return {
        key,
        label: CATEGORY_META[key].shortLabel,
        pct: pcts[key],
        target: `${min}–${max}%`,
        color: CATEGORY_META[key].color,
        status,
        min,
        max,
      };
    });
  }, [currentAllocations, hasAllocations, intervals, configKey]);

  // ── 月度归因数据：从最早有记录的月份起，保留中间月份占位 ──
  const monthlyDots = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const all = getAllAttributions();

    // 有记录的月份集合
    const recordedSet = new Set<string>();
    all.forEach((a) => {
      recordedSet.add(`${a.year}-${a.month}`);
    });

    // 找到最早有记录的月份
    let startYear = currentYear;
    let startMonth = currentMonth;
    if (recordedSet.size > 0) {
      const earliest = Array.from(recordedSet).map((k) => {
        const [y, m] = k.split('-').map(Number);
        return y * 100 + m;
      }).sort((a, b) => a - b)[0];
      startYear = Math.floor(earliest / 100);
      startMonth = earliest % 100;
    } else {
      // 无记录，只展示当前月+未来月
      startYear = currentYear;
      startMonth = currentMonth;
    }

    // 从最早月到当前月+1（未来月），逐月生成
    type Dot = { month: number; year: number; done: boolean; isCurrent: boolean; isFuture: boolean };
    const dots: Dot[] = [];
    let y = startYear;
    let m = startMonth;

    while (true) {
      const isFuture = y > currentYear || (y === currentYear && m > currentMonth);
      const isCurrent = y === currentYear && m === currentMonth;
      const key = `${y}-${m}`;
      const done = recordedSet.has(key);

      dots.push({ year: y, month: m, done, isCurrent, isFuture });

      // 到当前月+1就停
      if (isFuture) break;

      m++;
      if (m > 12) { m = 1; y++; }
    }

    // 连续归因月数（从当前月往前）
    let streak = 0;
    for (let i = dots.length - 1; i >= 0; i--) {
      const d = dots[i];
      if (d.isFuture) continue;
      if (d.isCurrent && !d.done) break;
      if (d.done) streak++;
      else break;
    }

    // 本年已过月份中漏记数
    const pastMonthsThisYear = dots.filter(
      (d) => d.year === currentYear && !d.isFuture && !d.isCurrent
    );
    const missed = pastMonthsThisYear.filter((d) => !d.done).length;

    const hasAnyData = all.length > 0;

    return { dots, streak, missed, hasAnyData };
  }, []);

  // ── 年度归因数据（只展示已有数据的年份） ──
  const yearlyBadges = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const allYearly = getAllYearlyAttributions();
    const allMonthly = getAllAttributions();

    // 收集所有有数据的年份
    const yearsWithData = new Set<number>();
    allYearly.forEach((a) => yearsWithData.add(a.year));
    allMonthly.forEach((a) => yearsWithData.add(a.year));
    // 至少展示当前年和前一年
    yearsWithData.add(currentYear);
    if (yearsWithData.size < 2) yearsWithData.add(currentYear - 1);

    const sortedYears = Array.from(yearsWithData).sort((a, b) => b - a);

    const badges: { year: number; done: boolean; monthCount: number; isCurrent: boolean }[] = [];
    for (const y of sortedYears) {
      const yearly = allYearly.find((a) => a.year === y);
      const monthlyCount = allMonthly.filter((a) => a.year === y).length;
      const done = !!yearly || monthlyCount === 12;
      badges.push({ year: y, done, monthCount: done ? (yearly ? 12 : monthlyCount) : monthlyCount, isCurrent: y === currentYear });
    }

    const totalDone = badges.filter((b) => b.done).length;
    const startYear = sortedYears[sortedYears.length - 1] || currentYear;
    const totalYears = sortedYears.length;
    const rate = totalYears > 0 ? Math.round((totalDone / totalYears) * 100) : 0;
    const hasAnyData = allYearly.length > 0 || allMonthly.length > 0;

    return { badges, totalDone, startYear, rate, hasAnyData };
  }, []);

  const handleViewDetail = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (needsClassify && onClassifyClick) onClassifyClick();
    else onClick?.();
  };

  // ── 空状态：无账户 ──
  if (isEmpty) {
    return (
      <Card
        className="overflow-hidden relative"
        style={{
          background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
          border: '1px solid #d0e3f5',
          borderRadius: '16px',
        }}
      >
        <CardContent className="p-0">
          <div className="flex items-start justify-between px-[18px] pt-3 pb-0 mb-3">
            <div>
              <div className="text-[11px] font-bold text-[#8fa3b8] tracking-[0.5px] uppercase mb-0.5">
                资产驾驶舱
              </div>
              <div className="text-[15px] font-bold text-[#0f1923]">添加账户后开始评分</div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={(e) => { e.stopPropagation(); onIntervalSettingsClick?.(); }}
                className="w-8 h-8 rounded-[10px] bg-gray-100 flex items-center justify-center active:bg-gray-200"
                aria-label="参考区间设置"
              >
                <Settings2 size={15} className="text-gray-600" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onStageClick?.(); }}
                className="inline-flex items-center gap-1 bg-[#e8faf2] border border-[#9fe8c8] text-[#0f7a48] text-[11px] font-bold px-2 py-1 rounded-[10px]"
              >
                {stageMeta.emoji} {stageMeta.label}
                <span className="text-[9px] opacity-70">阶段</span>
              </button>
            </div>
          </div>

          {/* 空状态引导 */}
          <div className="px-[18px] pb-4 flex flex-col items-center justify-center py-6">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <Plus size={24} className="text-gray-400" />
            </div>
            <p className="text-[12px] text-gray-400 text-center mb-3">还没有账户，添加一个吧</p>
            <button
              onClick={(e) => { e.stopPropagation(); onAddAccount?.(); }}
              className="text-[12px] font-bold px-4 py-2 rounded-xl text-white"
              style={{ background: `linear-gradient(135deg, ${primaryColor}, #0b6eb5)` }}
            >
              添加账户
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className="overflow-hidden relative"
      style={{
        background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
        border: '1px solid #d0e3f5',
        borderRadius: '16px',
      }}
    >
      <CardContent className="p-0">
        {/* ── 标题栏 ── */}
        <div className="flex items-start justify-between px-[18px] pt-3 pb-0 mb-2.5">
          <div>
            <div className="text-[15px] font-bold text-[#0f1923]">
              资产驾驶舱
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onIntervalSettingsClick?.(); }}
              className="w-8 h-8 rounded-[10px] bg-gray-100 flex items-center justify-center active:bg-gray-200"
              aria-label="参考区间设置"
            >
              <Settings2 size={15} className="text-gray-600" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onStageClick?.(); }}
              className="inline-flex items-center gap-1 bg-[#e8faf2] border border-[#9fe8c8] text-[#0f7a48] text-[11px] font-bold px-2 py-1 rounded-[10px]"
            >
              {stageMeta.emoji} {stageMeta.label}
              <span className="text-[9px] opacity-70">阶段</span>
            </button>
          </div>
        </div>


        {/* ── 分数环 + 变化 ── */}
        <div className="flex items-center gap-3 px-[18px] mb-3">
          <div className="relative w-[84px] h-[84px] shrink-0">
            <svg viewBox="0 0 90 90" className="w-full h-full">
              <defs>
                <linearGradient id={`cockpitRingGrad-${healthScore.score}`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#38b6ff" />
                  <stop offset="100%" stopColor={primaryColor} />
                </linearGradient>
              </defs>
              <circle cx="45" cy="45" r="36" stroke="#edf2f7" strokeWidth="7" strokeLinecap="round" fill="none" />
              <circle
                cx="45" cy="45" r="36"
                stroke={`url(#cockpitRingGrad-${healthScore.score})`}
                strokeWidth="7" strokeLinecap="round" fill="none"
                transform="rotate(-90 45 45)"
                strokeDasharray="226.2"
                strokeDashoffset={226.2 - (healthScore.score / 100) * 226.2}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[26px] font-extrabold text-[#0b6eb5] leading-none">{hideBalance ? '**' : healthScore.score}</span>
              <div className="flex items-center gap-0.5 mt-0.5 relative">
                <span className="text-[10px] text-[#8fa3b8] font-semibold">/100</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setShowFormula(!showFormula); }}
                  className="w-3 h-3 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: '#e8f5ff' }}
                >
                  <Info size={8} className="text-[#0b6eb5]" />
                </button>

              </div>
            </div>
          </div>

          <div className="flex-1 min-w-0 flex items-center justify-between">
            <div>
              <div className="inline-flex items-center gap-1 bg-[#e8faf2] border border-[#9fe8c8] text-[#0f7a48] text-[11px] font-bold px-2 py-0.5 rounded-lg mb-1">
                {scoreChange > 0 ? '↑' : scoreChange < 0 ? '↓' : '→'} 较上月 {hideBalance ? '**' : `${scoreChange > 0 ? '+' : ''}${scoreChange}分`}
              </div>
              {nextLevelScore ? (
                <div className="text-[12px] text-[#4a5568]">
                  {hideBalance ? '距离下一等级还差 **分' : <>距离 <span className="text-[#0b6eb5] font-bold">{nextLevelScore.level}</span> 还差{' '}<span className="text-[#0b6eb5] font-bold">{nextLevelScore.diff}分</span></>}
                </div>
              ) : (
                <div className="text-[12px] text-[#4a5568]">当前等级 {healthScore.level}</div>
              )}
            </div>
            <button
              onClick={handleViewDetail}
              className="flex items-center gap-1 shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-medium"
              style={{ color: primaryColor, backgroundColor: `${primaryColor}12` }}
            >
              {needsClassify ? (
                <>{totalCount - classifiedCount}个账户待分类 <ChevronRight size={14} /></>
              ) : (
                <>查看健康分析 <ChevronRight size={14} /></>
              )}
            </button>
          </div>
        </div>

        {/* ── 配置结构（带区间标记进度条） ── */}
        <div className="px-[18px] mb-2.5">
          <div className="bg-[#f8fbfe] border border-[#e4ecf3] rounded-[10px] px-[13px] py-2.5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Activity size={12} className="text-amber-500" />
                <span className="text-[12.5px] font-semibold text-[#0f1923]">配置结构</span>
                <span className="text-[10px] text-gray-400">（相对你的参考区间）</span>
              </div>
              <span className="text-[12px] font-extrabold text-[#0b6eb5]">{healthScore.configScore.level}</span>
            </div>
            {configBreakdown ? (
              <div className="space-y-2">
                {configBreakdown.map((item) => {
                  const style = STATUS_STYLE[item.status];
                  const IconComp = CATEGORY_ICONS[item.key];
                  return (
                    <div key={item.key} className="flex items-center gap-2">
                      {IconComp && <IconComp size={12} className="shrink-0" style={{ color: item.color }} />}
                      <span className="text-[10px] text-gray-500 w-8 shrink-0 text-left">{item.label}</span>
                      <div className="flex-1 min-w-0">
                        <ProgressBarWithRange value={item.pct} min={item.min} max={item.max} color={item.color} />
                      </div>
                      <span className="text-[11px] font-bold text-[#0f1923] w-10 text-left shrink-0 tabular-nums">{hideBalance ? '***' : `${item.pct}%`}</span>
                      <span
                        className="text-[9px] font-semibold px-1.5 py-px rounded w-20 text-center shrink-0"
                        style={{ backgroundColor: style.bg, color: style.text }}
                      >
                        {NEUTRAL_STATUS_LABEL[item.status]}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[11px] text-gray-500 leading-relaxed">
                完成账户分类后，将按你设定的参考区间对比四类资产占比。
              </p>
            )}
          </div>
        </div>

        {/* ── 波动控制 ── */}
        <div className="px-[18px] mb-2.5">
          <div className="bg-[#f8fbfe] border border-[#e4ecf3] rounded-[10px] px-[13px] py-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <BarChart2 size={12} className="text-emerald-500" />
                <span className="text-[12.5px] font-semibold text-[#0f1923]">波动控制</span>
              </div>
              <span
                className="text-[10px] font-semibold px-1.5 py-[1px] rounded-full"
                style={{
                  backgroundColor: healthScore.volatilityScore.standardDeviation <= 2 ? '#e8faf2' : healthScore.volatilityScore.standardDeviation <= 5 ? '#e8f5ff' : healthScore.volatilityScore.standardDeviation <= 10 ? '#fff8e6' : '#fff3e6',
                  color: healthScore.volatilityScore.standardDeviation <= 2 ? '#0f7a48' : healthScore.volatilityScore.standardDeviation <= 5 ? '#0b6eb5' : healthScore.volatilityScore.standardDeviation <= 10 ? '#8a5e00' : '#c57a00',
                }}
              >
                {healthScore.volatilityScore.standardDeviation <= 2
                  ? '波动很小'
                  : healthScore.volatilityScore.standardDeviation <= 5
                  ? '波动较小'
                  : healthScore.volatilityScore.standardDeviation <= 10
                  ? '波动适中'
                  : '波动偏大'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {(() => {
                const now = new Date();
                const curY = now.getFullYear();
                const curM = now.getMonth() + 1;
                const prevM = curM === 1 ? 12 : curM - 1;
                const prevY = curM === 1 ? curY - 1 : curY;
                const curNW = calculateNetWorth(getAccountsForMonth(curY, curM).filter(a => !a.isHidden), curY, curM);
                const prevNW = calculateNetWorth(getAccountsForMonth(prevY, prevM).filter(a => !a.isHidden), prevY, prevM);
                const changePct = prevNW !== 0 ? ((curNW - prevNW) / Math.abs(prevNW)) * 100 : 0;
                const isUp = changePct >= 0;
                const sd = healthScore.volatilityScore.standardDeviation;
                const marks = [0, 20, 40, 60, 80, 100];
                const barColor = sd <= 20 ? '#22c55e' : sd <= 40 ? '#3b82f6' : sd <= 60 ? '#eab308' : sd <= 80 ? '#f97316' : '#ef4444';
                return (
                  <>
                    <div className="shrink-0 text-center">
                      <div className="text-[16px] font-extrabold leading-none" style={{ color: isUp ? primaryColor : '#c57a00' }}>
                        {hideBalance ? '***' : `${isUp ? '+' : ''}${changePct.toFixed(1)}%`}
                      </div>
                      <div className="text-[8px] text-gray-400 mt-0.5">本月波动</div>
                    </div>
                    <div className="shrink-0 text-center">
                      <div className="text-[12px] font-bold text-gray-400">
                        {hideBalance ? '***' : `${healthScore.volatilityScore.standardDeviation}%`}
                      </div>
                      <div className="text-[8px] text-gray-300 mt-0.5">标准差</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="relative h-[5px] bg-gray-200 rounded-full">
                        <div
                          className="absolute top-[-2px] bottom-[-2px] w-[3px] rounded-full"
                          style={{ left: `${Math.min(sd, 100)}%`, backgroundColor: barColor }}
                        />
                        {marks.map(m => (
                          <div key={m} className={`absolute top-[-2px] bottom-[-2px] w-[1px] ${m === 0 || m === 100 ? "bg-gray-200" : "bg-gray-300"}`} style={{ left: `${m}%` }} />
                        ))}
                      </div>
                      <div className="flex justify-between mt-0.5">
                        {marks.map(m => (
                          <span key={m} className="text-[7px] text-gray-300">{m}%</span>
                        ))}
                      </div>
                    </div>
                  </>
                );
              })()}
              <CockpitMiniBar primaryColor={primaryColor} />
            </div>
          </div>
        </div>

        {/* ── 归因记录（月度·年度 Tab） ── */}
        <div className="px-[18px] mb-3.5">
          <div className="bg-[#f8fbfe] border border-[#e4ecf3] rounded-[10px] px-[13px] py-2.5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FileText size={12} className="text-sky-500" />
                <span className="text-[12.5px] font-semibold text-[#0f1923]">归因记录</span>
              </div>
              <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                <button
                  onClick={(e) => { e.stopPropagation(); setAttrTab('monthly'); }}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition-colors ${
                    attrTab === 'monthly' ? 'bg-white text-[#0f1923] shadow-sm' : 'text-gray-400'
                  }`}
                >
                  月度
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setAttrTab('yearly'); }}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition-colors ${
                    attrTab === 'yearly' ? 'bg-white text-[#0f1923] shadow-sm' : 'text-gray-400'
                  }`}
                >
                  年度
                </button>
              </div>
            </div>

            {attrTab === 'monthly' ? (
              monthlyDots.hasAnyData || monthlyDots.streak > 0 ? (
                <>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
                    {monthlyDots.dots.map((dot, i) => {
                      const key = `${dot.year}-${dot.month}`;
                      const prevDot = i > 0 ? monthlyDots.dots[i - 1] : null;
                      const showYearSep = prevDot && prevDot.year !== dot.year;
                      return (
                        <div key={key} className="flex items-center gap-2 shrink-0">
                          {/* 跨年标识 */}
                          {showYearSep && (
                            <span className="text-[9px] text-gray-300 font-bold px-1">{dot.year}</span>
                          )}
                          <div className="flex flex-col items-center gap-[3px]">
                            {dot.isFuture ? (
                              /* 待记录：主题色圆形 + 锁 */
                              <span
                                className="w-[22px] h-[22px] rounded-full flex items-center justify-center"
                                style={{ backgroundColor: `${primaryColor}15`, border: `1.5px dashed ${primaryColor}40` }}
                              >
                                <Lock size={10} style={{ color: primaryColor }} />
                              </span>
                            ) : (
                              <span
                                className="w-[22px] h-[22px] rounded-full flex items-center justify-center"
                                style={{
                                  backgroundColor: dot.done ? primaryColor : 'transparent',
                                  border: dot.isCurrent
                                    ? `2px solid ${primaryColor}`
                                    : dot.done
                                    ? 'none'
                                    : '1.5px solid #e4ecf3',
                                  boxShadow: dot.isCurrent ? `0 0 0 3px ${primaryColor}20` : 'none',
                                }}
                              >
                                {dot.done && (
                                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                    <path d="M2 5L4.5 7.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                )}
                              </span>
                            )}
                            <span className="text-[8px] text-gray-400">{MONTH_NAMES[dot.month - 1]}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-gray-400 text-center mt-1">
                    已连续归因 {monthlyDots.streak} 个月 · 本年漏记 {monthlyDots.missed} 个月
                  </p>
                </>
              ) : (
                <div className="flex flex-col items-center py-3">
                  <p className="text-[11px] text-gray-400 mb-1">暂无归因记录</p>
                  <p className="text-[10px] text-gray-300">记账后可在趋势页补充归因</p>
                </div>
              )
            ) : (
              yearlyBadges.hasAnyData ? (
                <>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
                    {yearlyBadges.badges.map((badge) => (
                      <div
                        key={badge.year}
                        className="shrink-0 flex flex-col items-center justify-center px-3 py-2 rounded-xl transition-all"
                        style={{
                          border: badge.done
                            ? badge.isCurrent ? `2px solid ${primaryColor}` : '2px solid transparent'
                            : '1.5px dashed #d1d5db',
                          backgroundColor: badge.done ? `${primaryColor}10` : '#f9fafb',
                        }}
                      >
                        {badge.done ? (
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="mb-0.5">
                            <circle cx="7" cy="7" r="6" fill={primaryColor} />
                            <path d="M4 7L6.5 9.5L10 5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          <span className="text-[13px] text-gray-300 mb-0.5">+</span>
                        )}
                        <span className="text-[11px] font-bold text-[#0f1923]">{badge.year}</span>
                        <span className="text-[9px] text-gray-400">
                          {badge.done ? `${badge.monthCount}月归因` : '待记录'}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-400 text-center mt-1.5">
                    历年归因 {yearlyBadges.totalDone} 次 · 起始年份 {yearlyBadges.startYear} · 完成率 {yearlyBadges.rate}%
                  </p>
                </>
              ) : (
                <div className="flex flex-col items-center py-3">
                  <p className="text-[11px] text-gray-400 mb-1">暂无年度归因记录</p>
                  <p className="text-[10px] text-gray-300">完成年度归因后将在此展示</p>
                </div>
              )
            )}
          </div>
        </div>
      </CardContent>
      {/* 计分说明弹窗 */}
      {showFormula && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6" onClick={() => setShowFormula(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xs p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[14px] font-bold text-gray-800">综合分计算方式</span>
              <button onClick={() => setShowFormula(false)} className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                <X size={12} className="text-gray-500" />
              </button>
            </div>
            <p className="text-[13px] font-bold text-[#0b6eb5] mb-3 text-center">
              综合分 = 配置×40% + 波动×30% + 归因×30%
            </p>
            <div className="space-y-2.5">
              <div className="rounded-lg bg-gray-50 p-2.5">
                <p className="text-[11px] font-bold text-gray-700 mb-0.5">配置结构（满分100，权重40%）</p>
                <p className="text-[10px] text-gray-500 leading-relaxed">四类资产各25分：在参考区间内得100分，偏离按 (偏离百分点×4) 扣分，最低0分。总分 = 四类平均。</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-2.5">
                <p className="text-[11px] font-bold text-gray-700 mb-0.5">波动控制（满分100，权重30%）</p>
                <p className="text-[10px] text-gray-500 leading-relaxed">σ≤2%→100分，2–5%→80–100分，5–10%→60–80分，10–20%→40–60分，&gt;20%→20分</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-2.5">
                <p className="text-[11px] font-bold text-gray-700 mb-0.5">归因完整（满分100，权重30%）</p>
                <p className="text-[10px] text-gray-500 leading-relaxed">已归因月份÷应归因月份(1月~当月)×100，每年1月重置</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowFormula(false)}
              className="w-full py-2 rounded-xl text-[12px] font-bold text-white mt-4"
              style={{ background: 'linear-gradient(135deg, #0b6eb5, #0b6eb5)' }}
            >
              知道了
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
