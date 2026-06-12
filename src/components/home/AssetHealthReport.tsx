import { useMemo, useCallback, useState } from 'react';
import {
  X, Download, TrendingUp, TrendingDown, Activity, BarChart4,
  Tags, Target, FileText,
} from 'lucide-react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area,
} from 'recharts';
import type { ThemeType } from '@/types';
import { THEMES, getCurrencyConfig } from '@/types';
import {
  getAccountsForMonth,
  getSettings,
  convertToBaseCurrency,
  getAllAttributions,
  getYearlyGoal,
  getAccountBalanceForMonth,
  getReferenceIntervals,
  getAttributionTagLabel,
  getAttributionTagEmoji,
  getYearlyAttributionTagLabel,
  getYearlyAttributionTagEmoji,
  loadData,
} from '@/lib/storage';
import {
  calculateNetWorth,
  calculateTotalAssets,
  calculateTotalLiabilities,
  calculateNetWorthForMonth,
} from '@/lib/calculator';
import { calculateHealthScore, calculateGoalProgress } from '@/lib/health-calculator';
import {
  CATEGORY_KEYS,
  CATEGORY_META,
  getCategoryPercentages,
  getIntervalStatus,
  type CategoryAmounts,
} from '@/lib/allocation-config';
import { saveFileToDevice } from '@/lib/platform';
import { cn } from '@/lib/utils';

export type ReportDimension = 'monthly' | 'quarterly' | 'yearly';

interface AssetHealthReportProps {
  dimension: ReportDimension;
  year: number;
  month?: number;
  quarter?: number;
  theme: ThemeType;
  onClose: () => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getGrade(score: number): 'S' | 'A' | 'B' | 'C' | 'D' {
  if (score >= 90) return 'S';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  return 'D';
}

const GRADE_META: Record<string, { label: string; bg: string }> = {
  S: { label: 'S', bg: 'bg-green-50 text-green-700' },
  A: { label: 'A', bg: 'bg-blue-50 text-blue-700' },
  B: { label: 'B', bg: 'bg-yellow-50 text-yellow-700' },
  C: { label: 'C', bg: 'bg-orange-50 text-orange-700' },
  D: { label: 'D', bg: 'bg-red-50 text-red-700' },
};

const GRADE_ORDER = ['D', 'C', 'B', 'A', 'S'] as const;

const STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  within: { label: '达标', cls: 'bg-green-50 text-green-700' },
  below:  { label: '偏低', cls: 'bg-blue-50 text-blue-700' },
  above:  { label: '偏高', cls: 'bg-orange-50 text-orange-700' },
  empty:  { label: '无数据', cls: 'bg-gray-50 text-gray-400' },
};

function getQuarterMonths(year: number, quarter: number) {
  const start = (quarter - 1) * 3 + 1;
  return [
    { year, month: start },
    { year, month: start + 1 },
    { year, month: start + 2 },
  ];
}

function getYearMonths(year: number) {
  return Array.from({ length: 12 }, (_, i) => ({ year, month: i + 1 }));
}

function fmtAmount(n: number, sym: string): string {
  const abs = Math.abs(n);
  if (abs >= 100_000_000) return `${sym}${(n / 100_000_000).toFixed(1)}亿`;
  if (abs >= 10_000) return `${sym}${(n / 10_000).toFixed(1)}万`;
  return `${sym}${n.toFixed(0)}`;
}

