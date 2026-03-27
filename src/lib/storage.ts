import type { Account, MonthlyRecord, AppState, AppSettings, RecordLog } from '@/types';

const STORAGE_KEY = 'simple-ledger-data';
const EXPANDED_GROUPS_KEY = 'simple-ledger-expanded-groups';
const RECORD_LOGS_EXPANDED_KEY = 'simple-ledger-record-logs-expanded';
const CURRENT_VERSION = '1.2';

// 默认数据
const defaultState: AppState = {
  accounts: [],
  records: [],
  logs: [],
  settings: {
    hideBalance: false,
    theme: 'blue',
  },
  version: CURRENT_VERSION,
};

// 生成唯一ID
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 获取当前日期
export function getCurrentYearMonth(): { year: number; month: number } {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  };
}

// 格式化金额
export function formatAmount(amount: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// 格式化金额（无货币符号）
export function formatAmountNoSymbol(amount: number): string {
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// 格式化月份
export function formatMonth(year: number, month: number): string {
  return `${year}年${month.toString().padStart(2, '0')}月`;
}

// 格式化日期（仅日期，用于记账记录显示）
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}年${(date.getMonth() + 1).toString().padStart(2, '0')}月${date.getDate().toString().padStart(2, '0')}日`;
}

// 格式化日期（用于记账记录列表，只显示月日）
export function formatShortDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${(date.getMonth() + 1).toString().padStart(2, '0')}月${date.getDate().toString().padStart(2, '0')}日`;
}

// 格式化日期时间
export function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

// 获取月份键
export function getMonthKey(year: number, month: number): string {
  return `${year}-${month.toString().padStart(2, '0')}`;
}

// 读取数据
export function loadData(): AppState {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      return {
        ...defaultState,
        ...parsed,
        settings: {
          ...defaultState.settings,
          ...parsed.settings,
        },
        version: CURRENT_VERSION,
      };
    }
  } catch (error) {
    console.error('Failed to load data:', error);
  }
  return { ...defaultState };
}

// 保存数据
export function saveData(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save data:', error);
  }
}

// 获取设置
export function getSettings(): AppSettings {
  const data = loadData();
  return data.settings;
}

// 更新设置
export function updateSettings(settings: Partial<AppSettings>): void {
  const data = loadData();
  data.settings = { ...data.settings, ...settings };
  saveData(data);
}

