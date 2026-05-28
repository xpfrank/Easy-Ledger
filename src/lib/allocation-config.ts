import type { LifeStage } from '@/types';

export type AssetCategoryKey = 'cash' | 'stable' | 'invest' | 'insure';

export interface CategoryInterval {
  min: number;
  max: number;
}

export interface ReferenceIntervals {
  cash: CategoryInterval;
  stable: CategoryInterval;
  invest: CategoryInterval;
  insure: CategoryInterval;
}

export type IntervalSource = 'system' | 'life_stage' | 'template' | 'custom';

export type CategoryAmounts = Record<AssetCategoryKey, number>;

export type IntervalStatus = 'below' | 'within' | 'above' | 'empty';

export const CATEGORY_KEYS: AssetCategoryKey[] = ['cash', 'stable', 'invest', 'insure'];

export const CATEGORY_META: Record<
  AssetCategoryKey,
  { label: string; shortLabel: string; color: string; icon: string }
> = {
  cash: { label: '现金/应急', shortLabel: '现金', color: '#22c55e', icon: '💧' },
  stable: { label: '稳健储蓄', shortLabel: '稳健', color: '#0ea5e9', icon: '🏦' },
  invest: { label: '投资增值', shortLabel: '投资', color: '#a855f7', icon: '📈' },
  insure: { label: '保险保障', shortLabel: '保障', color: '#f59e0b', icon: '🛡️' },
};

/** 系统默认（平衡型） */
export const SYSTEM_DEFAULT_INTERVALS: ReferenceIntervals = {
  cash: { min: 10, max: 25 },
  stable: { min: 25, max: 45 },
  invest: { min: 25, max: 50 },
  insure: { min: 5, max: 15 },
};

/** 人生阶段预设 */
export const LIFE_STAGE_INTERVALS: Record<
  LifeStage,
  { label: string; emoji: string; desc: string; intervals: ReferenceIntervals }
> = {
  student: {
    label: '学生 / 初入职场',
    emoji: '🎓',
    desc: '收入起步，风险承受能力有限',
    intervals: {
      cash: { min: 20, max: 30 },
      stable: { min: 30, max: 40 },
      invest: { min: 30, max: 40 },
      insure: { min: 5, max: 5 },
    },
  },
  growth: {
    label: '成长期',
    emoji: '🌱',
    desc: '收入稳定上升，可承担适度风险',
    intervals: {
      cash: { min: 10, max: 20 },
      stable: { min: 30, max: 40 },
      invest: { min: 35, max: 45 },
      insure: { min: 5, max: 10 },
    },
  },
  family: {
    label: '家庭期',
    emoji: '🏠',
    desc: '责任加重，需提高稳健配置',
    intervals: {
      cash: { min: 15, max: 25 },
      stable: { min: 35, max: 45 },
      invest: { min: 20, max: 30 },
      insure: { min: 10, max: 10 },
    },
  },
  'pre-retire': {
    label: '准退休期',
    emoji: '☀️',
    desc: '风险敞口收缩，以保值为主',
    intervals: {
      cash: { min: 25, max: 35 },
      stable: { min: 45, max: 55 },
      invest: { min: 10, max: 20 },
      insure: { min: 5, max: 5 },
    },
  },
};

/** 快速模板（预览/应用） */
export const INTERVAL_TEMPLATES: Record<
  string,
  { label: string; desc: string; intervals: ReferenceIntervals }
> = {
  balanced: {
    label: '平衡型',
    desc: '攻守兼备的默认参考',
    intervals: SYSTEM_DEFAULT_INTERVALS,
  },
  conservative: {
    label: '保守型',
    desc: '提高现金与稳健占比',
    intervals: {
      cash: { min: 20, max: 35 },
      stable: { min: 40, max: 55 },
      invest: { min: 10, max: 25 },
      insure: { min: 5, max: 15 },
    },
  },
  aggressive: {
    label: '进取型',
    desc: '提高投资占比上限',
    intervals: {
      cash: { min: 5, max: 15 },
      stable: { min: 20, max: 35 },
      invest: { min: 40, max: 65 },
      insure: { min: 5, max: 10 },
    },
  },
  'pre-retire-template': {
    label: '准退休型',
    desc: '保值为主、降低波动',
    intervals: LIFE_STAGE_INTERVALS['pre-retire'].intervals,
  },
};

export const NEUTRAL_STATUS_LABEL: Record<IntervalStatus, string> = {
  below: '低于参考区间',
  within: '在区间内',
  above: '高于参考值',
  empty: '暂无数据',
};