function fmtAmountRaw(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}亿`;
  if (abs >= 10_000) return `${(n / 10_000).toFixed(1)}万`;
  return n.toFixed(0);
}

interface PeriodMonth { year: number; month: number }

interface MonthlySnapshot {
  month: number;
  netWorth: number;
  changePercent: number;
  hasData: boolean;
}

// ─── Custom hook ────────────────────────────────────────────────────────────

interface ReportData {
  periodMonths: PeriodMonth[];
  prevPeriodMonths: PeriodMonth[];
  reportTitle: string;
  lastMonth: PeriodMonth;
  lastPrevMonth: PeriodMonth | null;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  netWorthChange: number;
  netWorthChangePct: number;
  categoryAmounts: CategoryAmounts;
  pcts: Record<string, number>;
  prevPcts: Record<string, number>;
  healthScore: ReturnType<typeof calculateHealthScore>;
  sd: number;
  periodAttrs: ReturnType<typeof getAllAttributions>;
  tagAmounts: Record<string, number>;
  attributionCompleteness: number;
  /** 报告期内有归因记录的月数占比 (0-100) */
  monthCoverage: number;
  missingMonths: PeriodMonth[];
  /** Recharts-compatible trend data (null = no record for that month) */
  trendChartData: { label: string; netWorth: number | null }[];
  /** Monthly snapshots for heatmap (yearly only) */
  monthlySnapshots: MonthlySnapshot[];
  goalProgress: ReturnType<typeof calculateGoalProgress> | null;
  goal: ReturnType<typeof getYearlyGoal>;
  accounts: ReturnType<typeof getAccountsForMonth>;
  classifiedCount: number;
}

function useReportData(
  dimension: ReportDimension,
  year: number,
  month?: number,
  quarter?: number,
): ReportData {
  return useMemo(() => {
    const periodMonths: PeriodMonth[] =
      dimension === 'monthly' && month ? [{ year, month }] :
      dimension === 'quarterly' && quarter ? getQuarterMonths(year, quarter) :
      dimension === 'yearly' ? getYearMonths(year) :
      [{ year, month: new Date().getMonth() + 1 }];

    const prevPeriodMonths: PeriodMonth[] =
      dimension === 'monthly' && month
        ? [{ year: month === 1 ? year - 1 : year, month: month === 1 ? 12 : month - 1 }]
      : dimension === 'quarterly' && quarter
        ? getQuarterMonths(quarter === 1 ? year - 1 : year, quarter === 1 ? 4 : quarter - 1)
      : dimension === 'yearly'
        ? getYearMonths(year - 1)
      : [];

    const lastMonth = periodMonths[periodMonths.length - 1];
    const lastPrevMonth = prevPeriodMonths.length > 0 ? prevPeriodMonths[prevPeriodMonths.length - 1] : null;

    const reportTitle =
      dimension === 'monthly' ? `${year}年${month}月 · 资产健康报告` :
      dimension === 'quarterly' ? `${year}年 Q${quarter} · 资产健康报告` :
      `${year}年度 · 资产健康报告`;

    // ── Current period financials ──
    const accounts = getAccountsForMonth(lastMonth.year, lastMonth.month).filter(a => !a.isHidden);
    const netWorth = calculateNetWorth(accounts, lastMonth.year, lastMonth.month);
    const totalAssets = calculateTotalAssets(accounts, lastMonth.year, lastMonth.month);
    const totalLiabilities = calculateTotalLiabilities(accounts, lastMonth.year, lastMonth.month);

    // ── Change vs previous period ──
    let prevNetWorth = 0;
    if (lastPrevMonth) {
      const prevAccs = getAccountsForMonth(lastPrevMonth.year, lastPrevMonth.month).filter(a => !a.isHidden);
      prevNetWorth = calculateNetWorth(prevAccs, lastPrevMonth.year, lastPrevMonth.month);
    }
    const netWorthChange = netWorth - prevNetWorth;
    const netWorthChangePct = prevNetWorth !== 0 ? (netWorthChange / Math.abs(prevNetWorth)) * 100 : 0;

    // ── Category amounts ──
    const categoryAmounts: CategoryAmounts = { cash: 0, stable: 0, invest: 0, insure: 0 };
    accounts.forEach(acc => {
      if (acc.assetCategory && acc.assetCategory in categoryAmounts) {
        const balance = getAccountBalanceForMonth(acc.id, lastMonth.year, lastMonth.month);
        const converted = convertToBaseCurrency(balance, acc.currency || 'CNY', lastMonth.year, lastMonth.month);
        categoryAmounts[acc.assetCategory as keyof CategoryAmounts] += converted;
      }
    });
    const pcts = getCategoryPercentages(categoryAmounts);

    // ── Previous period categories ──
    let prevPcts: Record<string, number> = { cash: 0, stable: 0, invest: 0, insure: 0 };
    if (lastPrevMonth) {
      const prevAccs = getAccountsForMonth(lastPrevMonth.year, lastPrevMonth.month).filter(a => !a.isHidden);
      const prevAmounts: CategoryAmounts = { cash: 0, stable: 0, invest: 0, insure: 0 };
      prevAccs.forEach(acc => {
        if (acc.assetCategory && acc.assetCategory in prevAmounts) {
          const balance = getAccountBalanceForMonth(acc.id, lastPrevMonth.year, lastPrevMonth.month);
          const converted = convertToBaseCurrency(balance, acc.currency || 'CNY', lastPrevMonth.year, lastPrevMonth.month);
          prevAmounts[acc.assetCategory as keyof CategoryAmounts] += converted;
        }
      });
      prevPcts = getCategoryPercentages(prevAmounts);
    }

    // ── Health score ──
    const healthScore = calculateHealthScore(accounts, lastMonth.year, lastMonth.month);

    // ── Volatility: use health-calculator's 12-month std dev for reliability ──
    const sd = healthScore.volatilityScore.standardDeviation;

    // ── Attribution aggregation ──
    const allAttrs = getAllAttributions();
    const periodAttrs = allAttrs.filter(a =>
      periodMonths.some(p => p.year === a.year && p.month === a.month)
    );
    const tagAmounts: Record<string, number> = {};
    periodAttrs.forEach(attr => {
      if (attr.tagAmounts) {
        Object.entries(attr.tagAmounts).forEach(([tag, amount]) => {
          tagAmounts[tag] = (tagAmounts[tag] || 0) + amount;
        });
      }
    });

    const attributedTotal = Object.values(tagAmounts).reduce((s, v) => s + Math.abs(v), 0);
    const periodTotal = periodAttrs.reduce((s, a) => s + Math.abs(a.change), 0);
    const attributionCompleteness = periodTotal > 0 ? Math.min(100, (attributedTotal / periodTotal) * 100) : 0;

    const missingMonths = periodMonths.filter(p =>
      !allAttrs.some(a => a.year === p.year && a.month === p.month)
    );

    // Month coverage ratio (for consistent display)
    const monthCoverage = periodMonths.length > 0
      ? (periodAttrs.length / periodMonths.length) * 100
      : 0;

    // ── Monthly snapshots for heatmap ──
    const allRecords = loadData().records;

    // ── Trend chart data (same approach as TrendPage: only include months with records) ──
    const hasRecordSet = new Set(allRecords.map(r => `${r.year}-${String(r.month).padStart(2, '0')}`));
    const trendChartData: { label: string; netWorth: number | null }[] = [];
    for (const p of periodMonths) {
      const key = `${p.year}-${String(p.month).padStart(2, '0')}`;
      const hasRecord = hasRecordSet.has(key);
      const nw = hasRecord ? calculateNetWorthForMonth(p.year, p.month) : null;
      trendChartData.push({ label: `${p.month}月`, netWorth: nw });
    }
    const monthlySnapshots: MonthlySnapshot[] = periodMonths.map((p, i) => {
      const nw = calculateNetWorthForMonth(p.year, p.month);
      const prevNW = i > 0
        ? calculateNetWorthForMonth(periodMonths[i - 1].year, periodMonths[i - 1].month)
        : 0;
      const hasData = allRecords.some(r => r.year === p.year && r.month === p.month);
      const changePercent = prevNW !== 0 ? ((nw - prevNW) / Math.abs(prevNW)) * 100 : 0;
      return { month: p.month, netWorth: nw, changePercent, hasData };
    });

    // ── Goal ──
    const goal = getYearlyGoal();
    let goalProgress = null;
    if (goal && goal.year === year) {
      goalProgress = calculateGoalProgress(netWorth, goal);
    }

    const classifiedCount = accounts.filter(a => a.assetCategory && a.assetCategory !== 'skipped').length;

    return {
      periodMonths, prevPeriodMonths, reportTitle,
      lastMonth, lastPrevMonth,
      netWorth, totalAssets, totalLiabilities,
      netWorthChange, netWorthChangePct,
      categoryAmounts, pcts, prevPcts,
      healthScore, sd, periodAttrs, tagAmounts,
      attributionCompleteness, monthCoverage, missingMonths,
      trendChartData, monthlySnapshots,
      accounts, classifiedCount,
      goalProgress, goal,
    };
  }, [dimension, year, month, quarter]);
}

// ─── Sub-components ────────────────────────────────────────────────────────

function ScoreRing({ score, grade, size = 76 }: { score: number; grade: string; size?: number }) {
  const r = (size / 2) - 5;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="5" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.95)" strokeWidth="5"
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x={size / 2} y={size / 2 - 4} textAnchor="middle" dominantBaseline="middle" fontSize="18" fontWeight="800" fill="white">
        {score}
      </text>
      <text x={size / 2} y={size / 2 + 13} textAnchor="middle" dominantBaseline="middle" fontSize="10" fontWeight="600" fill="rgba(255,255,255,0.8)">
        {grade}级
      </text>
    </svg>
  );
}

function SectionTitle({
  icon, title, badge, primaryColor,
}: {
  icon: React.ReactNode; title: string; badge?: string; primaryColor: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${primaryColor}15` }}
      >
        {icon}
      </div>
      <span className="text-sm font-bold text-foreground">{title}</span>
      {badge && (
        <span
          className="ml-auto text-[11px] font-semibold px-2 py-[2px] rounded-full"
          style={{ backgroundColor: `${primaryColor}12`, color: primaryColor }}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

function IntervalMarkerBar({
  value, min, max, color,
}: {
  value: number; min: number; max: number; color: string;
}) {
  const barWidth = Math.max(Math.min(value, 100), 4);
  return (
    <div className="relative h-2 bg-muted rounded-full overflow-visible">
      <div
        className="absolute left-0 top-0 h-full rounded-full transition-all"
        style={{ width: `${barWidth}%`, backgroundColor: color, minWidth: 4 }}
      />
      <div className="absolute top-[-3px] bottom-[-3px] w-[2px] rounded-sm bg-foreground/20" style={{ left: `${min}%` }} />
      <div className="absolute top-[-3px] bottom-[-3px] w-[2px] rounded-sm bg-foreground/20" style={{ left: `${max}%` }} />
    </div>
  );
}

function ScoreBar({ score, primaryColor, gradientFrom }: { score: number; primaryColor: string; gradientFrom: string }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground shrink-0">0</span>
        <div className="flex-1 relative h-2 bg-muted rounded-full">
          <div
            className="absolute left-0 top-0 h-full rounded-full"
            style={{ width: `${score}%`, background: `linear-gradient(90deg, ${gradientFrom}, ${primaryColor})` }}
          />
          {[60, 70, 80, 90].map(m => (
            <div key={m} className="absolute top-[-2px] bottom-[-2px] w-[1.5px] bg-border" style={{ left: `${m}%` }} />
          ))}
        </div>
        <span className="text-[11px] text-muted-foreground shrink-0">100</span>
      </div>
      <div className="flex justify-around mt-1">
        {GRADE_ORDER.map(g => {
          const meta = GRADE_META[g];
          const isActive = g === getGrade(score);
          return (
            <span
              key={g}
              className={cn(
                'text-[10px] px-1.5 py-[1px] rounded-md transition-colors',
                isActive ? `${meta.bg} font-bold` : 'text-muted-foreground',
              )}
            >
              {g}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** Color for heatmap cell based on change percent */
function heatColor(pct: number): string {
  if (pct > 0) {
    const intensity = Math.min(pct / 10, 1);
    const g = Math.round(255 - intensity * 180);
    const b = Math.round(255 - intensity * 220);
    return `rgb(${100 - Math.round(intensity * 80)}, ${g}, ${b})`;
  }
  const intensity = Math.min(Math.abs(pct) / 10, 1);
  const r = Math.round(255 - intensity * 100);
  const g = Math.round(255 - intensity * 200);
  return `rgb(${r}, ${g}, ${g})`;
}

function heatTextColor(pct: number): string {
  return Math.abs(pct) > 3 ? '#fff' : 'inherit';
}

// ─── Main Component ────────────────────────────────────────────────────────

export function AssetHealthReport({
  dimension, year, month, quarter, theme, onClose,
}: AssetHealthReportProps) {
  const themeConfig = THEMES[theme];
  const primaryColor = themeConfig.primary;
  const gradientFrom = themeConfig.gradientFrom;
  const baseCurrency = getSettings().baseCurrency || 'CNY';
  const sym = getCurrencyConfig(baseCurrency).symbol;
  const intervals = getReferenceIntervals();

  const d = useReportData(dimension, year, month, quarter);

  const score = d.healthScore.score;
  const grade = getGrade(score);

  // Volatility
  const sdLabel = d.sd <= 2 ? '极稳健' : d.sd <= 5 ? '较平稳' : d.sd <= 10 ? '正常波动' : '波动偏大';
  const sdColor = d.sd <= 2 ? '#0f7a48' : d.sd <= 5 ? '#0b6eb5' : d.sd <= 10 ? '#8a5e00' : '#c57a00';

  // Top attribution tags
  const topTags = Object.entries(d.tagAmounts)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 6);

  // Category rows
  const categoryRows = CATEGORY_KEYS.map(key => {
    const meta = CATEGORY_META[key];
    const pct = d.pcts[key];
    const prevPct = d.prevPcts[key] || 0;
    const interval = intervals[key];
    const status = getIntervalStatus(pct, interval.min, interval.max, d.categoryAmounts[key] > 0);
    const diff = Math.round(pct - prevPct);
    return { key, meta, pct, prevPct, diff, interval, status };
  });

  const anomalies = categoryRows.filter(r => r.status === 'below' || r.status === 'above');
  const normals = categoryRows.filter(r => r.status === 'within' || r.status === 'empty');

  // The month count coverage for consistent display
  const coverageDisplay = Math.round(d.monthCoverage);

  const [isDownloading, setIsDownloading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const handleDownload = useCallback(async () => {
    setIsDownloading(true);
    try {
      const lines: string[] = [
        '═══════════════════════════════════',
        `  ${d.reportTitle}`,
        `  生成时间: ${new Date().toLocaleString('zh-CN')}`,
        '═══════════════════════════════════',
        '',
        `📊 期末净资产: ${fmtAmountRaw(d.netWorth)}`,
        `   总资产: ${fmtAmountRaw(d.totalAssets)}`,
        `   总负债: ${fmtAmountRaw(d.totalLiabilities)}`,
        `   变动: ${d.netWorthChange >= 0 ? '+' : ''}${fmtAmountRaw(d.netWorthChange)} (${d.netWorthChangePct >= 0 ? '+' : ''}${d.netWorthChangePct.toFixed(1)}%)`,
        '',
        `🏆 综合健康评分: ${d.healthScore.score}分 · ${d.healthScore.level}级`,
        `   配置结构: ${d.healthScore.configScore.score}分 (${d.healthScore.configScore.level})`,
        `   波动控制: ${d.healthScore.volatilityScore.score}分 (${d.healthScore.volatilityScore.level})`,
        `   归因覆盖: ${coverageDisplay}% (${d.periodAttrs.length}/${d.periodMonths.length}月)`,
        '',
        '📦 资产配置:',
        ...CATEGORY_KEYS.map(key => {
          const meta = CATEGORY_META[key];
          return `   ${meta.label}: ${d.pcts[key]}%`;
        }),
        '',
        `📈 波动率: ${d.sd.toFixed(1)}% (${sdLabel})`,
        '',
        `🏷️ 归因汇总:`,
        ...topTags.map(([tag, amount]) => `   ${tag}: ${amount >= 0 ? '+' : ''}${fmtAmountRaw(amount)}`),
        '',
        `📋 账户: ${d.accounts.length}个 (已分类 ${d.classifiedCount}个)`,
        `📅 统计时段: ${d.periodMonths.length}个月`,
        ...(d.goalProgress ? [`🎯 年度目标进度: ${d.goalProgress.progress.toFixed(1)}%`] : []),
        '',
        '═══════════════════════════════════',
        '由 Easy-Ledger 生成',
      ];
      await saveFileToDevice(lines.join('\n'), `health-report-${year}${month ? `-${month}` : ''}.txt`, 'text/plain');
    } finally {
      setIsDownloading(false);
    }
  }, [d, sym, sdLabel, topTags, coverageDisplay, year, month]);

  const handleShare = useCallback(async () => {
    setIsSharing(true);
    try {
      const text = [
        `📊 ${d.reportTitle}`,
        `净资产: ${fmtAmountRaw(d.netWorth)}`,
        `评分: ${d.healthScore.score}分 · ${d.healthScore.level}级`,
        `波动: ${d.sd.toFixed(1)}%`,
        `配置: ${CATEGORY_KEYS.map(k => `${CATEGORY_META[k].shortLabel} ${d.pcts[k]}%`).join(' | ')}`,
        `归因覆盖: ${coverageDisplay}%`,
      ].join('\n');

      if (navigator.share) {
        await navigator.share({ title: d.reportTitle, text });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
    } finally {
      setIsSharing(false);
    }
  }, [d, coverageDisplay]);

  // Trend chart: for yearly show all 12 months, for quarterly show 3 months, for monthly extend to 6 months
  const trendData = useMemo(() => {
    if (dimension === 'yearly') return d.trendChartData;
    if (dimension === 'quarterly') return d.trendChartData;
    // monthly: prepend up to 5 preceding months for context
    const result = [...d.trendChartData];
    const allRecords = loadData().records;
    const recordSet = new Set(allRecords.map(r => `${r.year}-${String(r.month).padStart(2, '0')}`));
    for (let i = 1; i <= 5; i++) {
      let pm = (month || 1) - i;
      let py = year;
      while (pm <= 0) { pm += 12; py--; }
      const key = `${py}-${String(pm).padStart(2, '0')}`;
      const hasRecord = recordSet.has(key);
      const nw = hasRecord ? calculateNetWorthForMonth(py, pm) : null;
      result.unshift({ label: `${pm}月`, netWorth: nw });
    }
    return result;
  }, [d.trendChartData, dimension, year, month]);

  return (
    <div className="fixed inset-0 z-[70] bg-background flex flex-col overflow-hidden">
      {/* ── Header ── */}
      <header className="shrink-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-muted flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
          aria-label="关闭报告"
        >
          <X size={15} className="text-muted-foreground" />
        </button>

        <div className="text-center flex-1 px-2 min-w-0">
          <div className="text-sm font-bold text-foreground truncate">资产健康报告</div>
          <div className="text-[11px] text-muted-foreground mt-[1px]">
            生成于 {new Date().toLocaleDateString('zh-CN')}
          </div>
        </div>

        <div className="flex gap-1.5">
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center cursor-pointer active:scale-95 transition-transform disabled:opacity-50"
            aria-label="下载报告"
          >
            <Download size={14} className="text-muted-foreground" />
          </button>
          <button
            onClick={handleShare}
            disabled={isSharing}
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center cursor-pointer active:scale-95 transition-transform disabled:opacity-50"
            aria-label="分享报告"
          >
            <FileText size={14} className="text-muted-foreground" />
          </button>
        </div>
      </header>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="p-4 flex flex-col gap-3 max-w-lg mx-auto w-full">

          {/* ── Hero card ── */}
          <div
            className="rounded-2xl p-5 text-white"
            style={{ background: `linear-gradient(135deg, ${gradientFrom} 0%, ${themeConfig.gradientTo} 100%)` }}
          >
            <div className="text-[12px] text-white/70 mb-1">{d.reportTitle}</div>

            <div className="flex items-end justify-between mb-4">
              <div className="min-w-0">
                <div className="text-[11px] text-white/65 mb-1">期末净资产</div>
                <div className="text-[28px] font-extrabold tracking-tight leading-none">
                  {fmtAmount(d.netWorth, sym)}
                </div>
                <div className="flex items-center gap-1.5 mt-1.5">
                  {d.netWorthChange >= 0
                    ? <TrendingUp size={13} className="text-white/80" />
                    : <TrendingDown size={13} className="text-red-300" />
                  }
                  <span className={cn('text-xs font-semibold', d.netWorthChange >= 0 ? 'text-white/95' : 'text-red-300')}>
                    {d.netWorthChange >= 0 ? '+' : ''}{fmtAmount(d.netWorthChange, sym)}
                    <span className="opacity-70 ml-1">
                      ({d.netWorthChangePct >= 0 ? '+' : ''}{d.netWorthChangePct.toFixed(1)}%)
                    </span>
                  </span>
                </div>
              </div>
              <ScoreRing score={score} grade={grade} />
            </div>

            <div className="grid grid-cols-3 gap-2 pt-3.5 border-t border-white/20">
              {[
                { label: '总资产', value: fmtAmount(d.totalAssets, sym) },
                { label: '总负债', value: fmtAmount(d.totalLiabilities, sym) },
                { label: '已归因月', value: `${d.periodAttrs.length}/${d.periodMonths.length}` },
              ].map(item => (
                <div key={item.label} className="text-center">
                  <div className="text-[11px] text-white/60 mb-1">{item.label}</div>
                  <div className="text-[13px] font-bold text-white truncate">{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Score breakdown ── */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <SectionTitle
              icon={<Activity size={14} color={primaryColor} />}
              title="综合健康评分"
              badge={`${score}分 · ${grade}级`}
              primaryColor={primaryColor}
            />

            <div className="flex gap-2 mb-3.5">
              {[
                { label: '配置结构', weight: '40%', s: d.healthScore.configScore.score, g: d.healthScore.configScore.level },
                { label: '波动控制', weight: '30%', s: d.healthScore.volatilityScore.score, g: d.healthScore.volatilityScore.level },
                { label: '归因覆盖', weight: '30%', s: coverageDisplay, g: getGrade(d.healthScore.attributionCompleteness) },
              ].map(item => {
                const gm = GRADE_META[item.g];
                return (
                  <div key={item.label} className="flex-1 text-center p-2.5 rounded-xl" style={{ backgroundColor: `${primaryColor}08`, border: `1px solid ${primaryColor}18` }}>
                    <div className="text-xl font-extrabold leading-none" style={{ color: primaryColor }}>{item.s}</div>
                    <div className="text-[9px] text-muted-foreground mt-1">{item.label}</div>
                    <span className={cn('inline-block mt-1 px-1.5 py-[1px] rounded-full text-[10px] font-bold', gm.bg)}>
                      {item.g} · {item.weight}
                    </span>
                  </div>
                );
              })}
            </div>

            <ScoreBar score={score} primaryColor={primaryColor} gradientFrom={gradientFrom} />
          </div>

          {/* ── Net worth trend (AreaChart) ── */}
          {trendData.length > 1 && (
            <div className="bg-card border border-border rounded-2xl p-4">
              <SectionTitle
                icon={<TrendingUp size={14} color={primaryColor} />}
                title="净资产走势"
                primaryColor={primaryColor}
              />
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={primaryColor} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={primaryColor} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => fmtAmountRaw(v)}
                      width={50}
                    />
                    <Tooltip
                      formatter={(v) => [v != null ? fmtAmountRaw(Number(v)) : '无记录', '净资产' as const]}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="netWorth"
                      stroke={primaryColor}
                      fill="url(#trendFill)"
                      strokeWidth={2}
                      dot={false}
                      connectNulls={false}
                      activeDot={{ r: 5, fill: primaryColor, stroke: '#fff', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── 12-Month Asset Snapshot Heatmap (yearly only) ── */}
          {dimension === 'yearly' && d.monthlySnapshots.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-4">
              <SectionTitle
                icon={<BarChart4 size={14} color={primaryColor} />}
                title="12个月资产快照"
                primaryColor={primaryColor}
              />
              <div className="grid grid-cols-4 gap-1.5">
                {d.monthlySnapshots.map(s => {
                  const bg = s.hasData ? heatColor(s.changePercent) : '#f3f4f6';
                  const tc = s.hasData ? heatTextColor(s.changePercent) : '#9ca3af';
                  return (
                    <div
                      key={s.month}
                      className="rounded-lg p-2 text-center transition-colors"
                      style={{ backgroundColor: bg, color: tc }}
                      title={`${s.month}月: ${fmtAmountRaw(s.netWorth)} (${s.changePercent >= 0 ? '+' : ''}${s.changePercent.toFixed(1)}%)`}
                    >
                      <div className="text-[10px] font-bold">{s.month}月</div>
                      <div className={cn('text-[9px] mt-0.5', tc !== '#fff' && 'text-muted-foreground')}>
                        {s.hasData ? fmtAmountRaw(s.netWorth) : '—'}
                      </div>
                      <div className={cn('text-[8px] mt-0.5 font-semibold', tc !== '#fff' && (s.changePercent >= 0 ? 'text-green-700' : 'text-red-600'))}>
                        {s.hasData
                          ? `${s.changePercent >= 0 ? '+' : ''}${s.changePercent.toFixed(1)}%`
                          : '无数据'
                        }
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="mt-3 flex items-center gap-2 justify-center">
                <span className="text-[10px] text-muted-foreground">跌幅</span>
                <div className="flex rounded-full overflow-hidden h-2 w-28">
                  <div className="flex-1" style={{ background: 'linear-gradient(90deg, #ef4444, #f5f5f5)' }} />
                  <div className="flex-1" style={{ background: 'linear-gradient(90deg, #f5f5f5, #22c55e)' }} />
                </div>
                <span className="text-[10px] text-muted-foreground">涨幅</span>
              </div>
            </div>
          )}

          {/* ── Asset allocation ── */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <SectionTitle
              icon={<BarChart4 size={14} color={primaryColor} />}
              title="配置结构分析"
              primaryColor={primaryColor}
            />

            {anomalies.length > 0 && (
              <div className="mb-3">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  偏离区间 · {anomalies.length}项
                </div>
                <div className="flex flex-col gap-2.5">
                  {anomalies.map(row => {
                    const sc = STATUS_STYLES[row.status];
                    return (
                      <div key={row.key}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: row.meta.color }} />
                          <span className="text-[13px] font-semibold text-foreground flex-1">{row.meta.label}</span>
                          <span className={cn('text-[11px] font-semibold px-1.5 py-[1px] rounded-full', sc.cls)}>{sc.label}</span>
                          <span className="text-[13px] font-bold ml-1" style={{ color: row.meta.color }}>{row.pct}%</span>
                          {row.diff !== 0 && (
                            <span className={cn('text-[10px] ml-0.5', row.diff > 0 ? 'text-green-600' : 'text-red-600')}>
                              {row.diff > 0 ? '+' : ''}{row.diff}%
                            </span>
                          )}
                        </div>
                        <IntervalMarkerBar value={row.pct} min={row.interval.min} max={row.interval.max} color={row.meta.color} />
                        <div className="flex justify-between mt-0.5">
                          <span className="text-[10px] text-muted-foreground">参考区间 {row.interval.min}–{row.interval.max}%</span>
                          <span className="text-[10px] text-muted-foreground">当前 {row.pct}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {normals.length > 0 && (
              <div>
                {anomalies.length > 0 && (
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    正常 · {normals.length}项
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  {normals.map(row => {
                    const sc = STATUS_STYLES[row.status];
                    return (
                      <div key={row.key}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: row.meta.color }} />
                          <span className="text-xs text-muted-foreground flex-1">{row.meta.label}</span>
                          <span className={cn('text-[10px] font-semibold px-1 py-[1px] rounded-full', sc.cls)}>{sc.label}</span>
                          <span className="text-xs font-semibold text-foreground ml-1">{row.pct}%</span>
                        </div>
                        <IntervalMarkerBar value={row.pct} min={row.interval.min} max={row.interval.max} color={row.meta.color} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── Volatility ── */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <SectionTitle
              icon={<Activity size={14} color={primaryColor} />}
              title="波动控制"
              primaryColor={primaryColor}
            />
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="flex items-baseline gap-1.5 mb-2.5">
                  <span className="text-[26px] font-extrabold leading-none" style={{ color: primaryColor }}>
                    {d.sd.toFixed(1)}%
                  </span>
                  <span className="text-xs text-muted-foreground">标准差</span>
                  <span
                    className="ml-1 text-[11px] font-bold px-2 py-[2px] rounded-full"
                    style={{ backgroundColor: `${sdColor}18`, color: sdColor }}
                  >
                    {sdLabel}
                  </span>
                </div>

                <div className="relative h-1.5 bg-muted rounded-full">
                  <div
                    className="absolute left-0 top-0 h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(d.sd * 2, 100)}%`,
                      background: `linear-gradient(90deg, #22c55e, ${d.sd > 10 ? '#ef4444' : d.sd > 5 ? '#f59e0b' : '#22c55e'})`,
                    }}
                  />
                  {[10, 20].map(p => (
                    <div key={p} className="absolute top-[-2px] bottom-[-2px] w-[1.5px] bg-border" style={{ left: `${p}%` }} />
                  ))}
                </div>
                <div className="flex justify-between mt-0.5 text-[9px] text-muted-foreground">
                  <span>0</span><span>5%</span><span>10%</span><span>15%</span><span>20%+</span>
                </div>
              </div>

              <div className="shrink-0 text-center">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-extrabold"
                  style={{ backgroundColor: `${sdColor}18`, color: sdColor, border: `2px solid ${sdColor}30` }}
                >
                  {d.healthScore.volatilityScore.level}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">波动等级</div>
              </div>
            </div>
          </div>

          {/* ── Attribution ── */}
          {topTags.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-4">
              <SectionTitle
                icon={<Tags size={14} color={primaryColor} />}
                title="归因汇总"
                badge={`覆盖 ${coverageDisplay}%`}
                primaryColor={primaryColor}
              />

              <div className="flex flex-col gap-2 mb-3">
                {(() => {
                  const attrTotal = Object.values(d.tagAmounts).reduce((s, v) => s + Math.abs(v), 0);
                  return topTags.map(([tag, amount]) => {
                    const isYearly = dimension === 'yearly';
                    const tagLabel = isYearly ? getYearlyAttributionTagLabel(tag) : getAttributionTagLabel(tag as any);
                    const tagEmoji = isYearly ? getYearlyAttributionTagEmoji(tag) : getAttributionTagEmoji(tag as any);
                    const isNeg = amount < 0;
                    const pct = attrTotal > 0 ? Math.abs(amount) / attrTotal * 100 : 0;
                    return (
                      <div key={tag} className="flex items-center gap-2">
                        <span className="text-sm shrink-0">{tagEmoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between mb-0.5">
                            <span className="text-xs text-foreground font-medium truncate">{tagLabel}</span>
                            <span className={cn('text-xs font-bold shrink-0 ml-2', isNeg ? 'text-red-500' : 'text-green-600')}>
                              {isNeg ? '' : '+'}{sym}{fmtAmountRaw(Math.abs(amount))}
                            </span>
                          </div>
                          <div className="h-1 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: isNeg ? '#fca5a5' : primaryColor }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              <div className="p-2.5 rounded-xl bg-muted/50">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs text-muted-foreground">归因覆盖月数</span>
                  <span className="text-[13px] font-bold" style={{ color: primaryColor }}>
                    {d.periodAttrs.length}/{d.periodMonths.length} 月
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.min(d.monthCoverage, 100)}%`, background: `linear-gradient(90deg, #3b82f6, ${primaryColor})` }}
                  />
                </div>
                {d.missingMonths.length > 0 && (
                  <div className="mt-2 text-[11px] text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 px-2 py-1.5 rounded-lg flex items-center gap-1">
                    <span>⚠️</span>
                    <span>
                      {d.missingMonths.length} 个月未记录归因
                      {d.missingMonths.length <= 3 && `：${d.missingMonths.map(m => `${m.year}/${m.month}`).join('、')}`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Yearly goal ── */}
          {d.goalProgress && d.goal && (
            <div className="bg-card border border-border rounded-2xl p-4">
              <SectionTitle
                icon={<Target size={14} color={primaryColor} />}
                title={`${year}年度目标`}
                badge={`${d.goalProgress.progress.toFixed(0)}%`}
                primaryColor={primaryColor}
              />

              <div className="flex items-center gap-4 mb-4">
                <div className="flex-1">
                  <div className="text-[11px] text-muted-foreground mb-1">当前净资产</div>
                  <div className="text-lg font-extrabold text-foreground">{fmtAmount(d.netWorth, sym)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-muted-foreground mb-1">年度目标</div>
                  <div className="text-lg font-extrabold" style={{ color: primaryColor }}>{fmtAmount(d.goal.targetAmount, sym)}</div>
                </div>
              </div>

              <div className="h-3 bg-muted rounded-full overflow-hidden mb-2">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(d.goalProgress.progress, 100)}%`, background: `linear-gradient(90deg, #7dd3fc, ${primaryColor})` }}
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-muted-foreground">0%</span>
                <div className="flex flex-col items-center gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: primaryColor }}>{d.goalProgress.progress.toFixed(1)}%</span>
                    {d.netWorth < d.goal.targetAmount && (
                      <span className="text-[11px] font-medium text-foreground/60">
                        还差{fmtAmount(d.goal.targetAmount - d.netWorth, sym)}
                      </span>
                    )}
                    {d.netWorth >= d.goal.targetAmount && (
                      <span className="text-[11px] font-medium text-green-600">✅ 已达成</span>
                    )}
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground">100%</span>
              </div>
            </div>
          )}

          {/* ── Key stats ── */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="grid grid-cols-4 gap-0 divide-x divide-border">
              {[
                { label: '账户总数', value: `${d.accounts.length}`, unit: '个' },
                { label: '已分类', value: `${d.classifiedCount}`, unit: `${d.accounts.length}` },
                { label: '归因记录', value: `${d.periodAttrs.length}`, unit: '条' },
                { label: '统计时段', value: `${d.periodMonths.length}`, unit: '个月' },
              ].map((item) => (
                <div key={item.label} className="flex flex-col items-center py-1 first:pl-0 last:pr-0">
                  <div className="text-lg font-extrabold text-foreground">{item.value}</div>
                  <div className="text-[9px] text-muted-foreground whitespace-nowrap">
                    {item.label}
                    {item.unit && <span className="text-[9px] text-muted-foreground ml-0.5">{item.unit}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Conclusion ── */}
          <div className="rounded-2xl p-3.5" style={{ backgroundColor: `${primaryColor}08`, border: `1px solid ${primaryColor}20` }}>
            <div className="text-xs font-bold mb-1.5" style={{ color: primaryColor }}>综合评估</div>
            <div className="text-xs text-muted-foreground leading-relaxed">
              {score >= 80
                ? `资产配置结构良好，波动控制在合理范围内，归因覆盖${coverageDisplay}%（${d.periodAttrs.length}/${d.periodMonths.length}月）。建议保持当前节奏，持续记录月度变化。`
                : score >= 60
                ? `整体状况尚可，${anomalies.length > 0 ? `有 ${anomalies.length} 类资产偏离参考区间，建议关注并逐步调整。` : '波动控制需要改善。'}归因覆盖${coverageDisplay}%（${d.periodAttrs.length}/${d.periodMonths.length}月），建议补充缺失记录。`
                : `多项指标偏离参考区间，建议重新审视资产配置结构。${d.missingMonths.length > 0 ? `有 ${d.missingMonths.length} 个月归因未记录，影响分析准确性。` : ''}`
              }
            </div>
          </div>

          <div className="h-6" />
        </div>
      </div>
    </div>
  );
}
