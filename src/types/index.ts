// 账户类型枚举
export type AccountType = 'cash' | 'debit' | 'credit' | 'digital' | 'investment' | 'loan' | 'debt';

// 账户类型配置
export interface AccountTypeConfig {
  type: AccountType;
  label: string;
  icon: string;
  color: string;
}

// 账户对象
export interface Account {
  id: string;
  name: string;
  type: AccountType;
  icon: string;
  balance: number;
  includeInTotal: boolean;
  isHidden: boolean;
  note?: string;
  billDay?: number;
  repaymentDay?: number;
  graceDays?: number;
  creditLimit?: number;
  sortOrder?: number;
  /** 自定义账户类型的显示名称；内置类型此字段为空 */
  customTypeLabel?: string;
  /** 账户币种代码，如 CNY/USD/EUR，默认 CNY */
  currency?: string;
  /** 记账页面独立排序权重 */
  recordSortOrder?: number;
  /** 快速分类：现金/应急 | 稳健储蓄 | 投资增值 | 保险保障 | 已跳过 */
  assetCategory?: 'cash' | 'stable' | 'invest' | 'insure' | 'skipped' | null;
}

// 月度记录
export interface MonthlyRecord {
  id: string;
  accountId: string;
  year: number;
  month: number;
  balance: number;
}

// 记账日志
export interface RecordLog {
  id: string;
  accountId: string;
  accountName: string;
  year: number;
  month: number;
  oldBalance: number;
  newBalance: number;
  timestamp: number;
  operationType?: 'balance_change' | 'account_create' | 'account_edit' | 'account_delete';
}

// 应用状态
// 自定义账户类型
export interface CustomAccountType {
  id: string;
  label: string;
  icon: string;
  /** 'asset' | 'liability' */
  behavior: 'asset' | 'liability';
}


/** 按月存储的汇率历史快照 */
export interface ExchangeRateSnapshot {
  code: string;   // 币种代码
  year: number;
  month: number;
  rate: number;   // 该月 1单位外币兑基准货币的汇率
}

/** 内置默认汇率表（1单位外币兑 CNY） */
export const DEFAULT_EXCHANGE_RATES: Record<string, number> = {
  CNY: 1,    USD: 7.2,   EUR: 7.8,  JPY: 0.048,
  GBP: 9.1,  HKD: 0.92,  TWD: 0.22, KRW: 0.0053,
  SGD: 5.35, AUD: 4.7,   CAD: 5.25, CHF: 8.1,
  MYR: 1.52, THB: 0.2,   RUB: 0.08,
};
export interface AppState {
  accounts: Account[];
  records: MonthlyRecord[];
  logs: RecordLog[];
  attributions: MonthlyAttribution[];
  yearlyAttributions: YearlyAttribution[];
  monthlyAccountConfigs: MonthlyAccountConfig[];
  customAccountTypes: CustomAccountType[];
  settings: AppSettings;
  exchangeRateHistory?: ExchangeRateSnapshot[];
  version: string;
}

// 主题类型
export type ThemeType = 'blue' | 'green' | 'orange' | 'dark' | 'purple';

// 人生阶段
export type LifeStage = 'student' | 'growth' | 'family' | 'pre-retire';

/** 四类资产参考区间（用户可自定义） */
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

// 时间范围
export type TimeRange = '6' | '12' | 'all';

// 年度目标
export interface YearlyGoal {
  year: number;
  targetAmount: number;
  createdAt?: number;
}

// 健康评分
export interface HealthScore {
  score: number;
  level: 'S' | 'A' | 'B' | 'C' | 'D';
  configScore: {
    score: number;
    level: 'S' | 'A' | 'B' | 'C' | 'D';
    categoryScores: Record<string, number>;
  };
  volatilityScore: {
    score: number;
    level: 'S' | 'A' | 'B' | 'C' | 'D';
    standardDeviation: number;
  };
  attributionCompleteness: number;
}

// 应用设置
export interface AppSettings {
  hideBalance: boolean;
  theme: ThemeType;
  yearlyGoal?: YearlyGoal;
  /** 主货币（影响金额显示格式），默认 CNY */
  baseCurrency?: string;
  /** 用户自定义汇率表，key = 币种代码 */
  exchangeRates?: Record<string, { rate: number; updatedAt: number }>;
  /** 人生阶段 */
  lifeStage?: LifeStage;
  lifeStageUpdatedAt?: number;
  /** 四类资产参考区间 */
  referenceIntervals?: ReferenceIntervals;
  /** 区间来源 */
  intervalSource?: IntervalSource;
  /** 若来源为人生阶段，记录对应阶段 */
  intervalLifeStage?: LifeStage;
  /** 已忽略的健康优化建议 ID */
  ignoredSuggestions?: string[];
  /** 月支出预算（用于现金覆盖月数；优先于自动估算） */
  monthlyExpenseBudget?: number;
}