export function clampInterval(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

export function normalizeIntervals(raw: ReferenceIntervals): ReferenceIntervals {
  const result = { ...raw };
  for (const key of CATEGORY_KEYS) {
    let min = clampInterval(result[key].min);
    let max = clampInterval(result[key].max);
    if (min > max) [min, max] = [max, min];
    result[key] = { min, max };
  }
  return result;
}

export function getIntervalStatus(
  pct: number,
  min: number,
  max: number,
  hasAmount: boolean
): IntervalStatus {
  if (!hasAmount) return 'empty';
  if (pct < min) return 'below';
  if (pct > max) return 'above';
  return 'within';
}

export function getCategoryPercentages(amounts: CategoryAmounts): Record<AssetCategoryKey, number> {
  const total = CATEGORY_KEYS.reduce((s, k) => s + amounts[k], 0);
  if (total === 0) {
    return { cash: 0, stable: 0, invest: 0, insure: 0 };
  }
  const result = {} as Record<AssetCategoryKey, number>;
  for (const key of CATEGORY_KEYS) {
    result[key] = Math.round((amounts[key] / total) * 100);
  }
  return result;
}

/** 单类配置得分：区间内 100，区间外线性递减 */
export function scoreCategoryAgainstInterval(pct: number, min: number, max: number): number {
  if (pct >= min && pct <= max) return 100;
  const distance = pct < min ? min - pct : pct - max;
  return Math.max(0, Math.round(100 - distance * 5));
}

/** 四类平均配置结构得分 */
export function calculateAllocationConfigScore(
  amounts: CategoryAmounts,
  intervals: ReferenceIntervals
): number {
  const pcts = getCategoryPercentages(amounts);
  const scores = CATEGORY_KEYS.map((key) => {
    const hasAmount = amounts[key] > 0;
    if (!hasAmount) return 50;
    return scoreCategoryAgainstInterval(pcts[key], intervals[key].min, intervals[key].max);
  });
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

export function intervalsFromLifeStage(stage: LifeStage): ReferenceIntervals {
  return { ...LIFE_STAGE_INTERVALS[stage].intervals };
}

/** 根据当前占比生成初始区间（±10%，限制 0–100） */
export function generateIntervalsFromAllocations(amounts: CategoryAmounts): ReferenceIntervals {
  const pcts = getCategoryPercentages(amounts);
  const total = CATEGORY_KEYS.reduce((s, k) => s + amounts[k], 0);
  if (total === 0) return { ...SYSTEM_DEFAULT_INTERVALS };

  const result = {} as ReferenceIntervals;
  for (const key of CATEGORY_KEYS) {
    const pct = pcts[key];
    result[key] = {
      min: clampInterval(pct - 10),
      max: clampInterval(pct + 10),
    };
    if (result[key].min === result[key].max) {
      result[key].max = clampInterval(result[key].min + 5);
    }
  }
  return normalizeIntervals(result);
}

export interface OptimizationSuggestion {
  id: string;
  priority: number;
  text: string;
  category?: AssetCategoryKey;
}

export function generateOptimizationSuggestions(
  amounts: CategoryAmounts,
  intervals: ReferenceIntervals,
  ignoredIds: string[] = [],
  monthlyExpense?: number | null
): OptimizationSuggestion[] {
  const pcts = getCategoryPercentages(amounts);
  const total = CATEGORY_KEYS.reduce((s, k) => s + amounts[k], 0);
  if (total === 0) return [];

  const suggestions: OptimizationSuggestion[] = [];

  if (monthlyExpense && monthlyExpense > 0 && amounts.cash > 0) {
    const monthsCovered = amounts.cash / monthlyExpense;
    if (monthsCovered < 3) {
      suggestions.push({
        id: 'liquidity-low',
        priority: 100,
        text: `现金约可覆盖 ${monthsCovered.toFixed(1)} 个月支出，低于 3 个月时建议优先补充流动性`,
        category: 'cash',
      });
    }
  }

  for (const key of CATEGORY_KEYS) {
    const pct = pcts[key];
    const { min, max } = intervals[key];
    const meta = CATEGORY_META[key];
    if (amounts[key] === 0) continue;

    if (pct < min) {
      const diff = Math.round(min - pct);
      suggestions.push({
        id: `${key}-below`,
        priority: diff * 10,
        category: key,
        text: `将${meta.shortLabel}从 ${pct}% 提升至你的参考下限 ${min}%（约差 ${diff} 个百分点），可考虑从其他类别调整`,
      });
    } else if (pct > max) {
      const diff = Math.round(pct - max);
      suggestions.push({
        id: `${key}-above`,
        priority: diff * 10,
        category: key,
        text: `${meta.shortLabel}当前 ${pct}% 高于你的参考上限 ${max}%（约超 ${diff} 个百分点），可按你的计划逐步调整`,
      });
    }
  }

  return suggestions
    .filter((s) => !ignoredIds.includes(s.id))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 4);
}

export function scoreToLevel(score: number): 'S' | 'A' | 'B' | 'C' | 'D' {
  if (score >= 90) return 'S';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 50) return 'C';
  return 'D';
}
