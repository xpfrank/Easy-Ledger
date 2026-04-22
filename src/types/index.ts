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
export interface AppState {
  accounts: Account[];
  records: MonthlyRecord[];
  logs: RecordLog[];
  attributions: MonthlyAttribution[];
  yearlyAttributions: YearlyAttribution[];
  monthlyAccountConfigs: MonthlyAccountConfig[];
  settings: AppSettings;
  version: string;
}

// 主题类型
export type ThemeType = 'blue' | 'green' | 'orange' | 'dark' | 'purple';

// 应用设置
export interface AppSettings {
  hideBalance: boolean;
  theme: ThemeType;
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
  type: AccountType;
  label: string;
  accounts: Account[];
  totalBalance: number;
}

// 图标配置
export interface IconConfig {
  name: string;
  label: string;
  icon: string;
}

// 页面路由
export type PageRoute = 'home' | 'accounts' | 'record' | 'trend' | 'settings' | 'account-edit' | 'record-logs' | 'account-detail' | 'account-flow';

// 记账模式
export type RecordMode = 'monthly' | 'yearly';

// 波动评级
export type FluctuationLevel = 'normal' | 'warning' | 'abnormal';

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
export interface TagOption extends PresetTagConfig {
  editable: boolean;
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
  // 自定义标签：只有 custom_ 前缀的才需要查 localStorage
  if (tag.startsWith('custom_')) {
    try {
      const { getCustomAttributionTags } = require('@/lib/storage');
      const customTags = getCustomAttributionTags();
      const customTag = customTags.find((t: { id: string; label: string }) => t.id === tag);
      return customTag ? customTag.label : tag;
    } catch {
      return tag;
    }
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
  if (tagEmojis[tag]) return tagEmojis[tag];
  // 自定义标签：只有 custom_ 前缀的才需要查 localStorage
  if (tag.startsWith('custom_')) {
    try {
      const { getCustomAttributionTags } = require('@/lib/storage');
      const customTags = getCustomAttributionTags();
      const customTag = customTags.find((t: { id: string; emoji: string }) => t.id === tag);
      return customTag ? customTag.emoji : '📝';
    } catch {
      return '📝';
    }
  }
  return '📝';
}

// 预设图标配置
export const PRESET_ICONS: IconConfig[] = [
  { name: 'banknote', label: '现金', icon: 'banknote' },
  { name: 'credit-card', label: '银行卡', icon: 'credit-card' },
  { name: 'wallet', label: '钱包', icon: 'wallet' },
  { name: 'trending-up', label: '投资', icon: 'trending-up' },
  { name: 'bar-chart', label: '基金', icon: 'bar-chart' },
  { name: 'building', label: '机构', icon: 'building' },
  { name: 'handshake', label: '借出', icon: 'handshake' },
  { name: 'clipboard', label: '借入', icon: 'clipboard' },
  { name: 'smartphone', label: '手机', icon: 'smartphone' },
  { name: 'shopping-bag', label: '购物', icon: 'shopping-bag' },
  { name: 'car', label: '汽车', icon: 'car' },
  { name: 'home', label: '房产', icon: 'home' },
  { name: 'piggy-bank', label: '储蓄', icon: 'piggy-bank' },
  { name: 'coins', label: '硬币', icon: 'coins' },
  { name: 'bank', label: '银行', icon: 'bank' },
  { name: 'shield', label: '保险', icon: 'shield' },
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