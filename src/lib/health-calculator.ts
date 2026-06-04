import type { Account, HealthScore, YearlyGoal } from '@/types';
import {
  calculateTotalAssets,
  calculateNetWorthForMonth,
} from './calculator';
import {
  getAllAttributions,
  getCurrentYearMonth,
  getReferenceIntervals,
  loadData,
} from './storage';
import {
  CATEGORY_KEYS,
  getCategoryPercentages,
} from './allocation-config';

// ─── 等级判定 ───
function getGrade(score: number): 'S' | 'A' | 'B' | 'C' | 'D' {
  if (score >= 90) return 'S';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  return 'D';
}

// ─── 一、配置结构评分（满分100，权重40%） ───
// 四类资产等权重，每类25分。单项评分基于参考区间。
function calculateConfigScore(accounts: Account[], year: number, month: number): {
  score: number;
  level: 'S' | 'A' | 'B' | 'C' | 'D';
  categoryScores: Record<string, number>;
} {
  const totalAssets = calculateTotalAssets(accounts, year, month);
  if (totalAssets === 0) {
    return { score: 0, level: 'D', categoryScores: {} };
  }

  // 计算四类资产金额
  const allocations = { cash: 0, stable: 0, invest: 0, insure: 0 };
  for (const account of accounts) {
    const balance = account.balance;
    switch (account.assetCategory) {
      case 'cash': allocations.cash += balance; break;
      case 'stable': allocations.stable += balance; break;
      case 'invest': allocations.invest += balance; break;
      case 'insure': allocations.insure += balance; break;
      case 'skipped': break; // 已跳过的账户不计入健康评分
      default: allocations.cash += balance; break; // 未分类算现金
    }
  }

  const pcts = getCategoryPercentages(allocations);
  const intervals = getReferenceIntervals();
  const categoryScores: Record<string, number> = {};

  for (const key of CATEGORY_KEYS) {
    const pct = pcts[key];
    const { min, max } = intervals[key];
    let score: number;

    if (pct >= min && pct <= max) {
      score = 100;
    } else if (pct < min) {
      score = Math.max(0, 100 - (min - pct) * 4);
    } else {
      score = Math.max(0, 100 - (pct - max) * 4);
    }

    categoryScores[key] = Math.round(score);
  }

  // 配置结构总分 = 四类得分取平均
  const total = CATEGORY_KEYS.reduce((sum, key) => sum + (categoryScores[key] ?? 0), 0);
  const avgScore = Math.round(total / CATEGORY_KEYS.length);

  return { score: avgScore, level: getGrade(avgScore), categoryScores };
}