// 月度账户配置：记录某月某账户的"存在状态"
export interface MonthlyAccountConfig {
  id: string;
  accountId: string;
  year: number;
  month: number;
  status: 'active' | 'deleted';
  firstActiveYear: number;
  firstActiveMonth: number;
}

// 月度净资产汇总
export interface MonthlyNetWorth {
  year: number;
  month: number;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  change: number;
  changePercent: number;
}

// 年度净资产汇总
export interface YearlyNetWorth {
  year: number;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  lastRecordedMonth: number;
  change: number;
  changePercent: number;
}

// 账户分组
export interface AccountGroup {
  type: AccountType | string;
  label: string;
  accounts: Account[];
  totalBalance: number;
}

// 图标配置
export type IconCategory = 'finance' | 'investment' | 'life' | 'work';

export interface IconConfig {
  name: string;
  label: string;
  icon: string;
  category?: IconCategory;
}

// 页面路由
export type PageRoute = 'home' | 'accounts' | 'record' | 'trend' | 'settings' | 'account-edit' | 'record-logs' | 'account-detail' | 'account-flow' | 'balance-sankey';

// 记账模式
export type RecordMode = 'monthly' | 'yearly';

// 波动评级
export type FluctuationLevel = 'normal' | 'warning' | 'abnormal';

// 归因标签分类
export interface AttributionCategory {
  id: string;
  label: string;
  emoji: string;
  color: string;
}

export const ATTRIBUTION_CATEGORIES: AttributionCategory[] = [
  { id: 'income', label: '收入类', emoji: '📥', color: '#22c55e' },
  { id: 'expense', label: '支出/流出类', emoji: '📤', color: '#ef4444' },
  { id: 'adjust', label: '调整类', emoji: '🔄', color: '#3b82f6' },
  { id: 'other', label: '其他', emoji: '📋', color: '#6b7280' },
];

// 归因标签类型
export type AttributionTag =
  | 'salary'
  | 'investment'
  | 'daily'
  | 'other'
  | 'salary_income'
  | 'bonus'
  | 'year_end_bonus'
  | 'loan_repayment'
  | 'large_expense'
  | 'transfer'
  | 'abnormal_other';

// 标签配置
export interface TagConfig {
  value: AttributionTag;
  label: string;
  emoji: string;
  isRequired: boolean;
}

// 正常变化可选标签
export const NORMAL_TAGS: TagConfig[] = [
  { value: 'salary', label: '工资积累', emoji: '💰', isRequired: false },
  { value: 'investment', label: '投资收益', emoji: '📈', isRequired: false },
  { value: 'daily', label: '日常波动', emoji: '🔄', isRequired: false },
  { value: 'other', label: '其他', emoji: '📝', isRequired: false },
];

// 异常变化必选标签
export const ABNORMAL_TAGS: TagConfig[] = [
  { value: 'salary_income', label: '工资收入', emoji: '💰', isRequired: true },
  { value: 'bonus', label: '奖金', emoji: '🎁', isRequired: true },
  { value: 'year_end_bonus', label: '年终奖', emoji: '🧧', isRequired: true },
  { value: 'investment', label: '投资收益', emoji: '📈', isRequired: true },
  { value: 'loan_repayment', label: '借款归还', emoji: '🔄', isRequired: true },
  { value: 'large_expense', label: '大额支出', emoji: '🛒', isRequired: true },
  { value: 'transfer', label: '转账调整', emoji: '🔀', isRequired: true },
  { value: 'abnormal_other', label: '异常变动', emoji: '📝', isRequired: true },
];

// 自定义归因标签
export interface CustomAttributionTag {
  id: string;
  label: string;
  emoji: string;
  category: string;
  createdAt: string;
}

// 预定义归因标签（用于显示）
export interface PresetTagConfig {
  id: string;
  label: string;
  emoji: string;
  editable: false;
}

