import { useMemo } from 'react';
import { X, Download, Share2, Activity, TrendingUp, TrendingDown, Tag, Info } from 'lucide-react';
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
} from '@/lib/storage';
import {
  calculateNetWorth,
  calculateTotalAssets,
  calculateTotalLiabilities,
} from '@/lib/calculator';
import { calculateHealthScore, calculateGoalProgress } from '@/lib/health-calculator';
import {
  CATEGORY_KEYS,
  CATEGORY_META,
  getCategoryPercentages,
  getIntervalStatus,
  type CategoryAmounts,
} from '@/lib/allocation-config';

export type ReportDimension = 'monthly' | 'quarterly' | 'yearly';

interface AssetHealthReportProps {
  dimension: ReportDimension;
  year: number;
  month?: number;   // monthly: 1-12
  quarter?: number; // quarterly: 1-4
  theme: ThemeType;
  onClose: () => void;
}

/** 获取季度包含的月份 */
function getQuarterMonths(year: number, quarter: number): Array<{ year: number; month: number }> {
  const startMonth = (quarter - 1) * 3 + 1;
  return [
    { year, month: startMonth },
    { year, month: startMonth + 1 },
    { year, month: startMonth + 2 },
  ];
}

/** 获取年度包含的月份 */
function getYearMonths(year: number): Array<{ year: number; month: number }> {
  return Array.from({ length: 12 }, (_, i) => ({ year, month: i + 1 }));
}

/** 计算某组月份的平均净资产变化率标准差 */
function calcStdDev(changes: number[]): number {
  if (changes.length < 2) return 0;
  const mean = changes.reduce((s, v) => s + v, 0) / changes.length;
  const variance = changes.reduce((s, v) => s + (v - mean) ** 2, 0) / (changes.length - 1);
  return Math.sqrt(variance);
}

/** 波动评级 */
function getVolatilityLabel(sd: number): { label: string; color: string; bg: string } {
  if (sd <= 2) return { label: '波动很小', color: '#0f7a48', bg: '#e8faf2' };
  if (sd <= 5) return { label: '波动较小', color: '#0b6eb5', bg: '#e8f5ff' };
  if (sd <= 10) return { label: '波动适中', color: '#8a5e00', bg: '#fff8e6' };
  return { label: '波动偏大', color: '#c57a00', bg: '#fff3e6' };
}

/** 评分等级 */
function getGrade(score: number): 'S' | 'A' | 'B' | 'C' | 'D' {
  if (score >= 90) return 'S';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  return 'D';
}

const GRADE_COLORS: Record<string, string> = {
  S: '#0f7a48', A: '#0b6eb5', B: '#8a5e00', C: '#c57a00', D: '#dc2626',
};