// 获取展开的账户分组状态
export function getExpandedGroups(): Record<string, boolean> {
  try {
    const data = localStorage.getItem(EXPANDED_GROUPS_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to load expanded groups:', error);
  }
  return {};
}

// 保存展开的账户分组状态
export function saveExpandedGroups(groups: Record<string, boolean>): void {
  try {
    localStorage.setItem(EXPANDED_GROUPS_KEY, JSON.stringify(groups));
  } catch (error) {
    console.error('Failed to save expanded groups:', error);
  }
}

// 获取记账记录页面的折叠状态
export function getRecordLogsExpandedGroups(
  year: number,
  month: number | undefined,
  mode: 'monthly' | 'yearly'
): string[] | null {
  try {
    const data = localStorage.getItem(RECORD_LOGS_EXPANDED_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      const key = mode === 'monthly' && month !== undefined
        ? `${mode}-${year}-${month}`
        : `${mode}-${year}`;
      return parsed[key] || null;
    }
  } catch (error) {
    console.error('Failed to load record logs expanded groups:', error);
  }
  return null;
}

// 保存记账记录页面的折叠状态
export function saveRecordLogsExpandedGroups(
  year: number,
  month: number | undefined,
  mode: 'monthly' | 'yearly',
  expandedKeys: string[]
): void {
  try {
    const data = localStorage.getItem(RECORD_LOGS_EXPANDED_KEY);
    const parsed = data ? JSON.parse(data) : {};
    const key = mode === 'monthly' && month !== undefined
      ? `${mode}-${year}-${month}`
      : `${mode}-${year}`;
    parsed[key] = expandedKeys;
    localStorage.setItem(RECORD_LOGS_EXPANDED_KEY, JSON.stringify(parsed));
  } catch (error) {
    console.error('Failed to save record logs expanded groups:', error);
  }
}

// 导出数据为JSON文件
export function exportData(): string {
  const data = loadData();
  return JSON.stringify(data, null, 2);
}

// 按时间范围导出数据
export function exportDataByRange(startYear: number, startMonth: number, endYear: number, endMonth: number): string {
  const data = loadData();
  
  // 筛选记录
  const filteredRecords = data.records.filter(r => {
    const recordKey = r.year * 100 + r.month;
    const startKey = startYear * 100 + startMonth;
    const endKey = endYear * 100 + endMonth;
    return recordKey >= startKey && recordKey <= endKey;
  });

  // 筛选日志
  const filteredLogs = data.logs.filter(l => {
    const logKey = l.year * 100 + l.month;
    const startKey = startYear * 100 + startMonth;
    const endKey = endYear * 100 + endMonth;
    return logKey >= startKey && logKey <= endKey;
  });

  return JSON.stringify({
    accounts: data.accounts,
    records: filteredRecords,
    logs: filteredLogs,
    version: CURRENT_VERSION,
  }, null, 2);
}

// 导入数据
export function importData(jsonString: string, targetYear?: number, targetMonth?: number, mergeMode: 'overwrite' | 'merge' = 'merge'): boolean {
  try {
    const data = JSON.parse(jsonString);
    if (!data.accounts || !data.records) {
      return false;
    }

    const currentData = loadData();

    // 如果没有指定目标时间，直接导入所有
    if (targetYear === undefined || targetMonth === undefined) {
      saveData({
        accounts: data.accounts,
        records: data.records,
        logs: data.logs || [],
        settings: { ...defaultState.settings, ...data.settings },
        version: CURRENT_VERSION,
      });
      return true;
    }

    // 按目标时间导入
    if (mergeMode === 'overwrite') {
      // 覆盖模式：删除目标时间的现有记录，然后导入
      currentData.records = currentData.records.filter(r => 
        !(r.year === targetYear && r.month === targetMonth)
      );
      currentData.logs = currentData.logs.filter(l => 
        !(l.year === targetYear && l.month === targetMonth)
      );
    }

    // 导入新记录（调整时间）
    const importedRecords = data.records.map((r: MonthlyRecord) => ({
      ...r,
      id: generateId(),
      year: targetYear,
      month: targetMonth,
    }));

    const importedLogs = (data.logs || []).map((l: RecordLog) => ({
      ...l,
      id: generateId(),
      year: targetYear,
      month: targetMonth,
      timestamp: Date.now(),
    }));

    currentData.records.push(...importedRecords);
    currentData.logs.push(...importedLogs);

    // 合并账户（去重）
    const existingAccountIds = new Set(currentData.accounts.map(a => a.id));
    const newAccounts = data.accounts.filter((a: Account) => !existingAccountIds.has(a.id));
    currentData.accounts.push(...newAccounts);

    saveData(currentData);
    return true;
  } catch (error) {
    console.error('Failed to import data:', error);
    return false;
  }
}

// 清空所有数据
export function clearAllData(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// 账户相关操作
export function addAccount(account: Omit<Account, 'id'>): Account {
  const data = loadData();
  const newAccount: Account = {
    ...account,
    id: generateId(),
  };
  data.accounts.push(newAccount);
  
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  // 如果新账户有余额，创建月度记录
  if (newAccount.balance !== 0) {
    data.records.push({
      id: generateId(),
      accountId: newAccount.id,
      year: currentYear,
      month: currentMonth,
      balance: newAccount.balance,
    });
  }
  
  // 添加账户创建日志（直接操作 data，避免重复 loadData）
  data.logs.push({
    id: generateId(),
    accountId: newAccount.id,
    accountName: newAccount.name,
    year: currentYear,
    month: currentMonth,
    oldBalance: 0,
    newBalance: newAccount.balance,
    timestamp: Date.now(),
    operationType: 'account_create',
  });
  
  saveData(data);
  return newAccount;
}

export function updateAccount(id: string, updates: Partial<Account>): Account | null {
  const data = loadData();
  const index = data.accounts.findIndex(a => a.id === id);
  if (index !== -1) {
    const oldAccount = { ...data.accounts[index] };
    data.accounts[index] = { ...data.accounts[index], ...updates };
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    // 如果余额发生变化，添加"余额修改"日志，并同步更新月度记录
    if (updates.balance !== undefined && updates.balance !== oldAccount.balance) {
      // 同步更新当前月的月度记录（让首页能立即显示最新余额）
      const existingRecord = data.records.find(
        r => r.accountId === id && r.year === currentYear && r.month === currentMonth
      );
      if (existingRecord) {
        existingRecord.balance = updates.balance;
      } else {
        data.records.push({
          id: generateId(),
          accountId: id,
          year: currentYear,
          month: currentMonth,
          balance: updates.balance,
        });
      }
      
      // 添加记账日志（直接操作 data，避免重复 loadData）
      data.logs.push({
        id: generateId(),
        accountId: id,
        accountName: data.accounts[index].name,
        year: currentYear,
        month: currentMonth,
        oldBalance: oldAccount.balance,
        newBalance: updates.balance,
        timestamp: Date.now(),
        operationType: 'balance_change',
      });
    }
    
    // 如果账户信息（名称、备注等）发生变化，添加"账户编辑"日志
    const infoChanged = updates.name !== undefined && updates.name !== oldAccount.name ||
                        updates.note !== undefined && updates.note !== oldAccount.note ||
                        updates.type !== undefined && updates.type !== oldAccount.type ||
                        updates.icon !== undefined && updates.icon !== oldAccount.icon;
    
    if (infoChanged) {
      data.logs.push({
        id: generateId(),
        accountId: id,
        accountName: data.accounts[index].name,
        year: currentYear,
        month: currentMonth,
        oldBalance: oldAccount.balance,
        newBalance: data.accounts[index].balance,
        timestamp: Date.now(),
        operationType: 'account_edit',
      });
    }
    
    saveData(data);
    return data.accounts[index];
  }
  return null;
}

export function deleteAccount(id: string): boolean {
  const data = loadData();
  const index = data.accounts.findIndex(a => a.id === id);
  if (index !== -1) {
    data.accounts.splice(index, 1);
    data.records = data.records.filter(r => r.accountId !== id);
    data.logs = data.logs.filter(l => l.accountId !== id);
    saveData(data);
    return true;
  }
  return false;
}

export function getAccountById(id: string): Account | undefined {
  const data = loadData();
  return data.accounts.find(a => a.id === id);
}

export function getAllAccounts(): Account[] {
  const data = loadData();
  return data.accounts;
}

// 月度记录相关操作
export function setMonthlyRecord(accountId: string, year: number, month: number, balance: number): MonthlyRecord {
  const data = loadData();
  const account = data.accounts.find(a => a.id === accountId);
  
  const existingRecord = data.records.find(
    r => r.accountId === accountId && r.year === year && r.month === month
  );
  const oldBalance = existingRecord ? existingRecord.balance : (account?.balance || 0);
  
  // 只有余额发生变化时才记录日志（直接操作 data，避免重复 load/save）
  if (oldBalance !== balance && account) {
    data.logs.push({
      id: generateId(),
      accountId,
      accountName: account.name,
      year,
      month,
      oldBalance,
      newBalance: balance,
      timestamp: Date.now(),
      operationType: 'balance_change',
    });
  }
  
  if (existingRecord) {
    existingRecord.balance = balance;
    saveData(data);
    return existingRecord;
  } else {
    const newRecord: MonthlyRecord = {
      id: generateId(),
      accountId,
      year,
      month,
      balance,
    };
    data.records.push(newRecord);
    saveData(data);
    return newRecord;
  }
}

export function getMonthlyRecord(accountId: string, year: number, month: number): MonthlyRecord | undefined {
  const data = loadData();
  return data.records.find(
    r => r.accountId === accountId && r.year === year && r.month === month
  );
}

export function getMonthlyRecordsByMonth(year: number, month: number): MonthlyRecord[] {
  const data = loadData();
  return data.records.filter(r => r.year === year && r.month === month);
}

export function getMonthlyRecordsByAccount(accountId: string): MonthlyRecord[] {
  const data = loadData();
  return data.records.filter(r => r.accountId === accountId);
}

export function deleteMonthlyRecord(recordId: string): boolean {
  const data = loadData();
  const index = data.records.findIndex(r => r.id === recordId);
  if (index !== -1) {
    data.records.splice(index, 1);
    saveData(data);
    return true;
  }
  return false;
}

// 记账日志相关操作
export function addRecordLog(log: Omit<RecordLog, 'id'>): RecordLog {
  const data = loadData();
  const newLog: RecordLog = {
    ...log,
    id: generateId(),
  };
  data.logs.push(newLog);
  saveData(data);
  return newLog;
}

export function getRecordLogs(year: number, month?: number): RecordLog[] {
  const data = loadData();
  return data.logs
    .filter(l => {
      if (month !== undefined) {
        return l.year === year && l.month === month;
      }
      return l.year === year;
    })
    .sort((a, b) => b.timestamp - a.timestamp);
}

export function getRecordLogsByAccount(accountId: string): RecordLog[] {
  const data = loadData();
  return data.logs
    .filter(l => l.accountId === accountId)
    .sort((a, b) => b.timestamp - a.timestamp);
}

export function deleteRecordLog(logId: string): boolean {
  const data = loadData();
  const index = data.logs.findIndex(l => l.id === logId);
  if (index !== -1) {
    data.logs.splice(index, 1);
    saveData(data);
    return true;
  }
  return false;
}

// 获取所有有记录的年月
export function getAllRecordedMonths(): { year: number; month: number }[] {
  const data = loadData();
  const monthSet = new Set<string>();
  
  data.records.forEach(r => {
    monthSet.add(`${r.year}-${r.month.toString().padStart(2, '0')}`);
  });
  
  return Array.from(monthSet).map(key => {
    const [year, month] = key.split('-').map(Number);
    return { year, month };
  }).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });
}

