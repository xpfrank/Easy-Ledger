import type { Account, HealthScore, YearlyGoal } from '@/types';
import {
  calculateTotalAssets,
  calculateTotalLiabilities,
  calculateNetWorthForMonth,
} from './calculator';
import {
  getAllAttributions,
  getCurrentYearMonth,
} from './storage';

/**
 * 获取特定月份的账户配置比例
 */
function getAccountRatios(accounts: Account[], year: number, month: number) {
  const totalAssets = calculateTotalAssets(accounts, year, month);
  
  // 现金类账户: cash, debit (储蓄卡和借记卡作为现金池)
  const cashAccounts = accounts.filter(a => a.type === 'cash' || a.type === 'debit');
  let cashBalance = 0;
  for (const account of cashAccounts) {
    const record = { balance: account.balance };
    cashBalance += record.balance;
  }

  // 投资类账户: investment, digital (部分)
  const investmentAccounts = accounts.filter(a => a.type === 'investment' || (a.type === 'digital' && a.name.includes('基金')));
  let investmentBalance = 0;
  for (const account of investmentAccounts) {
    investmentBalance += account.balance;
  }

  // 数字资产: digital (余额宝等)
  const digitalAccounts = accounts.filter(a => a.type === 'digital' && !a.name.includes('基金'));
  let digitalBalance = 0;
  for (const account of digitalAccounts) {
    digitalBalance += account.balance;
  }

  const totalLiabilities = calculateTotalLiabilities(accounts, year, month);

  return {
    cashRatio: totalAssets > 0 ? (cashBalance / totalAssets) * 100 : 0,
    investmentRatio: totalAssets > 0 ? ((investmentBalance + digitalBalance) / totalAssets) * 100 : 0,
    debtRatio: totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0,
  };
}

/**
 * 计算配置评分 (A/B+/B/C/D)
 * 基于现金占比、投资占比、负债占比
 */
function calculateConfigScore(ratios: {
  cashRatio: number;
  investmentRatio: number;
  debtRatio: number;
}): { score: number; level: 'A' | 'B+' | 'B' | 'C' | 'D' } {
  let score = 0;
  let details: string[] = [];

  // 现金占比评分 (理想20-40%)
  if (ratios.cashRatio >= 20 && ratios.cashRatio <= 40) {
    score += 30;
    details.push('现金占比合理');
  } else if (ratios.cashRatio >= 15 && ratios.cashRatio <= 50) {
    score += 25;
  } else if (ratios.cashRatio < 10 || ratios.cashRatio > 70) {
    score += 10;
    details.push('现金占比不合理');
  } else {
    score += 20;
  }

  // 投资占比评分 (理想30-60%)
  if (ratios.investmentRatio >= 30 && ratios.investmentRatio <= 60) {
    score += 30;
    details.push('投资配置均衡');
  } else if (ratios.investmentRatio >= 20 && ratios.investmentRatio <= 70) {
    score += 25;
  } else if (ratios.investmentRatio < 10 || ratios.investmentRatio > 80) {
    score += 10;
    details.push('投资配置不够均衡');
  } else {
    score += 20;
  }

  // 负债占比评分 (理想<10%)
  if (ratios.debtRatio < 10) {
    score += 40;
    details.push('负债水平健康');
  } else if (ratios.debtRatio < 30) {
    score += 30;
  } else if (ratios.debtRatio < 50) {
    score += 15;
    details.push('负债水平偏高');
  } else {
    score += 5;
  }

  // 转换为等级
  let level: 'A' | 'B+' | 'B' | 'C' | 'D';
  if (score >= 90) {
    level = 'A';
  } else if (score >= 80) {
    level = 'B+';
  } else if (score >= 70) {
    level = 'B';
  } else if (score >= 50) {
    level = 'C';
  } else {
    level = 'D';
  }

  return { score: Math.round(score), level };
}

/**
 * 计算波动控制评分 (A/B+/B/C/D)
 * 基于近12个月的变化率标准差
 */