export function AssetHealthReport({
  dimension,
  year,
  month,
  quarter,
  theme,
  onClose,
}: AssetHealthReportProps) {
  const themeConfig = THEMES[theme];
  const baseCurrency = getSettings().baseCurrency || 'CNY';
  const currencySymbol = getCurrencyConfig(baseCurrency).symbol;
  const intervals = getReferenceIntervals();

  // ── 确定数据范围 ──
  const periodMonths = useMemo(() => {
    if (dimension === 'monthly' && month) return [{ year, month }];
    if (dimension === 'quarterly' && quarter) return getQuarterMonths(year, quarter);
    if (dimension === 'yearly') return getYearMonths(year);
    return [{ year, month: new Date().getMonth() + 1 }];
  }, [dimension, year, month, quarter]);

  // 上一周期的月份
  const prevPeriodMonths = useMemo(() => {
    if (dimension === 'monthly' && month) {
      const pm = month === 1 ? 12 : month - 1;
      const py = month === 1 ? year - 1 : year;
      return [{ year: py, month: pm }];
    }
    if (dimension === 'quarterly' && quarter) {
      const pq = quarter === 1 ? 4 : quarter - 1;
      const py = quarter === 1 ? year - 1 : year;
      return getQuarterMonths(py, pq);
    }
    if (dimension === 'yearly') {
      return getYearMonths(year - 1);
    }
    return [];
  }, [dimension, year, month, quarter]);

  // ── 末期月份（用于取净资产） ──
  const lastPeriodMonth = periodMonths[periodMonths.length - 1];
  const lastPrevMonth = prevPeriodMonths.length > 0 ? prevPeriodMonths[prevPeriodMonths.length - 1] : null;

  // ── 报告标题 ──
  const reportTitle = useMemo(() => {
    if (dimension === 'monthly') return `${year}年${month}月资产健康报告`;
    if (dimension === 'quarterly') return `${year}年Q${quarter}资产健康报告`;
    return `${year}年度资产健康报告`;
  }, [dimension, year, month, quarter]);

  // ── 核心数据 ──
  const reportData = useMemo(() => {
    const { year: py, month: pm } = lastPeriodMonth;
    const accounts = getAccountsForMonth(py, pm).filter(a => !a.isHidden);

    // 当期净资产
    const netWorth = calculateNetWorth(accounts, py, pm);
    const totalAssets = calculateTotalAssets(accounts, py, pm);
    const totalLiabilities = calculateTotalLiabilities(accounts, py, pm);

    // 上期净资产
    let prevNetWorth = 0;
    if (lastPrevMonth) {
      const prevAccounts = getAccountsForMonth(lastPrevMonth.year, lastPrevMonth.month).filter(a => !a.isHidden);
      prevNetWorth = calculateNetWorth(prevAccounts, lastPrevMonth.year, lastPrevMonth.month);
    }

    const netWorthChange = netWorth - prevNetWorth;
    const netWorthChangePercent = prevNetWorth !== 0 ? (netWorthChange / Math.abs(prevNetWorth)) * 100 : 0;

    // 四类资产金额
    const categoryAmounts: CategoryAmounts = { cash: 0, stable: 0, invest: 0, insure: 0 };
    accounts.forEach(account => {
      if (account.assetCategory && account.assetCategory in categoryAmounts) {
        const balance = getAccountBalanceForMonthLocal(account.id, py, pm);
        const converted = convertToBaseCurrency(balance, account.currency || 'CNY', py, pm);
        categoryAmounts[account.assetCategory as keyof CategoryAmounts] += converted;
      }
    });

    const pcts = getCategoryPercentages(categoryAmounts);

    // 上期四类资产占比
    let prevPcts: Record<string, number> = { cash: 0, stable: 0, invest: 0, insure: 0 };
    if (lastPrevMonth) {
      const prevAccounts = getAccountsForMonth(lastPrevMonth.year, lastPrevMonth.month).filter(a => !a.isHidden);
      const prevAmounts: CategoryAmounts = { cash: 0, stable: 0, invest: 0, insure: 0 };
      prevAccounts.forEach(account => {
        if (account.assetCategory && account.assetCategory in prevAmounts) {
          const balance = getAccountBalanceForMonthLocal(account.id, lastPrevMonth.year, lastPrevMonth.month);
          const converted = convertToBaseCurrency(balance, account.currency || 'CNY', lastPrevMonth.year, lastPrevMonth.month);
          prevAmounts[account.assetCategory as keyof CategoryAmounts] += converted;
        }
      });
      prevPcts = getCategoryPercentages(prevAmounts);
    }

    // 健康评分（取末期月）
    const healthScore = calculateHealthScore(accounts, py, pm);

    // 波动：当期周期内各月净资产变化率
    const monthlyChanges: number[] = [];
    for (let i = 1; i < periodMonths.length; i++) {
      const cur = periodMonths[i];
      const prev = periodMonths[i - 1];
      const curNW = calculateNetWorth(
        getAccountsForMonth(cur.year, cur.month).filter(a => !a.isHidden),
        cur.year, cur.month
      );
      const prevNW = calculateNetWorth(
        getAccountsForMonth(prev.year, prev.month).filter(a => !a.isHidden),
        prev.year, prev.month
      );
      if (prevNW !== 0) {
        monthlyChanges.push(((curNW - prevNW) / Math.abs(prevNW)) * 100);
      }
    }
    const sd = calcStdDev(monthlyChanges);

    // 归因聚合
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
    const totalChange = periodAttrs.reduce((s, a) => s + Math.abs(a.change), 0);
    const attributedAmount = Object.values(tagAmounts).reduce((s, v) => s + Math.abs(v), 0);
    const attributionCompleteness = totalChange > 0 ? Math.min(100, (attributedAmount / totalChange) * 100) : 0;

    // 漏记月份
    const missingMonths = periodMonths.filter(p =>
      !allAttrs.some(a => a.year === p.year && a.month === p.month)
    );

    // 账户统计
    const allVisibleAccounts = getAccountsForMonth(py, pm).filter(a => !a.isHidden);
    const classifiedCount = allVisibleAccounts.filter(a => a.assetCategory && a.assetCategory !== 'skipped').length;

    // 年度目标
    const goal = getYearlyGoal();
    let goalProgress = null;
    if (goal && goal.year === year) {
      goalProgress = calculateGoalProgress(netWorth, goal);
    }

    // 迷你趋势数据（最近 N 个月的净资产）
    const miniTrend: Array<{ label: string; value: number }> = [];
    const trendCount = dimension === 'monthly' ? 6 : dimension === 'quarterly' ? 4 : 3;
    const now = new Date();
    for (let i = trendCount - 1; i >= 0; i--) {
      let ty: number, tm: number;
      if (dimension === 'monthly') {
        tm = now.getMonth() + 1 - i;
        ty = now.getFullYear();
        while (tm <= 0) { tm += 12; ty--; }
      } else if (dimension === 'quarterly') {
        const totalQ = (now.getFullYear() * 4 + Math.floor((now.getMonth()) / 3)) - i;
        ty = Math.floor(totalQ / 4);
        tm = ((totalQ % 4) * 3) + 3;
      } else {
        ty = now.getFullYear() - i;
        tm = 12;
      }
      const trendAccounts = getAccountsForMonth(ty, tm).filter(a => !a.isHidden);
      const nw = calculateNetWorth(trendAccounts, ty, tm);
      const label = dimension === 'monthly' ? `${tm}月` : dimension === 'quarterly' ? `Q${Math.ceil(tm / 3)}` : `${ty}`;
      miniTrend.push({ label, value: nw });
    }

    return {
      netWorth, totalAssets, totalLiabilities,
      netWorthChange, netWorthChangePercent,
      categoryAmounts, pcts, prevPcts,
      healthScore, sd, monthlyChanges,
      periodAttrs, tagAmounts, attributionCompleteness,
      missingMonths,
      allVisibleAccounts, classifiedCount,
      goalProgress, goal,
      miniTrend,
    };
  }, [periodMonths, lastPeriodMonth, lastPrevMonth, dimension, year]);

  const d = reportData;
  const volatilityInfo = getVolatilityLabel(d.sd);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-gray-50">
      {/* 顶部操作栏 */}
      <div className="shrink-0 px-4 pt-3 pb-2 flex items-center justify-between border-b border-gray-100 bg-white">
        <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
          <X size={16} className="text-gray-500" />
        </button>
        <span className="text-[14px] font-bold text-gray-800">报告预览</span>
        <div className="flex items-center gap-1">
          <button className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center" title="保存图片">
            <Download size={15} className="text-gray-500" />
          </button>
          <button className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center" title="系统分享">
            <Share2 size={15} className="text-gray-500" />
          </button>
        </div>
      </div>

      {/* 报告内容 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" id="report-content">
        {/* ── 顶部概览 ── */}
        <div className="rounded-[20px] p-4 text-white" style={{ background: `linear-gradient(135deg, ${themeConfig.primary}, #0b6eb5)` }}>
          <h2 className="text-[15px] font-bold mb-1">{reportTitle}</h2>
          <p className="text-[11px] text-white/70 mb-3">生成于 {new Date().toLocaleDateString('zh-CN')}</p>
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[11px] text-white/70 mb-0.5">期末净资产</div>
              <div className="text-[24px] font-extrabold leading-none">{currencySymbol}{d.netWorth.toFixed(0)}</div>
              <div className="flex items-center gap-1 mt-1">
                {d.netWorthChange >= 0 ? (
                  <TrendingUp size={12} className="text-green-200" />
                ) : (
                  <TrendingDown size={12} className="text-red-200" />
                )}
                <span className={`text-[11px] font-semibold ${d.netWorthChange >= 0 ? 'text-green-200' : 'text-red-200'}`}>
                  {d.netWorthChange >= 0 ? '+' : ''}{d.netWorthChange.toFixed(0)}（{d.netWorthChangePercent >= 0 ? '+' : ''}{d.netWorthChangePercent.toFixed(1)}%）
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-white/70 mb-0.5">综合健康评分</div>
              <div className="text-[32px] font-extrabold leading-none">{d.healthScore.score}</div>
              <div className="text-[11px] text-white/80 font-semibold mt-0.5">等级 {d.healthScore.level}</div>
            </div>
          </div>
        </div>

        {/* ── 模块1：资产配置结构 ── */}
        <ReportCard title="资产配置结构" icon={<Activity size={14} style={{ color: themeConfig.primary }} />}>
          <div className="space-y-2.5">
            {CATEGORY_KEYS.map(key => {
              const meta = CATEGORY_META[key];
              const pct = d.pcts[key];
              const prevPct = d.prevPcts[key] || 0;
              const interval = intervals[key];
              const status = getIntervalStatus(pct, interval.min, interval.max, d.categoryAmounts[key] > 0);
              const diff = pct - prevPct;
              const statusLabel = status === 'within' ? '达标' : status === 'below' ? '偏低' : status === 'above' ? '偏高' : '无数据';
              const statusColor = status === 'within' ? '#0f7a48' : status === 'below' ? '#0b6eb5' : status === 'above' ? '#c57a00' : '#9ca3af';
              const statusBg = status === 'within' ? '#e8faf2' : status === 'below' ? '#e8f5ff' : status === 'above' ? '#fff3e6' : '#f3f4f6';
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px]">{meta.icon}</span>
                      <span className="text-[12px] font-semibold text-gray-700">{meta.label}</span>
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: statusBg, color: statusColor }}>
                        {statusLabel}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] text-gray-400">{interval.min}–{interval.max}%</span>
                      {diff !== 0 && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${diff > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                          {diff > 0 ? '+' : ''}{diff}%
                        </span>
                      )}
                      <span className="text-[13px] font-bold" style={{ color: meta.color }}>{pct}%</span>
                    </div>
                  </div>
                  <div className="relative h-[6px] bg-gray-100 rounded-full overflow-visible">
                    <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: meta.color }} />
                    <div className="absolute top-[-3px] bottom-[-3px] w-[1.5px] bg-gray-400/70 rounded-full" style={{ left: `${Math.min(interval.min, 100)}%` }} />
                    <div className="absolute top-[-3px] bottom-[-3px] w-[1.5px] bg-gray-400/70 rounded-full" style={{ left: `${Math.min(interval.max, 100)}%` }} />
                  </div>
                  <div className="flex justify-between mt-0.5">
                    {[0, 25, 50, 75, 100].map(m => (
                      <span key={m} className="text-[8px] text-gray-300">{m}%</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </ReportCard>

        {/* ── 模块2：波动分析 ── */}
        <ReportCard title="波动分析" icon={<TrendingUp size={14} className="text-emerald-500" />}>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="text-[11px] text-gray-400 mb-1">周期波动率</div>
              <div className="text-[24px] font-extrabold" style={{ color: themeConfig.primary }}>{d.sd.toFixed(2)}%</div>
            </div>
            <div className="flex-1">
              <div className="text-[11px] text-gray-400 mb-1">标准差</div>
              <div className="text-[24px] font-extrabold text-gray-700">{d.sd.toFixed(2)}</div>
            </div>
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0" style={{ backgroundColor: volatilityInfo.bg, color: volatilityInfo.color }}>
              {volatilityInfo.label}
            </span>
          </div>
        </ReportCard>

        {/* ── 模块2b：迷你趋势图 ── */}
        {d.miniTrend.length > 1 && (
          <ReportCard title="净资产趋势" icon={<Activity size={14} className="text-blue-500" />}>
            <div className="text-[11px] text-gray-400 mb-2">
              {dimension === 'monthly' ? '近6月' : dimension === 'quarterly' ? '近4季' : '近3年'}净资产变化
            </div>
            <div className="flex items-end gap-1 h-16">
              {d.miniTrend.map((item, i) => {
                const values = d.miniTrend.map(t => t.value);
                const minVal = Math.min(...values);
                const maxVal = Math.max(...values);
                const range = maxVal - minVal || 1;
                const height = Math.max(((item.value - minVal) / range) * 80 + 20, 10);
                const isLast = i === d.miniTrend.length - 1;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                    <span className="text-[8px] text-gray-400">{currencySymbol}{Math.abs(item.value) >= 10000 ? `${(item.value / 10000).toFixed(1)}万` : item.value.toFixed(0)}</span>
                    <div
                      className="w-full rounded-t-[3px]"
                      style={{
                        height: `${height}%`,
                        backgroundColor: isLast ? themeConfig.primary : `${themeConfig.primary}40`,
                      }}
                    />
                    <span className="text-[8px] text-gray-400">{item.label}</span>
                  </div>
                );
              })}
            </div>
          </ReportCard>
        )}

        {/* ── 模块3：归因总结 ── */}
        <ReportCard title="归因总结" icon={<Tag size={14} className="text-sky-500" />}>
          {Object.keys(d.tagAmounts).length > 0 ? (
            <div className="space-y-1.5">
              {Object.entries(d.tagAmounts)
                .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
                .slice(0, 8)
                .map(([tag, amount]) => {
                  const tagLabel = dimension === 'yearly'
                    ? getYearlyAttributionTagLabel(tag)
                    : getAttributionTagLabel(tag as any);
                  const tagEmoji = dimension === 'yearly'
                    ? getYearlyAttributionTagEmoji(tag)
                    : getAttributionTagEmoji(tag as any);
                  return (
                    <div key={tag} className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px]">{tagEmoji}</span>
                        <span className="text-[12px] text-gray-600">{tagLabel}</span>
                      </div>
                      <span className={`text-[16px] font-bold ${amount >= 0 ? 'text-green-600' : 'text-orange-500'}`}>
                        {amount >= 0 ? '+' : ''}{currencySymbol}{Math.abs(amount).toFixed(0)}
                      </span>
                    </div>
                  );
                })}
            </div>
          ) : (
            <p className="text-[12px] text-gray-400 text-center py-2">暂无归因数据</p>
          )}
          <div className="mt-3 pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-gray-400">归因完整度</span>
              <span className="text-[12px] font-bold" style={{ color: themeConfig.primary }}>{d.attributionCompleteness.toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(d.attributionCompleteness, 100)}%`,
                  background: `linear-gradient(90deg, #3b82f6, #1d4ed8)`,
                }}
              />
            </div>
          </div>
          {d.missingMonths.length > 0 && (
            <div className="mt-2 text-[11px] text-amber-600 bg-amber-50 rounded-lg px-2.5 py-1.5">
              未归因：{d.missingMonths.length > 3
                ? `${d.missingMonths[0].year}/${d.missingMonths[0].month} 等 ${d.missingMonths.length} 个月`
                : d.missingMonths.map(m => `${m.year}/${m.month}`).join('、')
              }
            </div>
          )}
        </ReportCard>

        {/* ── 模块4：健康评分明细 ── */}
        <ReportCard title="健康评分明细" icon={<Activity size={14} style={{ color: themeConfig.primary }} />}>
          <div className="space-y-2">
            {[
              { label: '配置结构', weight: '40%', score: d.healthScore.configScore.score, grade: d.healthScore.configScore.level },
              { label: '波动控制', weight: '30%', score: d.healthScore.volatilityScore.score, grade: d.healthScore.volatilityScore.level },
              { label: '归因完整', weight: '30%', score: d.healthScore.attributionCompleteness, grade: getGrade(d.healthScore.attributionCompleteness) },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-3">
                <span className="text-[12px] text-gray-500 w-16 shrink-0">{item.label}</span>
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${item.score}%`, backgroundColor: themeConfig.primary }} />
                </div>
                <span className="text-[12px] font-bold w-6 text-right" style={{ color: GRADE_COLORS[item.grade] }}>{item.score}</span>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: `${GRADE_COLORS[item.grade]}15`, color: GRADE_COLORS[item.grade] }}>
                  {item.grade}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-2 border-t border-gray-100 text-[11px] text-gray-500 leading-relaxed">
            {d.healthScore.score >= 80 && '资产配置结构良好，波动稳定，建议继续保持。'}
            {d.healthScore.score >= 60 && d.healthScore.score < 80 && '整体表现尚可，部分维度有优化空间，建议关注偏离参考区间的配置类别。'}
            {d.healthScore.score < 60 && '多项指标偏离参考区间，建议调整资产配置结构以降低风险。'}
          </div>
        </ReportCard>

        {/* ── 模块5：关键数据 ── */}
        <ReportCard title="关键数据" icon={<Info size={14} className="text-gray-400" />}>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: '账户总数', value: `${d.allVisibleAccounts.length}个` },
              { label: '已分类', value: `${d.classifiedCount}个` },
              { label: '归因记录', value: `${d.periodAttrs.length}条` },
            ].map(item => (
              <div key={item.label} className="text-center p-2 bg-gray-50 rounded-xl">
                <div className="text-[14px] font-extrabold" style={{ color: themeConfig.primary }}>{item.value}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{item.label}</div>
              </div>
            ))}
          </div>
          {d.goalProgress && (
            <div className="mt-3 pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-gray-400">年度目标进度</span>
                <span className="text-[12px] font-bold" style={{ color: themeConfig.primary }}>{d.goalProgress.progress.toFixed(0)}%</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.min(d.goalProgress.progress, 100)}%`, backgroundColor: themeConfig.primary }} />
              </div>
              <div className="text-[10px] text-gray-400 mt-1">目标 {currencySymbol}{d.goal?.targetAmount?.toFixed(0)}</div>
            </div>
          )}
        </ReportCard>

        <div className="h-8" />
      </div>
    </div>
  );
}

// ── 辅助 ──
function getAccountBalanceForMonthLocal(accountId: string, year: number, month: number): number {
  return getAccountBalanceForMonth(accountId, year, month);
}

// ── 报告卡片容器 ──
function ReportCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-[20px] p-4 border border-gray-100 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-[15px] font-bold text-gray-800">{title}</h3>
      </div>
      {children}
    </div>
  );
}