// 计算指定月份的净资产（总资产 - 负资产）
export function calculateMonthNetWorth(year: number, month: number): number {
  const data = loadData();
  const records = data.records.filter(r => r.year === year && r.month === month);
  
  let totalAssets = 0;
  let totalLiabilities = 0;
  
  for (const record of records) {
    const account = data.accounts.find(a => a.id === record.accountId);
    if (!account) continue;
    
    if (account.type === 'credit' || account.type === 'debt') {
      // 信用卡和债务算作负债
      totalLiabilities += Math.abs(record.balance);
    } else {
      // 其他算作资产
      totalAssets += record.balance;
    }
  }
  
  return totalAssets - totalLiabilities;
}

// 计算指定月份的总资产
export function calculateMonthTotalAssets(year: number, month: number): number {
  const data = loadData();
  const records = data.records.filter(r => r.year === year && r.month === month);
  
  let totalAssets = 0;
  
  for (const record of records) {
    const account = data.accounts.find(a => a.id === record.accountId);
    if (!account) continue;
    
    if (account.type !== 'credit' && account.type !== 'debt') {
      totalAssets += record.balance;
    }
  }
  
  return totalAssets;
}

// 计算指定月份的总负债
export function calculateMonthTotalLiabilities(year: number, month: number): number {
  const data = loadData();
  const records = data.records.filter(r => r.year === year && r.month === month);
  
  let totalLiabilities = 0;
  
  for (const record of records) {
    const account = data.accounts.find(a => a.id === record.accountId);
    if (!account) continue;
    
    if (account.type === 'credit' || account.type === 'debt') {
      totalLiabilities += Math.abs(record.balance);
    }
  }
  
  return totalLiabilities;
}