// 完整标签配置（含自定义）
export interface TagOption {
  id: string;
  label: string;
  emoji: string;
  editable: boolean;
  category?: string;
}

// 月度归因记录
export interface MonthlyAttribution {
  id: string;
  year: number;
  month: number;
  change: number;
  changePercent: number;
  fluctuationLevel: FluctuationLevel;
  tags: AttributionTag[];
  tagAmounts?: Record<string, number>;  // 各标签分配金额
  currency?: string;
  /** 记账页面独立排序权重 */
  recordSortOrder?: number;  // 保存时的主货币（用于换汇显示）
  note?: string;
  timestamp: number;
}

// 账户余额快照
export interface AccountSnapshot {
  accountId: string;
  accountName: string;
  accountIcon: string;
  accountType: AccountType;
  balance: number;
  change: number;
  currency: string;
}

// 年度归因标签类型
export type YearlyAttributionTag =
  | 'salary_growth'
  | 'bonus_丰厚'
  | 'investment_return'
  | 'asset_change'
  | 'large_expense'
  | 'account_integration'
  | 'yearly_other';

// 年度标签配置
export interface YearlyTagConfig {
  value: YearlyAttributionTag;
  label: string;
  emoji: string;
}

// 年度归因标签
export const YEARLY_TAGS: YearlyTagConfig[] = [
  { value: 'salary_growth', label: '工资增长', emoji: '💰' },
  { value: 'bonus_丰厚', label: '奖金丰厚', emoji: '🎁' },
  { value: 'investment_return', label: '投资丰收', emoji: '📈' },
  { value: 'asset_change', label: '资产变动', emoji: '🏠' },
  { value: 'large_expense', label: '大额支出', emoji: '💸' },
  { value: 'account_integration', label: '账户整合', emoji: '🔄' },
  { value: 'yearly_other', label: '其他', emoji: '📝' },
];

// 年度归因记录
export interface YearlyAttribution {
  id: string;
  year: number;
  netWorth: number;
  change: number;
  changePercent: number;
  tags: YearlyAttributionTag[];
  note?: string;
  keyMonths: string[];
  timestamp: number;
}

// 获取年度归因标签的中文显示
export function getYearlyAttributionTagLabel(tag: YearlyAttributionTag): string {
  const tagLabels: Record<string, string> = {
    salary_growth: '工资增长',
    'bonus_丰厚': '奖金丰厚',
    investment_return: '投资丰收',
    asset_change: '资产变动',
    large_expense: '大额支出',
    account_integration: '账户整合',
    yearly_other: '其他',
  };
  if (tagLabels[tag]) return tagLabels[tag];
  // 自定义标签：直接返回 tag id
  if (tag.startsWith('custom_')) {
    return tag;
  }
  return tag;
}

// 获取年度归因标签的 emoji
export function getYearlyAttributionTagEmoji(tag: YearlyAttributionTag): string {
  const tagEmojis: Record<string, string> = {
    salary_growth: '💰',
    'bonus_丰厚': '🎁',
    investment_return: '📈',
    asset_change: '🏠',
    large_expense: '💸',
    account_integration: '🔄',
    yearly_other: '📝',
  };
  return tagEmojis[tag] || '';
}

