import type { Account, MonthlyRecord, AccountType, MonthlyNetWorth, AccountGroup, YearlyNetWorth } from '@/types';
import { getAllAccounts, getMonthlyRecordsByMonth, loadData } from './storage';

// 账户类型配置
export const ACCOUNT_TYPES: { type: AccountType; label: string; icon: string }[] = [
  { type: 'cash', label: '现金', icon: 'banknote' },
  { type: 'debit', label: '储蓄卡', icon: 'credit-card' },
  { type: 'credit', label: '信用卡', icon: 'credit-card' },
  { type: 'digital', label: '网络支付', icon: 'wallet' },
  { type: 'investment', label: '投资账户', icon: 'trending-up' },
  { type: 'loan', label: '借出', icon: 'handshake' },
  { type: 'debt', label: '借入', icon: 'clipboard' },
];

// 获取账户类型标签
export function getAccountTypeLabel(type: AccountType): string {
  const config = ACCOUNT_TYPES.find(t => t.type === type);
  return config?.label || '其他';
}

// 获取账户类型图标
export function getAccountTypeIcon(type: AccountType): string {
  const config = ACCOUNT_TYPES.find(t => t.type === type);
  return config?.icon || 'circle';
}

// ========== 核心指标计算 ==========

// 计算某月总资产（不含信用卡欠款）
// 总资产 = 所有账户余额之和，不包含信用卡欠款（信用卡余额为正时不计入，为负时计入其绝对值）
export function calculateTotalAssets(year: number, month: number): number {
  const accounts = getAllAccounts();
  const records = getMonthlyRecordsByMonth(year, month);
  
  let total = 0;

  for (const account of accounts) {
    if (account.isHidden) continue;

    const record = records.find(r => r.accountId === account.id);
    const balance = record ? record.balance : account.balance;

    // 信用卡特殊处理
    if (account.type === 'credit') {
      // 信用卡余额为正 = 欠款（不计入总资产）
      // 信用卡余额为负 = 溢缴款（计入总资产，取绝对值）
      if (balance < 0) {
        total += Math.abs(balance);
      }
    } else if (account.type === 'debt') {
      // 借入不计入总资产
      continue;
    } else {
      // 其他账户直接计入
      total += balance;
    }
  }

  return total;
}

// 计算某月负资产
// 负资产 = 信用卡欠款（所有信用卡账户余额为正的部分）+ 借入的钱
export function calculateTotalLiabilities(year: number, month: number): number {
  const accounts = getAllAccounts();
  const records = getMonthlyRecordsByMonth(year, month);
  
  let total = 0;

  for (const account of accounts) {
    if (account.isHidden) continue;

    const record = records.find(r => r.accountId === account.id);
    const balance = record ? record.balance : account.balance;

    // 信用卡欠款（正数部分）
    if (account.type === 'credit' && balance > 0) {
      total += balance;
    }
    // 借入
    if (account.type === 'debt') {
      total += Math.abs(balance);
    }
  }

  return total;
}

// 计算某月净资产
// 净资产 = 总资产 - 负资产
export function calculateNetWorth(year: number, month: number): number {
  const totalAssets = calculateTotalAssets(year, month);
  const totalLiabilities = calculateTotalLiabilities(year, month);
  return totalAssets - totalLiabilities;
}

// 获取月度完整数据（包含总资产、负资产、净资产）
export function getMonthlyNetWorth(year: number, month: number): MonthlyNetWorth {
  const totalAssets = calculateTotalAssets(year, month);
  const totalLiabilities = calculateTotalLiabilities(year, month);
  const netWorth = totalAssets - totalLiabilities;
  
  // 计算上月数据用于对比
  let lastYear = year;
  let lastMonth = month - 1;
  if (lastMonth === 0) {
    lastYear--;
    lastMonth = 12;
  }
  const lastNetWorth = calculateNetWorth(lastYear, lastMonth);
  const change = netWorth - lastNetWorth;
  const changePercent = lastNetWorth !== 0 ? (change / Math.abs(lastNetWorth)) * 100 : 0;

  return {
    year,
    month,
    netWorth,
    totalAssets,
    totalLiabilities,
    change,
    changePercent,
  };
}

// ========== 年度记账相关 ==========

// 获取年度最后一个有记录的月份
export function getLastRecordedMonth(year: number): number {
  const data = loadData();
  const yearRecords = data.records.filter(r => r.year === year);
  
  if (yearRecords.length === 0) {
    return 0;
  }
  
  const months = yearRecords.map(r => r.month);
  return Math.max(...months);
}

// 获取年度净资产数据
export function getYearlyNetWorth(year: number): YearlyNetWorth {
  // 获取该年度最后一个有记录的月份，如果没有则默认12月
  const lastMonth = getLastRecordedMonth(year) || 12;
  
  const totalAssets = calculateTotalAssets(year, lastMonth);
  const totalLiabilities = calculateTotalLiabilities(year, lastMonth);
  const netWorth = totalAssets - totalLiabilities;
  
  // 计算上一年度数据用于对比
  const lastYearNetWorth = calculateNetWorth(year - 1, 12);
  const change = netWorth - lastYearNetWorth;
  const changePercent = lastYearNetWorth !== 0 ? (change / Math.abs(lastYearNetWorth)) * 100 : 0;

  return {
    year,
    netWorth,
    totalAssets,
    totalLiabilities,
    lastRecordedMonth: lastMonth,
    change,
    changePercent,
  };
}