// ==================== Excel 批量导入功能 ====================

// Excel 数据行格式
export interface ExcelImportRow {
  month: string;      // YYYY-MM 格式
  accountName: string; // 目标账户名称
  balance: number;    // 当月存款余额
}

// 解析 Excel CSV 内容
export function parseExcelCSV(content: string): ExcelImportRow[] {
  const lines = content.trim().split('\n');
  const result: ExcelImportRow[] = [];

  // 跳过标题行，从第2行开始
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // 支持逗号或制表符分隔
    const parts = line.includes('\t') ? line.split('\t') : line.split(',');
    if (parts.length < 3) continue;

    const month = parts[0].trim().replace(/"/g, '');
    const accountName = parts[1].trim().replace(/"/g, '');
    const balanceStr = parts[2].trim().replace(/"/g, '').replace(/¥/g, '').replace(/,/g, '');
    const balance = parseFloat(balanceStr);

    // 验证格式
    if (!month.match(/^\d{4}-\d{2}$/) || isNaN(balance)) continue;

    result.push({ month, accountName, balance });
  }

  return result;
}

// 批量导入月度数据（Excel 模式）
// 规则：指定账户设为 Excel 中的余额，其余所有账户余额设为 0
export function batchImportFromExcel(rows: ExcelImportRow[], mergeMode: 'overwrite' | 'merge' = 'merge'): { success: boolean; message: string; importedCount: number } {
  if (rows.length === 0) {
    return { success: false, message: 'Excel 数据为空', importedCount: 0 };
  }

  try {
    const data = loadData();
    let importedCount = 0;
    const errors: string[] = [];

    for (const row of rows) {
      // 解析月份
      const [yearStr, monthStr] = row.month.split('-');
      const year = parseInt(yearStr);
      const month = parseInt(monthStr);

      // 查找目标账户
      const targetAccount = data.accounts.find(a => a.name === row.accountName);
      if (!targetAccount) {
        errors.push(`未找到账户「${row.accountName}」`);
        continue;
      }

      if (mergeMode === 'overwrite') {
        // 覆盖模式：删除该月所有现有记录
        data.records = data.records.filter(r => !(r.year === year && r.month === month));
      }

      // 为所有账户设置余额
      for (const account of data.accounts) {
        const isTargetAccount = account.id === targetAccount.id;
        const balance = isTargetAccount ? row.balance : 0;

        // 查找是否已有该账户该月的记录
        const existingRecord = data.records.find(
          r => r.accountId === account.id && r.year === year && r.month === month
        );

        if (existingRecord) {
          existingRecord.balance = balance;
        } else {
          data.records.push({
            id: generateId(),
            accountId: account.id,
            year,
            month,
            balance,
          });
        }
      }

      importedCount++;
    }

    saveData(data);

    if (errors.length > 0) {
      return { success: true, message: `导入完成，但有 ${errors.length} 个错误：\n${errors.slice(0, 3).join('\n')}${errors.length > 3 ? '\n...' : ''}`, importedCount };
    }

    return { success: true, message: `成功导入 ${importedCount} 个月的数据`, importedCount };
  } catch (error) {
    console.error('Excel 导入失败:', error);
    return { success: false, message: 'Excel 导入失败，请检查文件格式', importedCount: 0 };
  }
}

// 导出数据为 Excel CSV 模板
export function exportExcelTemplate(): string {
  const accounts = getAllAccounts();
  const header = '月份(YYYY-MM),目标存款账户名称,当月存款余额';

  // 生成示例数据（最近6个月）
  const now = new Date();
  const examples: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const monthStr = `${year}-${month.toString().padStart(2, '0')}`;
    const defaultAccount = accounts.length > 0 ? accounts[0].name : '账户名称';
    examples.push(`${monthStr},${defaultAccount},0.00`);
  }

  return [header, ...examples].join('\n');
}

// 批量导入指定时间范围的数据
export function batchImportByRange(
  rows: ExcelImportRow[],
  startYear: number,
  startMonth: number,
  endYear: number,
  endMonth: number,
  mergeMode: 'overwrite' | 'merge' = 'merge'
): { success: boolean; message: string; importedCount: number } {
  // 过滤出在指定范围内的数据
  const filteredRows = rows.filter(row => {
    const [yearStr, monthStr] = row.month.split('-');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);

    const rowKey = year * 100 + month;
    const startKey = startYear * 100 + startMonth;
    const endKey = endYear * 100 + endMonth;

    return rowKey >= startKey && rowKey <= endKey;
  });

  return batchImportFromExcel(filteredRows, mergeMode);
}