// ─── 二、波动控制评分（满分100，权重30%） ───
// 近12个月净资产月变化率的样本标准差
function calculateVolatilityScore(): {
  score: number;
  level: 'S' | 'A' | 'B' | 'C' | 'D';
  standardDeviation: number;
} {
  const { year: currentYear, month: currentMonth } = getCurrentYearMonth();

  // 收集近12个月的净资产
  const netWorths: { year: number; month: number; nw: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    let y = currentYear;
    let m = currentMonth - i;
    if (m <= 0) { y--; m += 12; }
    const nw = calculateNetWorthForMonth(y, m);
    netWorths.push({ year: y, month: m, nw });
  }

  // 计算月变化率
  const changeRates: number[] = [];
  for (let i = 1; i < netWorths.length; i++) {
    const prev = netWorths[i - 1].nw;
    const curr = netWorths[i].nw;
    if (prev !== 0) {
      changeRates.push(((curr - prev) / Math.abs(prev)) * 100);
    }
  }

  if (changeRates.length < 2) {
    return { score: 100, level: 'S', standardDeviation: 0 };
  }

  // 样本标准差（除以 n-1）
  const mean = changeRates.reduce((a, b) => a + b, 0) / changeRates.length;
  const squaredDiffs = changeRates.map(rate => Math.pow(rate - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / (changeRates.length - 1);
  const stdDev = Math.sqrt(variance);

  // 分段线性评分
  let score: number;
  if (stdDev <= 2) {
    score = 100;
  } else if (stdDev <= 5) {
    score = 100 - ((stdDev - 2) / 3) * 20;
  } else if (stdDev <= 10) {
    score = 80 - ((stdDev - 5) / 5) * 20;
  } else if (stdDev <= 20) {
    score = 60 - ((stdDev - 10) / 10) * 20;
  } else {
    score = 20;
  }

  return {
    score: Math.round(Math.max(0, Math.min(100, score))),
    level: getGrade(Math.round(score)),
    standardDeviation: Math.round(stdDev * 100) / 100,
  };
}

// ─── 三、归因完整评分（满分100，权重30%） ───
// 本年度已归因月份 ÷ 应归因月份(1月~当前月)
function calculateAttributionCompleteness(): number {
  const attributions = getAllAttributions();
  const { year: currentYear, month: currentMonth } = getCurrentYearMonth();

  const monthsWithRecord = new Set<number>(
    attributions.filter(a => a.year === currentYear).map(a => a.month)
  );

  const totalMonths = currentMonth;
  const recordedMonths = monthsWithRecord.size;

  return totalMonths > 0 ? Math.round((recordedMonths / totalMonths) * 100) : 0;
}

// ─── 综合分计算 ───
export function calculateHealthScore(accounts: Account[], year: number, month: number): HealthScore {
  const configScore = calculateConfigScore(accounts, year, month);
  const volatilityScore = calculateVolatilityScore();
  const attributionCompleteness = calculateAttributionCompleteness();

  // 综合分 = 配置×40% + 波动×30% + 归因×30%
  const totalScore = Math.round(
    configScore.score * 0.4 + volatilityScore.score * 0.3 + attributionCompleteness * 0.3
  );

  return {
    score: totalScore,
    level: getGrade(totalScore),
    configScore: {
      score: configScore.score,
      level: configScore.level,
      categoryScores: configScore.categoryScores,
    },
    volatilityScore: {
      score: volatilityScore.score,
      level: volatilityScore.level,
      standardDeviation: volatilityScore.standardDeviation,
    },
    attributionCompleteness,
  };
}

// ─── 以下为辅助函数，保持不变 ───

export function calculateMaxDrawdown(months: number = 12): number {
  const attributions = getAllAttributions();
  if (attributions.length === 0) return 0;

  const sorted = [...attributions]
    .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month)
    .slice(-months);

  if (sorted.length < 2) return 0;

  let peak = 100;
  let current = 100;
  let maxDrawdown = 0;

  for (const attr of sorted) {
    current = current * (1 + attr.changePercent / 100);
    if (current > peak) peak = current;
    const drawdown = ((peak - current) / peak) * 100;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  return Math.round(maxDrawdown * 100) / 100;
}

export function calculateGoalProgress(
  currentNetWorth: number,
  goal: YearlyGoal
): {
  progress: number;
  estimatedMonthsToGoal: number;
  isOnTrack: boolean;
  monthlyGrowthRate: number;  // 本年已记录月份的实际增长均值
  currentMonthChange: number; // 本月（currentMonth）vs 上月的实际净增
} {
  const progress = Math.min(100, (currentNetWorth / goal.targetAmount) * 100);

  const { year: curYear, month: curMonth } = getCurrentYearMonth();

  // ── 通用工具：指定年-月是否有记账记录 ──
  // 必须提前到 currentMonthChange 之前定义，否则下面 hasCurrentRecord 会触发 TDZ。
  const hasRecordInMonth = (year: number, month: number): boolean => {
    const data = loadData();
    return data.records.some(r => r.year === year && r.month === month);
  };

  // ── 本月净增：当前月 vs 上一个月的净资产差值（绝对金额）──
  // 关键修复：当前月若未记账，必须直接返回 0，不能回退到上月数据，
  // 否则会把「上月 vs 上上月」的差值误显示为「本月净增」。
  let currentMonthChange = 0;
  const hasCurrentRecord = hasRecordInMonth(curYear, curMonth);
  if (hasCurrentRecord) {
    const prevMonth = curMonth === 1 ? 12 : curMonth - 1;
    const prevYearOfCur = curMonth === 1 ? curYear - 1 : curYear;
    try {
      const curNW = calculateNetWorthForMonth(curYear, curMonth);
      const prevNW = calculateNetWorthForMonth(prevYearOfCur, prevMonth);
      currentMonthChange = curNW - prevNW;
    } catch {
      currentMonthChange = 0;
    }
  } else {
    currentMonthChange = 0; // 本月未记账，不回退到上月数据
  }

  // ── 月均增长：跳过「真·起点月」，只算后续真实月度净增均值 ──
  // 起点月 = 本年第一个有显式记账记录的月份。
  //   - 真起点：上一个月（去年 12 月 / 本年上一月）无记录 → 起点月是「从 0 跳到本年起点」的跳变月，
  //     把它算进去会把基数误识别为增长，拉高均值，必须排除。
  //   - 假起点：上一个月也有记录 → 起点月是「连续记账中的当月首月」，本身是正常增长月，不能排除。
  const findBaseMonth = (year: number): number => {
    for (let m = 1; m <= 12; m++) {
      if (hasRecordInMonth(year, m)) return m;
    }
    return -1; // 本年无任何记录
  };

  const baseMonth = findBaseMonth(goal.year);

  // 判断 baseMonth 是否为「真·起点月」
  const prevOfBase = baseMonth === 1 ? 12 : baseMonth - 1;
  const prevOfBaseYear = baseMonth === 1 ? goal.year - 1 : goal.year;
  const isRealStart = baseMonth > 0 && !hasRecordInMonth(prevOfBaseYear, prevOfBase);

  let monthlyGrowthRate = 0;
  let monthlyGrowthCount = 0;

  // 1) 优先使用归因记录
  const attributionsThisYear = getAllAttributions()
    .filter(a => a.year === goal.year)
    .sort((a, b) => a.month - b.month);

  if (attributionsThisYear.length > 0 && baseMonth > 0) {
    // 真起点：排除 baseMonth（跳变月不能算增长）
    // 假起点：连续记账，baseMonth 本身是有效增长月，全部纳入
    const eligibleAttrs = isRealStart
      ? attributionsThisYear.filter(a => a.month > baseMonth)
      : attributionsThisYear;
    if (eligibleAttrs.length > 0) {
      const totalChange = eligibleAttrs.reduce((sum, a) => sum + a.change, 0);
      monthlyGrowthRate = totalChange / eligibleAttrs.length;
      monthlyGrowthCount = eligibleAttrs.length;
    }
  }

  // 2) 兜底：从净资产月度变化推算
  if (monthlyGrowthRate === 0 && baseMonth > 0) {
    const changes: number[] = [];
    const maxMonth = Math.min(curMonth, 12);
    // 真起点从 baseMonth+1 起（跳过跳变月）；假起点从 baseMonth 起（首月即有效）
    const startMonth = isRealStart ? baseMonth + 1 : baseMonth;
    for (let m = startMonth; m <= maxMonth; m++) {
      // 要求：当前月和上月都得有真实记录，才视为有效"增长月"
      if (!hasRecordInMonth(goal.year, m)) continue;
      const prevM = m === 1 ? 12 : m - 1;
      const prevY = m === 1 ? goal.year - 1 : goal.year;
      if (!hasRecordInMonth(prevY, prevM)) continue;

      try {
        const nw = calculateNetWorthForMonth(goal.year, m);
        const prevNw = calculateNetWorthForMonth(prevY, prevM);
        changes.push(nw - prevNw);
      } catch {
        // 月份无数据，跳过
      }
    }

    if (changes.length > 0) {
      monthlyGrowthRate = changes.reduce((s, c) => s + c, 0) / changes.length;
      monthlyGrowthCount = changes.length;
    }
  }

  const remainingAmount = goal.targetAmount - currentNetWorth;
  let estimatedMonthsToGoal = 0;
  let isOnTrack = false;

  if (remainingAmount <= 0) {
    estimatedMonthsToGoal = 0;
    isOnTrack = true;
  } else if (monthlyGrowthRate > 0) {
    estimatedMonthsToGoal = Math.ceil(remainingAmount / monthlyGrowthRate);
    // 以本年剩余月份为参考判断是否可达成
    isOnTrack = estimatedMonthsToGoal <= (12 - (curMonth - 1));
  } else if (monthlyGrowthRate < 0) {
    estimatedMonthsToGoal = -1;
    isOnTrack = false;
  }

  return {
    progress: Math.round(progress * 100) / 100,
    estimatedMonthsToGoal,
    isOnTrack,
    monthlyGrowthRate: Math.round(monthlyGrowthRate * 100) / 100,
    currentMonthChange: Math.round(currentMonthChange * 100) / 100,
  };
}

export function getMonthlyNetWorthTrend(months: number = 12): Array<{
  month: string;
  netWorth: number;
}> {
  const { year: currentYear, month: currentMonth } = getCurrentYearMonth();
  const data: Array<{ month: string; netWorth: number }> = [];

  for (let i = months - 1; i >= 0; i--) {
    let year = currentYear;
    let month = currentMonth - i;
    if (month <= 0) { year--; month += 12; }
    const netWorth = calculateNetWorthForMonth(year, month);
    if (netWorth !== undefined && netWorth !== null) {
      data.push({ month: `${month.toString().padStart(2, '0')}`, netWorth });
    }
  }

  return data;
}