export const PRESET_ICONS: IconConfig[] = [
  // ── 金融类 ─────────────────────────────────────
  { name: 'banknote',      label: '现金',    icon: 'banknote',      category: 'finance' },
  { name: 'credit-card',   label: '银行卡',  icon: 'credit-card',   category: 'finance' },
  { name: 'wallet',        label: '钱包',    icon: 'wallet',        category: 'finance' },
  { name: 'coins',         label: '硬币',    icon: 'coins',         category: 'finance' },
  { name: 'piggy-bank',    label: '储蓄',    icon: 'piggy-bank',    category: 'finance' },
  { name: 'landmark',      label: '银行',    icon: 'landmark',      category: 'finance' },
  { name: 'building',      label: '机构',    icon: 'building',      category: 'finance' },
  { name: 'receipt',       label: '收据',    icon: 'receipt',       category: 'finance' },
  { name: 'dollar-sign',   label: '美元',    icon: 'dollar-sign',   category: 'finance' },
  { name: 'euro',          label: '欧元',    icon: 'euro',          category: 'finance' },
  { name: 'bitcoin',       label: '数字货币', icon: 'bitcoin',      category: 'finance' },
  { name: 'gem',           label: '宝石',    icon: 'gem',           category: 'finance' },
  { name: 'shield',        label: '保险',    icon: 'shield',        category: 'finance' },
  { name: 'handshake',     label: '借出',    icon: 'handshake',     category: 'finance' },
  { name: 'clipboard',     label: '借入',    icon: 'clipboard',     category: 'finance' },
  { name: 'lock',          label: '锁定',    icon: 'lock',          category: 'finance' },

  // ── 投资类 ─────────────────────────────────────
  { name: 'trending-up',        label: '涨势',   icon: 'trending-up',        category: 'investment' },
  { name: 'trending-down',      label: '跌势',   icon: 'trending-down',      category: 'investment' },
  { name: 'bar-chart',          label: '柱图',   icon: 'bar-chart',          category: 'investment' },
  { name: 'bar-chart-2',        label: '基金',   icon: 'bar-chart-2',        category: 'investment' },
  { name: 'pie-chart',          label: '配置',   icon: 'pie-chart',          category: 'investment' },
  { name: 'line-chart',         label: '折线',   icon: 'line-chart',         category: 'investment' },
  { name: 'activity',           label: '波动',   icon: 'activity',           category: 'investment' },
  { name: 'candlestick-chart',  label: 'K线',    icon: 'candlestick-chart',  category: 'investment' },
  { name: 'percent',            label: '利率',   icon: 'percent',            category: 'investment' },
  { name: 'arrow-up-right',     label: '收益',   icon: 'arrow-up-right',     category: 'investment' },
  { name: 'layers',             label: '组合',   icon: 'layers',             category: 'investment' },
  { name: 'refresh-cw',         label: '复利',   icon: 'refresh-cw',         category: 'investment' },

  // ── 生活类 ─────────────────────────────────────
  { name: 'home',           label: '房产',   icon: 'home',           category: 'life' },
  { name: 'car',            label: '汽车',   icon: 'car',            category: 'life' },
  { name: 'plane',          label: '旅行',   icon: 'plane',          category: 'life' },
  { name: 'train',          label: '火车',   icon: 'train',          category: 'life' },
  { name: 'bus',            label: '公交',   icon: 'bus',            category: 'life' },
  { name: 'ship',           label: '轮船',   icon: 'ship',           category: 'life' },
  { name: 'shopping-bag',   label: '购物袋', icon: 'shopping-bag',   category: 'life' },
  { name: 'shopping-cart',  label: '购物车', icon: 'shopping-cart',  category: 'life' },
  { name: 'gift',           label: '礼物',   icon: 'gift',           category: 'life' },
  { name: 'heart',          label: '健康',   icon: 'heart',          category: 'life' },
  { name: 'stethoscope',    label: '医疗',   icon: 'stethoscope',    category: 'life' },
  { name: 'pill',           label: '药品',   icon: 'pill',           category: 'life' },
  { name: 'graduation-cap', label: '教育',   icon: 'graduation-cap', category: 'life' },
  { name: 'book',           label: '读书',   icon: 'book',           category: 'life' },
  { name: 'baby',           label: '育儿',   icon: 'baby',           category: 'life' },
  { name: 'coffee',         label: '餐饮',   icon: 'coffee',         category: 'life' },
  { name: 'utensils',       label: '餐具',   icon: 'utensils',       category: 'life' },
  { name: 'smartphone',     label: '手机',   icon: 'smartphone',     category: 'life' },
  { name: 'music',          label: '音乐',   icon: 'music',          category: 'life' },
  { name: 'gamepad-2',      label: '游戏',   icon: 'gamepad-2',      category: 'life' },
  { name: 'umbrella',       label: '雨伞',   icon: 'umbrella',       category: 'life' },
  { name: 'dog',            label: '宠物',   icon: 'dog',            category: 'life' },
  { name: 'map-pin',        label: '地点',   icon: 'map-pin',        category: 'life' },
  { name: 'sun',            label: '阳光',   icon: 'sun',            category: 'life' },

  // ── 工作类 ─────────────────────────────────────
  { name: 'building-2',  label: '办公楼', icon: 'building-2',  category: 'work' },
  { name: 'factory',     label: '工厂',   icon: 'factory',     category: 'work' },
  { name: 'briefcase',   label: '公事包', icon: 'briefcase',   category: 'work' },
  { name: 'file-text',   label: '文件',   icon: 'file-text',   category: 'work' },
  { name: 'calculator',  label: '计算器', icon: 'calculator',  category: 'work' },
  { name: 'printer',     label: '打印',   icon: 'printer',     category: 'work' },
  { name: 'mail',        label: '邮件',   icon: 'mail',        category: 'work' },
  { name: 'phone',       label: '电话',   icon: 'phone',       category: 'work' },
  { name: 'award',       label: '奖项',   icon: 'award',       category: 'work' },
  { name: 'star',        label: '星级',   icon: 'star',        category: 'work' },
  { name: 'target',      label: '目标',   icon: 'target',      category: 'work' },
  { name: 'globe',       label: '国际',   icon: 'globe',       category: 'work' },
  { name: 'flag',        label: '旗帜',   icon: 'flag',        category: 'work' },
  { name: 'newspaper',   label: '报告',   icon: 'newspaper',   category: 'work' },
];


