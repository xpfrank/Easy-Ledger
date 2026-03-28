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
  id: string;           // 唯一标识
  name: string;         // 账户名称
  type: AccountType;    // 账户类型
  icon: string;         // 图标名称
  balance: number;      // 当前余额
  includeInTotal: boolean;  // 计入总资产
  isHidden: boolean;    // 是否隐藏
  note?: string;        // 备注
  // 信用卡专属
  billDay?: number;     // 账单日
  repaymentDay?: number; // 还款日
  graceDays?: number;   // 顺延天数
}

// 月度记录
export interface MonthlyRecord {
  id: string;
  accountId: string;    // 关联账户
  year: number;         // 年份
  month: number;        // 月份 (1-12)
  balance: number;      // 该月余额
}

// 记账日志（余额变化记录）
export interface RecordLog {
  id: string;
  accountId: string;    // 账户ID
  accountName: string;  // 账户名称
  year: number;         // 年份
  month: number;        // 月份
  oldBalance: number;   // 修改前余额
  newBalance: number;   // 修改后余额
  timestamp: number;    // 操作时间戳
  operationType?: 'balance_change' | 'account_create' | 'account_edit'; // 操作类型
}

// 应用状态
export interface AppState {
  accounts: Account[];
  records: MonthlyRecord[];
  logs: RecordLog[];    // 记账日志
  attributions: MonthlyAttribution[]; // 归因记录
  settings: AppSettings;
  version: string;
}

// 主题类型
export type ThemeType = 'blue' | 'green' | 'orange' | 'dark' | 'purple';

// 应用设置
export interface AppSettings {
  hideBalance: boolean; // 是否隐藏余额显示
  theme: ThemeType;     // 当前主题
}

// 月度净资产汇总
export interface MonthlyNetWorth {
  year: number;
  month: number;
  netWorth: number;
  totalAssets: number;    // 总资产
  totalLiabilities: number; // 负资产
  change: number;
  changePercent: number;
}

// 年度净资产汇总
export interface YearlyNetWorth {
  year: number;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  lastRecordedMonth: number; // 最后一个有记录的月份
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
  | 'salary'           // 工资积累
  | 'investment'       // 投资收益
  | 'daily'            // 日常波动
  | 'other'            // 其他
  | 'salary_income'    // 工资收入
  | 'bonus'            // 奖金
  | 'year_end_bonus'   // 年终奖
  | 'loan_repayment'   // 借款归还
  | 'large_expense'    // 大额支出
  | 'transfer'         // 转账调整
  | 'abnormal_other';  // 异常其他

// 标签配置
export interface TagConfig {
  value: AttributionTag;
  label: string;
  emoji: string;
  isRequired: boolean; // 异常波动时是否必选
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
  { value: 'abnormal_other', label: '其他', emoji: '📝', isRequired: true },
];

// 月度归因记录
export interface MonthlyAttribution {
  id: string;
  year: number;
  month: number;
  change: number;           // 变化金额
  changePercent: number;    // 变化百分比
  fluctuationLevel: FluctuationLevel;
  tags: AttributionTag[];    // 选择的标签
  note?: string;            // 备注
  timestamp: number;         // 记录时间
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