// 获取年度所有月份的净资产数据
export function getYearlyMonthlyData(year: number): MonthlyNetWorth[] {
  const data: MonthlyNetWorth[] = [];
  
  for (let month = 1; month <= 12; month++) {
    const monthlyData = getMonthlyNetWorth(year, month);
    data.push(monthlyData);
  }
  
  return data;
}

// ========== 借出借入计算 ==========

// 计算借出总额
export function calculateLoanOut(year: number, month: number): number {
  const accounts = getAllAccounts();
  const records = getMonthlyRecordsByMonth(year, month);
  
  let total = 0;

  for (const account of accounts) {
    if (account.type === 'loan') {
      const record = records.find(r => r.accountId === account.id);
      const balance = record ? record.balance : account.balance;
      total += balance;
    }
  }

  return total;
}

// 计算借入总额
export function calculateDebtIn(year: number, month: number): number {
  const accounts = getAllAccounts();
  const records = getMonthlyRecordsByMonth(year, month);
  
  let total = 0;

  for (const account of accounts) {
    if (account.type === 'debt') {
      const record = records.find(r => r.accountId === account.id);
      const balance = record ? record.balance : account.balance;
      total += Math.abs(balance);
    }
  }

  return total;
}

// ========== 账户分组 ==========

// 获取账户分组
export function getAccountGroups(): AccountGroup[] {
  const accounts = getAllAccounts().filter(a => !a.isHidden);
  const { year, month } = { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
  const records = getMonthlyRecordsByMonth(year, month);

  const groups: AccountGroup[] = [];

  for (const typeConfig of ACCOUNT_TYPES) {
    const typeAccounts = accounts.filter(a => a.type === typeConfig.type);
    if (typeAccounts.length === 0) continue;

    // 信用卡分类下的总余额 = 所有子账户余额之和（欠款为正，溢缴款为负，直接代数相加）
    let totalBalance = 0;
    for (const account of typeAccounts) {
      const record = records.find(r => r.accountId === account.id);
      const balance = record ? record.balance : account.balance;
      totalBalance += balance;
    }

    groups.push({
      type: typeConfig.type,
      label: typeConfig.label,
      accounts: typeAccounts,
      totalBalance,
    });
  }

  return groups;
}

// ========== 趋势图表数据 ==========

// 获取月度净资产历史
export function getNetWorthHistory(months: number = 12): MonthlyNetWorth[] {
  const data = loadData();
  const records = data.records;

  // 获取所有有记录的月份
  const monthSet = new Set<string>();
  records.forEach(r => {
    monthSet.add(`${r.year}-${r.month.toString().padStart(2, '0')}`);
  });

  // 添加当前月份
  const now = new Date();
  monthSet.add(`${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`);

  // 排序并取最近N个月
  const sortedMonths = Array.from(monthSet).sort().slice(-months);

  const history: MonthlyNetWorth[] = [];

  for (const monthKey of sortedMonths) {
    const [year, month] = monthKey.split('-').map(Number);
    const monthlyData = getMonthlyNetWorth(year, month);
    history.push(monthlyData);
  }

  return history;
}

// 获取某账户的月度历史
export function getAccountHistory(accountId: string, months: number = 12): MonthlyRecord[] {
  const data = loadData();
  const records = data.records
    .filter(r => r.accountId === accountId)
    .sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    })
    .slice(-months);

  return records;
}

// 获取年度净资产历史（用于年度趋势图表）
export function getYearlyNetWorthHistory(): { year: number; netWorth: number; totalAssets: number; totalLiabilities: number; change: number; changePercent: number }[] {
  const data = loadData();
  const records = data.records;

  // 获取所有有记录的年份
  const yearSet = new Set<number>();
  records.forEach(r => {
    yearSet.add(r.year);
  });
  
  // 添加当前年份
  const now = new Date();
  yearSet.add(now.getFullYear());

  // 排序
  const sortedYears = Array.from(yearSet).sort();

  const history: { year: number; netWorth: number; totalAssets: number; totalLiabilities: number; change: number; changePercent: number }[] = [];

  for (let i = 0; i < sortedYears.length; i++) {
    const year = sortedYears[i];
    const yearlyData = getYearlyNetWorth(year);
    
    history.push({
      year: yearlyData.year,
      netWorth: yearlyData.netWorth,
      totalAssets: yearlyData.totalAssets,
      totalLiabilities: yearlyData.totalLiabilities,
      change: yearlyData.change,
      changePercent: yearlyData.changePercent,
    });
  }

  return history;
}

// 复制上月余额
export function copyLastMonthBalances(year: number, month: number): void {
  const data = loadData();
  
  // 计算上月
  let lastYear = year;
  let lastMonth = month - 1;
  if (lastMonth === 0) {
    lastYear--;
    lastMonth = 12;
  }

  const lastMonthRecords = data.records.filter(
    r => r.year === lastYear && r.month === lastMonth
  );

  for (const record of lastMonthRecords) {
    const existingIndex = data.records.findIndex(
      r => r.accountId === record.accountId && r.year === year && r.month === month
    );

    if (existingIndex !== -1) {
      data.records[existingIndex].balance = record.balance;
    } else {
      data.records.push({
        id: generateId(),
        accountId: record.accountId,
        year,
        month,
        balance: record.balance,
      });
    }
  }

  saveData(data);
}

// 生成ID（重复定义以避免循环依赖）
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 保存数据（重复定义以避免循环依赖）
function saveData(data: { accounts: Account[]; records: MonthlyRecord[]; logs?: any[]; settings?: any; version?: string }): void {
  localStorage.setItem('simple-ledger-data', JSON.stringify({
    ...data,
    version: '1.1',
  }));
}
