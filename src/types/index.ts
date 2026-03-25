// 账户类型
export type AccountType = 'cash' | 'debit' | 'credit' | 'digital' | 'investment' | 'loan' | 'debt';

// 账户接口
export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  icon?: string;
  note?: string;
  includeInTotal: boolean; // 是否计入总资产
  isHidden: boolean; // 是否隐藏
  createdAt: number;
}

// 月度记录接口
export interface MonthlyRecord {
  id: string;
  accountId: string;
  year: number;
  month: number;
  balance: number;
}

// 月度净资产数据
export interface MonthlyNetWorth {
  year: number;
  month: number;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  change: number;
  changePercent: number;
}

// 年度净资产数据
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
  operationType: 'balance_change' | 'account_create' | 'account_edit' | 'account_delete';
}

// 应用设置
export interface AppSettings {
  hideBalance: boolean;
  theme: ThemeType;
}

// 主题类型
export type ThemeType = 'blue' | 'green' | 'purple' | 'orange' | 'pink';

// 主题配置
export interface ThemeConfig {
  name: string;
  primaryColor: string;
  gradientFrom: string;
  gradientTo: string;
}

// 主题配置映射
export const THEMES: Record<ThemeType, ThemeConfig> = {
  blue: {
    name: '蓝色',
    primaryColor: '#3b82f6',
    gradientFrom: 'from-blue-500',
    gradientTo: 'to-blue-600',
  },
  green: {
    name: '绿色',
    primaryColor: '#10b981',
    gradientFrom: 'from-emerald-500',
    gradientTo: 'to-emerald-600',
  },
  purple: {
    name: '紫色',
    primaryColor: '#8b5cf6',
    gradientFrom: 'from-violet-500',
    gradientTo: 'to-violet-600',
  },
  orange: {
    name: '橙色',
    primaryColor: '#f97316',
    gradientFrom: 'from-orange-500',
    gradientTo: 'to-orange-600',
  },
  pink: {
    name: '粉色',
    primaryColor: '#ec4899',
    gradientFrom: 'from-pink-500',
    gradientTo: 'to-pink-600',
  },
};

// 页面路由
export type PageRoute = 'home' | 'accounts' | 'account-edit' | 'record' | 'record-logs' | 'trend' | 'settings';

// 记录模式
export type RecordMode = 'monthly' | 'yearly';