function calculateVolatilityScore(): {
  score: number;
  level: 'A' | 'B+' | 'B' | 'C' | 'D';
  standardDeviation: number;
} {
  const attributions = getAllAttributions();
  
  if (attributions.length === 0) {
    return { score: 60, level: 'B', standardDeviation: 0 };
  }

  // 获取最近12个月的变化率
  const changeRates = attributions
    .sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    })
    .slice(0, 12)
    .map(a => a.changePercent);

  if (changeRates.length === 0) {
    return { score: 60, level: 'B', standardDeviation: 0 };
  }

  // 计算平均值
  const mean = changeRates.reduce((a, b) => a + b, 0) / changeRates.length;

  // 计算标准差
  const squaredDiffs = changeRates.map(rate => Math.pow(rate - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / changeRates.length;
  const stdDev = Math.sqrt(variance);

  // 根据标准差确定等级
  let score: number;
  let level: 'A' | 'B+' | 'B' | 'C' | 'D';

  if (stdDev < 3) {
    score = 95;
    level = 'A';
  } else if (stdDev < 8) {
    score = 80;
    level = 'B+';
  } else if (stdDev < 15) {
    score = 65;
    level = 'B';
  } else if (stdDev < 25) {
    score = 45;
    level = 'C';
  } else {
    score = 20;
    level = 'D';
  }

  return { score: Math.round(score), level, standardDeviation: Math.round(stdDev * 100) / 100 };
}

/**
 * 计算归因完整度 (0-100%)
 * 基于当前年度：有归因记录的月份数 ÷ 当前年度已过月份数（1月~当前月）
 */
function calculateAttributionCompleteness(): number {
  const attributions = getAllAttributions();
  const { year: currentYear, month: currentMonth } = getCurrentYearMonth();

  // 统计当前年度哪些月份有归因记录
  const monthsWithRecord = new Set<number>(
    attributions
      .filter(a => a.year === currentYear)
      .map(a => a.month)
  );

  // 应统计的总月份数 = 1月 到当前月（含当前月）
  const totalMonths = currentMonth;
  const recordedMonths = monthsWithRecord.size;

  return totalMonths > 0 ? Math.round((recordedMonths / totalMonths) * 100) : 0;
}

/**
 * 计算总体健康度分数
 */
export function calculateHealthScore(accounts: Account[], year: number, month: number): HealthScore {
  const ratios = getAccountRatios(accounts, year, month);
  const configScore = calculateConfigScore(ratios);
  const volatilityScore = calculateVolatilityScore();
  const attributionCompleteness = calculateAttributionCompleteness();

  // 总体分数 = 配置(40%) + 波动(40%) + 完整度(20%)
  const totalScore = Math.round(
    configScore.score * 0.4 + volatilityScore.score * 0.4 + (attributionCompleteness * 1.0) * 0.2
  );

  let overallLevel: 'A' | 'B+' | 'B' | 'C' | 'D';
  if (totalScore >= 90) {
    overallLevel = 'A';
  } else if (totalScore >= 80) {
    overallLevel = 'B+';
  } else if (totalScore >= 70) {
    overallLevel = 'B';
  } else if (totalScore >= 50) {
    overallLevel = 'C';
  } else {
    overallLevel = 'D';
  }

  return {
    score: totalScore,
    level: overallLevel,
    configScore: {
      score: configScore.score,
      level: configScore.level,
      cashRatio: Math.round(ratios.cashRatio * 100) / 100,
      investmentRatio: Math.round(ratios.investmentRatio * 100) / 100,
      debtRatio: Math.round(ratios.debtRatio * 100) / 100,
    },
    volatilityScore: {
      score: volatilityScore.score,
      level: volatilityScore.level,
      standardDeviation: volatilityScore.standardDeviation,
    },
    attributionCompleteness,
  };
}

/**
 * 计算年度目标进度
 */
export function calculateGoalProgress(
  currentNetWorth: number,
  goal: YearlyGoal
): {
  progress: number;
  estimatedMonthsToGoal: number;
  isOnTrack: boolean;
  monthlyGrowthRate: number;
} {
  const progress = Math.min(100, (currentNetWorth / goal.targetAmount) * 100);

  // 计算预计达成时间，基于最近12个月的平均增长率
  const attributions = getAllAttributions()
    .sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    })
    .slice(0, 12);

  let monthlyGrowthRate = 0;
  if (attributions.length > 0) {
    const totalChange = attributions.reduce((sum, a) => sum + a.change, 0);
    monthlyGrowthRate = totalChange / attributions.length;
  }

  const remainingAmount = goal.targetAmount - currentNetWorth;
  let estimatedMonthsToGoal = 0;
  let isOnTrack = false;

  if (remainingAmount <= 0) {
    estimatedMonthsToGoal = 0;
    isOnTrack = true;
  } else if (monthlyGrowthRate > 0) {
    estimatedMonthsToGoal = Math.ceil(remainingAmount / monthlyGrowthRate);
    isOnTrack = estimatedMonthsToGoal <= (12 - new Date().getMonth());
  } else if (monthlyGrowthRate < 0) {
    estimatedMonthsToGoal = -1;
    isOnTrack = false;
  } else {
    estimatedMonthsToGoal = 0;
    isOnTrack = false;
  }

  return {
    progress: Math.round(progress * 100) / 100,
    estimatedMonthsToGoal,
    isOnTrack,
    monthlyGrowthRate: Math.round(monthlyGrowthRate * 100) / 100,
  };
}

/**
 * 获取净资产月度数据用于图表
 */
export function getMonthlyNetWorthTrend(months: number = 12): Array<{
  month: string;
  netWorth: number;
}> {
  const { year: currentYear, month: currentMonth } = getCurrentYearMonth();
  const data: Array<{ month: string; netWorth: number }> = [];

  for (let i = months - 1; i >= 0; i--) {
    let year = currentYear;
    let month = currentMonth - i;
    if (month <= 0) {
      year--;
      month += 12;
    }

    const netWorth = calculateNetWorthForMonth(year, month);
    if (netWorth !== undefined && netWorth !== null) {
      data.push({
        month: `${month.toString().padStart(2, '0')}`,
        netWorth,
      });
    }
  }

  return data;
}