// 主题配置
export interface ThemeConfig {
  name: string;
  primary: string;
  primaryLight: string;
  primaryDark: string;
  gradientFrom: string;
  gradientTo: string;
  bgLight: string;
}

// ── 多币种支持 ──────────────────────────────────────────────────────────────

export interface CurrencyConfig {
  code: string;      // ISO 4217 代码
  symbol: string;    // 显示符号
  name: string;      // 中文名
  decimals: number;  // 小数位数
}

/** 预设币种列表 */
export const CURRENCIES: CurrencyConfig[] = [
  { code: 'CNY', symbol: '¥',  name: '人民币',  decimals: 2 },
  { code: 'USD', symbol: '$',  name: '美元',    decimals: 2 },
  { code: 'EUR', symbol: '€',  name: '欧元',    decimals: 2 },
  { code: 'JPY', symbol: '¥',  name: '日元',    decimals: 0 },
  { code: 'GBP', symbol: '£',  name: '英镑',    decimals: 2 },
  { code: 'HKD', symbol: 'HK$', name: '港币',   decimals: 2 },
  { code: 'TWD', symbol: 'NT$', name: '新台币',  decimals: 0 },
  { code: 'KRW', symbol: '₩',  name: '韩元',    decimals: 0 },
  { code: 'SGD', symbol: 'S$', name: '新加坡元', decimals: 2 },
  { code: 'AUD', symbol: 'A$', name: '澳元',    decimals: 2 },
  { code: 'CAD', symbol: 'C$', name: '加元',    decimals: 2 },
  { code: 'CHF', symbol: 'CHF', name: '瑞士法郎', decimals: 2 },
  { code: 'MYR', symbol: 'RM', name: '马来西亚林吉特', decimals: 2 },
  { code: 'THB', symbol: '฿',  name: '泰铢',    decimals: 2 },
  { code: 'RUB', symbol: '₽',  name: '俄罗斯卢布', decimals: 2 },
];

/** 根据币种代码获取配置 */
export function getCurrencyConfig(code: string): CurrencyConfig {
  return CURRENCIES.find(c => c.code === code) || { code, symbol: code, name: code, decimals: 2 };
}

export const THEMES: Record<ThemeType, ThemeConfig> = {
  blue: {
    name: '经典蓝',
    primary: '#0ea5e9',
    primaryLight: '#38bdf8',
    primaryDark: '#0284c7',
    gradientFrom: '#38bdf8',
    gradientTo: '#0ea5e9',
    bgLight: '#f0f9ff',
  },
  green: {
    name: '清新绿',
    primary: '#22c55e',
    primaryLight: '#4ade80',
    primaryDark: '#16a34a',
    gradientFrom: '#4ade80',
    gradientTo: '#22c55e',
    bgLight: '#f0fdf4',
  },
  orange: {
    name: '活力橙',
    primary: '#f97316',
    primaryLight: '#fb923c',
    primaryDark: '#ea580c',
    gradientFrom: '#fb923c',
    gradientTo: '#f97316',
    bgLight: '#fff7ed',
  },
  dark: {
    name: '沉稳黑',
    primary: '#6366f1',
    primaryLight: '#818cf8',
    primaryDark: '#4f46e5',
    gradientFrom: '#818cf8',
    gradientTo: '#6366f1',
    bgLight: '#1e1b4b',
  },
  purple: {
    name: '优雅紫',
    primary: '#a855f7',
    primaryLight: '#c084fc',
    primaryDark: '#9333ea',
    gradientFrom: '#c084fc',
    gradientTo: '#a855f7',
    bgLight: '#faf5ff',
  },
};