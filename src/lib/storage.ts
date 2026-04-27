import type { Account, MonthlyRecord, AppState, AppSettings, RecordLog, MonthlyAttribution, AttributionTag, FluctuationLevel, YearlyAttribution, YearlyAttributionTag, AccountSnapshot, MonthlyAccountConfig, AccountType, CustomAttributionTag, TagOption, YearlyGoal } from '@/types';

const STORAGE_KEY = 'simple-ledger-data';
const EXPANDED_GROUPS_KEY = 'simple-ledger-expanded-groups';
const RECORD_LOGS_EXPANDED_KEY = 'simple-ledger-record-logs-expanded';
const CUSTOM_TAGS_KEY = 'custom_attribution_tags';
const CURRENT_VERSION = '1.4';

const defaultState: AppState = {
  accounts: [],
  records: [],
  logs: [],
  attributions: [],
  yearlyAttributions: [],
  monthlyAccountConfigs: [],
  settings: {
    hideBalance: false,
    theme: 'blue',
  },
  version: CURRENT_VERSION,
};

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function getCurrentYearMonth(): { year: number; month: number } {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  };
}

export function formatAmount(amount: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatAmountNoSymbol(amount: number): string {
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatMonth(year: number, month: number): string {
  return `${year}年${month.toString().padStart(2, '0')}月`;
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}年${(date.getMonth() + 1).toString().padStart(2, '0')}月${date.getDate().toString().padStart(2, '0')}日`;
}

export function formatShortDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${(date.getMonth() + 1).toString().padStart(2, '0')}月${date.getDate().toString().padStart(2, '0')}日`;
}

export function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

export function getMonthKey(year: number, month: number): string {
  return `${year}-${month.toString().padStart(2, '0')}`;
}

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
        attributions: parsed.attributions || [],
        yearlyAttributions: parsed.yearlyAttributions || [],
        monthlyAccountConfigs: parsed.monthlyAccountConfigs || [],
        version: CURRENT_VERSION,
      };
    }
  } catch (error) {
    console.error('Failed to load data:', error);
  }
  return { ...defaultState };
}

export function saveData(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save data:', error);
  }
}

export function getSettings(): AppSettings {
  const data = loadData();
  return data.settings;
}

export function updateSettings(settings: Partial<AppSettings>): void {
  const data = loadData();
  data.settings = { ...data.settings, ...settings };
  saveData(data);
}

export function getYearlyGoal(): YearlyGoal | undefined {
  const data = loadData();
  return data.settings.yearlyGoal;
}

export function saveYearlyGoal(goal: YearlyGoal): void {
  const data = loadData();
  data.settings.yearlyGoal = goal;
  saveData(data);
}

export function clearYearlyGoal(): void {
  const data = loadData();
  delete data.settings.yearlyGoal;
  saveData(data);
}

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

export function saveExpandedGroups(groups: Record<string, boolean>): void {
  try {
    localStorage.setItem(EXPANDED_GROUPS_KEY, JSON.stringify(groups));
  } catch (error) {
    console.error('Failed to save expanded groups:', error);
  }
}

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

export function exportData(): string {
  const data = loadData();
  return JSON.stringify(data, null, 2);
}

export function exportDataByRange(startYear: number, startMonth: number, endYear: number, endMonth: number): string {
  const data = loadData();
  
  const filteredRecords = data.records.filter(r => {
    const recordKey = r.year * 100 + r.month;
    const startKey = startYear * 100 + startMonth;
    const endKey = endYear * 100 + endMonth;
    return recordKey >= startKey && recordKey <= endKey;
  });

  const filteredLogs = data.logs.filter(l => {
    const logKey = l.year * 100 + l.month;
    const startKey = startYear * 100 + startMonth;
    const endKey = endYear * 100 + endMonth;
    return logKey >= startKey && logKey <= endKey;
  });

  const filteredAttributions = data.attributions.filter(a => {
    const attrKey = a.year * 100 + a.month;
    const startKey = startYear * 100 + startMonth;
    const endKey = endYear * 100 + endMonth;
    return attrKey >= startKey && attrKey <= endKey;
  });

  const filteredYearlyAttributions = data.yearlyAttributions.filter(a => {
    return a.year >= startYear && a.year <= endYear;
  });

  const filteredMonthlyConfigs = (data.monthlyAccountConfigs || []).filter(c => {
    const key = c.year * 100 + c.month;
    const startKey = startYear * 100 + startMonth;
    const endKey = endYear * 100 + endMonth;
    return key >= startKey && key <= endKey;
  });

  return JSON.stringify({
    accounts: data.accounts,
    records: filteredRecords,
    logs: filteredLogs,
    monthlyAttributions: filteredAttributions,
    yearlyAttributions: filteredYearlyAttributions,
    monthlyAccountConfigs: filteredMonthlyConfigs,
    version: CURRENT_VERSION,
  }, null, 2);
}

export function importData(jsonString: string, targetYear?: number, targetMonth?: number, mergeMode: 'overwrite' | 'merge' = 'merge'): boolean {
  try {
    const data = JSON.parse(jsonString);
    if (!data.accounts || !data.records) {
      return false;
    }

    const currentData = loadData();

    if (targetYear === undefined || targetMonth === undefined) {
      const recordMap = new Map<string, MonthlyRecord>();
      const buildKey = (r: MonthlyRecord) => `${r.accountId}-${r.year}-${r.month}`;
      
      currentData.records.forEach((r: MonthlyRecord) => recordMap.set(buildKey(r), r));
      data.records.forEach((r: MonthlyRecord) => recordMap.set(buildKey(r), r));

      const accountMap = new Map<string, Account>();
      currentData.accounts.forEach(a => accountMap.set(a.id, a));
      data.accounts.forEach((importedAccount: Account) => {
        const existing = accountMap.get(importedAccount.id);
        if (existing) {
          accountMap.set(importedAccount.id, {
            ...existing,
            ...importedAccount,
            isHidden: existing.isHidden,
            includeInTotal: existing.includeInTotal,
          });
        } else {
          accountMap.set(importedAccount.id, importedAccount);
        }
      });
      
      saveData({
        accounts: Array.from(accountMap.values()),
        records: Array.from(recordMap.values()),
        logs: data.logs || [],
        attributions: data.monthlyAttributions || [],
        yearlyAttributions: data.yearlyAttributions || [],
        settings: { ...defaultState.settings, ...data.settings },
        monthlyAccountConfigs: data.monthlyAccountConfigs || [],
        version: CURRENT_VERSION,
      } as AppState);
      return true;
    }

    if (mergeMode === 'overwrite') {
      currentData.records = currentData.records.filter(r => 
        !(r.year === targetYear && r.month === targetMonth)
      );
      currentData.logs = currentData.logs.filter(l => 
        !(l.year === targetYear && l.month === targetMonth)
      );
      currentData.attributions = currentData.attributions.filter(a => 
        !(a.year === targetYear && a.month === targetMonth)
      );
      currentData.monthlyAccountConfigs = currentData.monthlyAccountConfigs.filter(c => 
        !(c.year === targetYear && c.month === targetMonth)
      );
    }

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

    const importedAttributions = (data.monthlyAttributions || []).map((a: MonthlyAttribution) => ({
      ...a,
      id: generateId(),
      year: targetYear,
      month: targetMonth,
      timestamp: Date.now(),
    }));

    const importedConfigs = (data.monthlyAccountConfigs || []).map((c: MonthlyAccountConfig) => ({
      ...c,
      id: generateId(),
      year: targetYear,
      month: targetMonth,
    }));

    const recordMap = new Map<string, MonthlyRecord>();
    const buildKey = (r: MonthlyRecord) => `${r.accountId}-${r.year}-${r.month}`;
    currentData.records.forEach((r: MonthlyRecord) => recordMap.set(buildKey(r), r));
    importedRecords.forEach((r: MonthlyRecord) => recordMap.set(buildKey(r), r));
    currentData.records = Array.from(recordMap.values());

    currentData.logs.push(...importedLogs);
    currentData.attributions.push(...importedAttributions);
    currentData.monthlyAccountConfigs.push(...importedConfigs);

    data.accounts.forEach((importedAccount: Account) => {
      const existingIndex = currentData.accounts.findIndex(a => a.id === importedAccount.id);
      if (existingIndex >= 0) {
        currentData.accounts[existingIndex] = {
          ...currentData.accounts[existingIndex],
          name: importedAccount.name,
          type: importedAccount.type,
          icon: importedAccount.icon,
          isHidden: importedAccount.isHidden,
          includeInTotal: importedAccount.includeInTotal,
        };
      } else {
        currentData.accounts.push(importedAccount);
      }
    });

    saveData(currentData);
    return true;
  } catch (error) {
    console.error('Failed to import data:', error);
    return false;
  }
}

export function clearAllData(): void {
  localStorage.removeItem(STORAGE_KEY);
}

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
  
  // 记录账户的首次激活时间，防止新账户被回溯填充到创建之前的月份
  data.monthlyAccountConfigs.push({
    id: generateId(),
    accountId: newAccount.id,
    year: currentYear,
    month: currentMonth,
    status: 'active',
    firstActiveYear: currentYear,
    firstActiveMonth: currentMonth,
  });
  
  if (newAccount.balance !== 0) {
    data.records.push({
      id: generateId(),
      accountId: newAccount.id,
      year: currentYear,
      month: currentMonth,
      balance: newAccount.balance,
    });
  }
  
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
    
    if (updates.balance !== undefined && updates.balance !== oldAccount.balance) {
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

export function deleteAccount(id: string, year?: number, month?: number): boolean {
  const data = loadData();

  // 如果指定了年月，则只删除该月份的账户记录（快照机制）
  if (year !== undefined && month !== undefined) {
    // 删除指定月份的记录
    data.records = data.records.filter(r => !(r.accountId === id && r.year === year && r.month === month));
    // 添加删除日志
    const account = data.accounts.find(a => a.id === id);
    if (account) {
      data.logs.push({
        id: generateId(),
        accountId: id,
        accountName: account.name,
        year,
        month,
        oldBalance: 0,
        newBalance: 0,
        timestamp: Date.now(),
        operationType: 'account_delete',
      });
    }
    saveData(data);
    return true;
  }

  // 否则完全删除账户（原有逻辑）
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
  return [...data.accounts].sort(
    (a, b) => (a.sortOrder ?? 999999) - (b.sortOrder ?? 999999)
  );
}

export function reorderAccountInGroup(
  accountId: string,
  direction: 'up' | 'down'
): void {
  const data = loadData();
  const target = data.accounts.find(a => a.id === accountId);
  if (!target) return;

  const sameGroup = [...data.accounts]
    .filter(a => a.type === target.type)
    .sort((a, b) => (a.sortOrder ?? 999999) - (b.sortOrder ?? 999999));

  const idx = sameGroup.findIndex(a => a.id === accountId);
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= sameGroup.length) return;

  sameGroup.forEach((acc, i) => {
    const real = data.accounts.find(a => a.id === acc.id);
    if (real) real.sortOrder = i;
  });

  const a = data.accounts.find(a => a.id === sameGroup[idx].id)!;
  const b = data.accounts.find(a => a.id === sameGroup[swapIdx].id)!;
  [a.sortOrder, b.sortOrder] = [b.sortOrder, a.sortOrder];

  saveData(data);
}

export function setMonthlyRecord(accountId: string, year: number, month: number, balance: number): MonthlyRecord {
  const data = loadData();
  const account = data.accounts.find(a => a.id === accountId);
  
  const existingRecord = data.records.find(
    r => r.accountId === accountId && r.year === year && r.month === month
  );
  const oldBalance = existingRecord ? existingRecord.balance : (account?.balance || 0);
  
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

export function calculateMonthNetWorth(year: number, month: number): number {
  const data = loadData();
  const records = data.records.filter(r => r.year === year && r.month === month);
  
  let totalAssets = 0;
  let totalLiabilities = 0;
  
  for (const record of records) {
    const account = data.accounts.find(a => a.id === record.accountId);
    if (!account) continue;
    
    // 跳过不计入总余额的账户
    if (account.includeInTotal === false) continue;
    
    if (account.type === 'credit' || account.type === 'debt') {
      totalLiabilities += Math.abs(record.balance);
    } else {
      totalAssets += record.balance;
    }
  }
  
  return totalAssets - totalLiabilities;
}

export function calculateMonthTotalAssets(year: number, month: number): number {
  const data = loadData();
  const records = data.records.filter(r => r.year === year && r.month === month);
  
  let totalAssets = 0;
  
  for (const record of records) {
    const account = data.accounts.find(a => a.id === record.accountId);
    if (!account) continue;
    
    // 跳过不计入总余额的账户
    if (account.includeInTotal === false) continue;
    
    if (account.type !== 'credit' && account.type !== 'debt') {
      totalAssets += record.balance;
    }
  }
  
  return totalAssets;
}

export function calculateMonthTotalLiabilities(year: number, month: number): number {
  const data = loadData();
  const records = data.records.filter(r => r.year === year && r.month === month);
  
  let totalLiabilities = 0;
  
  for (const record of records) {
    const account = data.accounts.find(a => a.id === record.accountId);
    if (!account) continue;
    
    // 跳过不计入总余额的账户
    if (account.includeInTotal === false) continue;
    
    if (account.type === 'credit' || account.type === 'debt') {
      totalLiabilities += Math.abs(record.balance);
    }
  }
  
  return totalLiabilities;
}

export interface ExcelImportRow {
  year: number | string;
  month: number | string;
  accountId?: string;
  accountName: string;
  accountType?: string;
  accountIcon?: string;
  isHidden?: boolean;
  balance: number;
  attributionTag?: string;
  note?: string;
}

export function hasGarbledText(text: string): boolean {
  const cleanText = text.replace(/^\uFEFF/, '');
  return cleanText.includes('\uFFFD');
}

function parseCSVLine(line: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      parts.push(current.trim().replace(/"/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  parts.push(current.trim().replace(/"/g, ''));
  
  return parts;
}

const VALID_ACCOUNT_TYPES = ['cash', 'debit', 'credit', 'digital', 'investment', 'loan', 'debt'];

export function parseExcelCSV(content: string): ExcelImportRow[] {
  const cleanContent = content.replace(/^\uFEFF/, '').trim();
  const lines = cleanContent.split('\n');
  const result: ExcelImportRow[] = [];

  if (lines.length < 2) return result;

  const headerLine = lines[0].toLowerCase();
  const isNewFormat = headerLine.includes('账户id') && headerLine.includes('账户类型');

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#') || line.startsWith('---')) continue;

    const parts = parseCSVLine(line);
    if (parts.length < 3) continue;

    if (isNewFormat && isNaN(parseInt(parts[0]))) continue;

    let year: number, month: number, accountId: string | undefined, accountName: string, accountType: string | undefined, accountIcon: string | undefined, isHidden: boolean | undefined, balance: number, attributionTag: string | undefined, note: string | undefined;

    if (isNewFormat) {
      year = parseInt(parts[0]);
      month = parseInt(parts[1]);
      accountId = parts[2] || undefined;
      accountName = parts[3];
      accountType = VALID_ACCOUNT_TYPES.includes(parts[4]) ? parts[4] : undefined;
      accountIcon = parts[5] || undefined;
      isHidden = parts[6] === '1' ? true : parts[6] === '0' ? false : undefined;
      balance = parseFloat(parts[7].replace(/[¥￥]/g, '').replace(/,/g, '').replace(/\s+/g, ''));
      attributionTag = parts[8] || undefined;
      note = parts[9] || undefined;
    } else {
      const monthRaw = parts[0].replace(/^#.*/, '');
      const normalizedMonth = normalizeMonthFormat(monthRaw);
      if (!normalizedMonth) continue;
      const [y, m] = normalizedMonth.split('-');
      year = parseInt(y);
      month = parseInt(m);
      accountName = parts[1];
      balance = parseFloat(parts[2].replace(/[¥￥]/g, '').replace(/,/g, '').replace(/\s+/g, ''));
      attributionTag = parts[3] || undefined;
      note = parts[4] || undefined;
    }

    if (!year || !month || !accountName || isNaN(balance)) {
      result.push({ year: year || 0, month: month || 0, accountName, balance: 0, attributionTag: 'ERROR_PARSE', note: `第${i + 1}行格式错误` });
      continue;
    }

    result.push({ year, month, accountId, accountName, accountType, accountIcon, isHidden, balance, attributionTag, note } as ExcelImportRow);
  }

  return result;
}

function normalizeAccountName(name: string): string {
  return name
    .trim()
    .replace(/[\s\uFEFF\u200B]+/g, '')
    .toLowerCase();
}

function normalizeMonthFormat(monthStr: string): string | null {
  const monthMap: Record<string, string> = {
    'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
    'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
    'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
  };

  if (/^\d{4}-\d{2}$/.test(monthStr)) {
    return monthStr;
  }

  if (/^\d{4}\/\d{2}$/.test(monthStr)) {
    return monthStr.replace('/', '-');
  }

  const parts = monthStr.split(/[-\/ ]+/).filter(p => p.length > 0);
  if (parts.length === 2) {
    const [first, second] = parts;

    const firstIsMonth = monthMap[first.toLowerCase()] !== undefined;
    const secondIsMonth = monthMap[second.toLowerCase()] !== undefined;
    const firstIsYear = /^\d{2,4}$/.test(first);
    const secondIsYear = /^\d{2,4}$/.test(second);

    if (firstIsMonth && secondIsYear) {
      let year = parseInt(second);
      if (second.length === 2) {
        year = year < 70 ? year + 2000 : year + 1900;
      }
      return `${year}-${monthMap[first.toLowerCase()]}`;
    }

    if (secondIsMonth && firstIsYear) {
      let year = parseInt(first);
      if (first.length === 2) {
        year = year < 70 ? year + 2000 : year + 1900;
      }
      return `${year}-${monthMap[second.toLowerCase()]}`;
    }
  }

  return null;
}

export function batchImportFromExcel(rows: ExcelImportRow[], mergeMode: 'overwrite' | 'merge' | 'skip' = 'merge'): { success: boolean; message: string; importedCount: number; unmatchedAccounts?: string[]; createdAccounts?: string[] } {
  if (rows.length === 0) {
    return { success: false, message: 'CSV 数据为空，请检查文件内容', importedCount: 0 };
  }

  try {
    const data = loadData();
    let importedCount = 0;
    const unmatchedAccounts: string[] = [];
    const attributionData: { year: number; month: number; change: number; tags: AttributionTag[]; note?: string }[] = [];
    const createdAccounts: string[] = [];

    // 第一遍：收集并自动创建不存在的账户
    const accountSet = new Set(data.accounts.map(a => normalizeAccountName(a.name)));
    for (const row of rows) {
      const normalizedRowName = normalizeAccountName(row.accountName);
      if (!accountSet.has(normalizedRowName)) {
        // 检查是否已添加过
        const alreadyAdded = data.accounts.some(a => normalizeAccountName(a.name) === normalizedRowName);
        if (!alreadyAdded) {
          // 使用导入数据中的类型、图标和隐藏状态，或使用默认值
          const accountType = (row.accountType && VALID_ACCOUNT_TYPES.includes(row.accountType)) ? row.accountType as AccountType : 'debit';
          const accountIcon = row.accountIcon || 'credit-card';
          const isHidden = row.isHidden ?? false;
          const newAccount: Account = {
            id: generateId(),
            name: row.accountName,
            type: accountType,
            icon: accountIcon,
            balance: 0,
            includeInTotal: true,
            isHidden: isHidden,
          };
          data.accounts.push(newAccount);
          createdAccounts.push(row.accountName);
          
          // 记录账户的首次激活时间，防止新账户被回溯填充到创建之前的月份
          data.monthlyAccountConfigs.push({
            id: generateId(),
            accountId: newAccount.id,
            year: Number(row.year),
            month: Number(row.month),
            status: 'active',
            firstActiveYear: Number(row.year),
            firstActiveMonth: Number(row.month),
          });
          
          accountSet.add(normalizedRowName);
        }
      }
    }

    // 第二遍：导入资产数据
    for (const row of rows) {
      const year = row.year;
      const month = row.month;

      const normalizedRowName = normalizeAccountName(row.accountName);

      let targetAccount = data.accounts.find(a => a.name === row.accountName);
      if (!targetAccount) {
        targetAccount = data.accounts.find(a => normalizeAccountName(a.name) === normalizedRowName);
      }

      if (!targetAccount) {
        if (!unmatchedAccounts.includes(row.accountName)) {
          unmatchedAccounts.push(row.accountName);
        }
        continue;
      }

      // 修复：只更新指定账户的记录，而不是遍历所有账户
      if (mergeMode === 'overwrite') {
        data.records = data.records.filter(
          r => !(r.accountId === targetAccount.id && r.year === year && r.month === month)
        );
      }

      // 检查该账户该月份是否已有记录
      const existingRecord = data.records.find(
        r => r.accountId === targetAccount.id && r.year === year && r.month === month
      );

      if (existingRecord) {
        attributionData.push({
          year: Number(year),
          month: Number(month),
          change: row.balance - existingRecord.balance,
          tags: row.attributionTag ? [row.attributionTag as AttributionTag] : [],
          note: row.note
        });
        existingRecord.balance = row.balance;
      } else {
        attributionData.push({
          year: Number(year),
          month: Number(month),
          change: row.balance,
          tags: row.attributionTag ? [row.attributionTag as AttributionTag] : [],
          note: row.note
        });
        data.records.push({
          id: generateId(),
          accountId: targetAccount.id,
          year: Number(year),
          month: Number(month),
          balance: row.balance,
        });
      }

      importedCount++;
    }

    // 处理归因数据导入
    if (attributionData.length > 0) {
      const uniqueMonths = new Map<string, { year: number; month: number; tags: AttributionTag[]; note?: string }>();
      
      for (const attr of attributionData) {
        const key = `${attr.year}-${attr.month}`;
        if (!uniqueMonths.has(key) && attr.tags.length > 0) {
          uniqueMonths.set(key, { year: attr.year, month: attr.month, tags: attr.tags, note: attr.note });
        } else if (uniqueMonths.has(key) && attr.note) {
          const existing = uniqueMonths.get(key)!;
          if (!existing.note && attr.note) {
            existing.note = attr.note;
          }
        }
      }

      for (const attr of uniqueMonths.values()) {
        if (attr.tags.length > 0) {
          const existingAttr = data.attributions.find(a => a.year === attr.year && a.month === attr.month);
          if (existingAttr) {
            if (mergeMode === 'overwrite') {
              existingAttr.tags = attr.tags;
              existingAttr.note = attr.note;
            } else {
              existingAttr.tags = [...new Set([...existingAttr.tags, ...attr.tags])];
              if (attr.note && !existingAttr.note) {
                existingAttr.note = attr.note;
              }
            }
          } else {
            data.attributions.push({
              id: generateId(),
              year: attr.year,
              month: attr.month,
              change: 0,
              changePercent: 0,
              fluctuationLevel: 'normal',
              tags: attr.tags,
              note: attr.note,
              timestamp: Date.now(),
            });
          }
        }
      }
    }

    // 导入后补全快照：为该月所有应显示的账户补全记录
    // 注意：必须在 saveData 之后执行，因为需要基于最新的 records 数据
    let snapshotCompleted = false;
    let snapshotImportYear = 0;
    let snapshotImportMonth = 0;
    
    if (mergeMode === 'overwrite' && rows.length > 0) {
      snapshotImportYear = Number(rows[0].year);
      snapshotImportMonth = Number(rows[0].month);
      snapshotCompleted = true;
    }

    saveData(data);

    // 补全快照逻辑（在 saveData 之后执行）
    if (snapshotCompleted) {
      const data2 = loadData();
      const targetKey = snapshotImportYear * 100 + snapshotImportMonth;

      // 获取该月应显示的账户（基于更新后的 records）
      const visibleAccounts = getAccountsForMonth(snapshotImportYear, snapshotImportMonth);
      
      for (const account of visibleAccounts) {
        const hasRecord = data2.records.some(
          r => r.accountId === account.id && r.year === snapshotImportYear && r.month === snapshotImportMonth
        );
        
        if (!hasRecord) {
          // 继承上月余额
          const previousRecords = data2.records
            .filter(r => r.accountId === account.id)
            .filter(r => {
              const recordKey = r.year * 100 + r.month;
              return recordKey < targetKey;
            })
            .sort((a, b) => {
              const keyA = a.year * 100 + a.month;
              const keyB = b.year * 100 + b.month;
              return keyB - keyA;
            });
          
          const inheritedBalance = previousRecords.length > 0 ? previousRecords[0].balance : 0;
          
          data2.records.push({
            id: generateId(),
            accountId: account.id,
            year: snapshotImportYear,
            month: snapshotImportMonth,
            balance: inheritedBalance,
          });
        }
      }
      
      saveData(data2);
    }

    const createdMsg = createdAccounts.length > 0 
      ? `\n\n✅ 已自动创建 ${createdAccounts.length} 个账户：${createdAccounts.slice(0, 3).map(n => `「${n}」`).join('、')}${createdAccounts.length > 3 ? `等${createdAccounts.length}个` : ''}`
      : '';

    if (unmatchedAccounts.length > 0) {
      const accountList = unmatchedAccounts.slice(0, 5).map(name => `「${name}」`).join('、');
      const moreText = unmatchedAccounts.length > 5 ? `等${unmatchedAccounts.length}个` : '';
      const hintText = '\n\n💡 提示：如账户名称匹配失败，请检查 CSV 文件是否使用 UTF-8 编码';
      return {
        success: true,
        message: `成功导入 ${importedCount} 个月的数据${createdMsg}\n\n⚠️ 未找到以下账户：${accountList}${moreText}${hintText}`,
        importedCount,
        unmatchedAccounts,
        createdAccounts
      };
    }

    return { success: true, message: `成功导入 ${importedCount} 个月的数据${createdMsg}`, importedCount, createdAccounts };
  } catch (error) {
    console.error('Excel 导入失败:', error);
    return { success: false, message: 'Excel 导入失败，请检查文件格式', importedCount: 0 };
  }
}

export function exportExcelTemplate(): string {
  const accounts = getAllAccounts();
  const BOM = '\uFEFF';
  const header = '月份(YYYY-MM),账户名称,余额,归因标签(可选),备注(可选)';

  const now = new Date();
  const examples: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const monthStr = `${year}-${month.toString().padStart(2, '0')}`;
    const defaultAccount = accounts.length > 0 ? accounts[0].name : '账户名称';
    examples.push(`${monthStr},${defaultAccount},0.00,,`);
  }

  return BOM + [header, ...examples].join('\n');
}

export function exportToCSV(startYear?: number, startMonth?: number, endYear?: number, endMonth?: number): string {
  const data = loadData();
  const BOM = '\uFEFF';
  const header = '年份,月份,账户ID,账户名称,账户类型,账户图标,是否隐藏,余额,归因标签(可选),备注(可选)';

  const yearSet = new Set<number>();
  const monthSet = new Set<number>();

  for (const record of data.records) {
    if (startYear !== undefined && startMonth !== undefined) {
      const recordKey = record.year * 100 + record.month;
      const startKey = startYear * 100 + startMonth;
      const endKey = (endYear || startYear) * 100 + (endMonth || startMonth);
      if (recordKey >= startKey && recordKey <= endKey) {
        yearSet.add(record.year);
        monthSet.add(record.month);
      }
    } else {
      yearSet.add(record.year);
      monthSet.add(record.month);
    }
  }

  const sortedYears = Array.from(yearSet).sort();
  const sortedMonths = Array.from(monthSet).sort((a, b) => a - b);

  const rows: string[] = [header];

  for (const year of sortedYears) {
    for (const month of sortedMonths) {
      for (const account of data.accounts) {
        const record = data.records.find(r => 
          r.accountId === account.id && r.year === year && r.month === month
        );
        
        if (record) {
          const attribution = data.attributions.find(a => 
            a.year === year && a.month === month
          );
          const tag = attribution?.tags?.[0] ? getAttributionTagLabel(attribution.tags[0] as AttributionTag) : '';
          const note = attribution?.note || '';
          const escapedName = account.name.includes(',') ? `"${account.name}"` : account.name;
          rows.push(`${year},${month},${account.id},${escapedName},${account.type},${account.icon},${account.isHidden ? 1 : 0},${record.balance.toFixed(2)},${tag},${note}`);
        }
      }
    }
  }

  return BOM + rows.join('\n');
}

export function exportMonthlyAttributionCSV(startYear?: number, startMonth?: number, endYear?: number, endMonth?: number): string {
  const data = loadData();
  const BOM = '\uFEFF';
  const header = '年份,月份,归因标签,变动金额,变动百分比,备注';

  const filteredAttributions = data.attributions.filter(a => {
    const attrKey = a.year * 100 + a.month;
    const startKey = (startYear || 0) * 100 + (startMonth || 1);
    const endKey = (endYear || 9999) * 100 + (endMonth || 12);
    return attrKey >= startKey && attrKey <= endKey;
  });

  const sortedAttributions = filteredAttributions.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });

  const rows: string[] = [header];
  for (const attr of sortedAttributions) {
    const tags = attr.tags.map(t => getAttributionTagLabel(t)).join('、');
    const note = (attr.note || '').replace(/,/g, ';');
    rows.push(`${attr.year},${attr.month},${tags},${attr.change.toFixed(2)},${attr.changePercent.toFixed(2)},${note}`);
  }

  return BOM + rows.join('\n');
}

export function exportYearlyAttributionCSV(startYear?: number, endYear?: number): string {
  const data = loadData();
  const BOM = '\uFEFF';
  const header = '年份,归因标签,关键月份,变动金额,变动百分比,年末净资产,备注';

  const filteredAttributions = data.yearlyAttributions.filter(a => {
    return (!startYear || a.year >= startYear) && (!endYear || a.year <= endYear);
  });

  const sortedAttributions = filteredAttributions.sort((a, b) => a.year - b.year);

  const formatKeyMonth = (item: string): string => {
    if (/^\d+$/.test(item)) {
      return `${item}月`;
    }
    return getAttributionTagLabel(item as AttributionTag);
  };

  const rows: string[] = [header];
  for (const attr of sortedAttributions) {
    const tags = attr.tags.map(t => getYearlyAttributionTagLabel(t)).join('、');
    const keyMonths = attr.keyMonths.map(formatKeyMonth).join('、');
    const note = (attr.note || '').replace(/,/g, ';');
    rows.push(`${attr.year},${tags},${keyMonths},${attr.change.toFixed(2)},${attr.changePercent.toFixed(2)},${attr.netWorth.toFixed(2)},${note}`);
  }

  return BOM + rows.join('\n');
}

function parseAttributionTagFromLabel(label: string): AttributionTag | null {
  const labelToTag: Record<string, AttributionTag> = {
    '工资积累': 'salary',
    '投资收益': 'investment',
    '日常波动': 'daily',
    '其他': 'other',
    '工资收入': 'salary_income',
    '奖金': 'bonus',
    '年终奖': 'year_end_bonus',
    '借款归还': 'loan_repayment',
    '大额支出': 'large_expense',
    '转账调整': 'transfer',
    '异常变动': 'abnormal_other',
  };
  return labelToTag[label] || null;
}

export function importMonthlyAttributionCSV(
  csvContent: string,
  mergeMode: 'overwrite' | 'merge' | 'skip' = 'merge'
): { success: boolean; message: string; importedCount: number; skippedCount: number } {
  try {
    const cleanContent = csvContent.replace(/^\uFEFF/, '');
    const lines = cleanContent.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      return { success: false, message: 'CSV文件内容为空', importedCount: 0, skippedCount: 0 };
    }

    const rows = lines.slice(1);
    let importedCount = 0;
    let skippedCount = 0;

    for (const row of rows) {
      const parts = parseCSVLine(row);
      if (parts.length < 4) {
        skippedCount++;
        continue;
      }

      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]);
      const tagsStr = parts[2] || '';
      const change = parseFloat(parts[3]) || 0;
      const changePercent = parseFloat(parts[4]) || 0;
      const note = parts[5] || '';

      if (!year || !month) {
        skippedCount++;
        continue;
      }

      const tags = tagsStr.split('|').filter(Boolean).map(t => parseAttributionTagFromLabel(t)).filter((t): t is AttributionTag => t !== null);

      const data = loadData();
      const existingIndex = data.attributions.findIndex(a => a.year === year && a.month === month);

      if (existingIndex >= 0 && mergeMode === 'skip') {
        skippedCount++;
        continue;
      }

      const attribution: MonthlyAttribution = {
        id: existingIndex >= 0 && mergeMode === 'merge' ? data.attributions[existingIndex].id : generateId(),
        year,
        month,
        change,
        changePercent,
        fluctuationLevel: calculateFluctuationLevel(changePercent),
        tags,
        note,
        timestamp: Date.now(),
      };

      if (existingIndex >= 0) {
        if (mergeMode === 'merge') {
          const existingTags = new Set(data.attributions[existingIndex].tags);
          tags.forEach(t => existingTags.add(t));
          attribution.tags = Array.from(existingTags);
        }
        data.attributions[existingIndex] = attribution;
      } else {
        data.attributions.push(attribution);
      }

      saveData(data);
      importedCount++;
    }

    return { success: true, message: `成功导入${importedCount}条月度归因记录`, importedCount, skippedCount };
  } catch (error) {
    console.error('Failed to import monthly attribution CSV:', error);
    return { success: false, message: '导入失败：文件格式错误', importedCount: 0, skippedCount: 0 };
  }
}

function parseYearlyAttributionTagFromLabel(label: string): YearlyAttributionTag | null {
  const labelToTag: Record<string, YearlyAttributionTag> = {
    '工资增长': 'salary_growth',
    '奖金丰厚': 'bonus_丰厚',
    '投资丰收': 'investment_return',
    '资产变动': 'asset_change',
    '大额支出': 'large_expense',
    '账户整合': 'account_integration',
    '其他': 'yearly_other',
  };
  return labelToTag[label] || null;
}

export function importYearlyAttributionCSV(
  csvContent: string,
  mergeMode: 'overwrite' | 'merge' | 'skip' = 'merge'
): { success: boolean; message: string; importedCount: number; skippedCount: number } {
  try {
    const cleanContent = csvContent.replace(/^\uFEFF/, '');
    const lines = cleanContent.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      return { success: false, message: 'CSV文件内容为空', importedCount: 0, skippedCount: 0 };
    }

    const rows = lines.slice(1);
    let importedCount = 0;
    let skippedCount = 0;

    for (const row of rows) {
      const parts = parseCSVLine(row);
      if (parts.length < 5) {
        skippedCount++;
        continue;
      }

      const year = parseInt(parts[0]);
      const tagsStr = parts[1] || '';
      const keyMonthsStr = parts[2] || '';
      const change = parseFloat(parts[3]) || 0;
      const changePercent = parseFloat(parts[4]) || 0;
      const netWorth = parseFloat(parts[5]) || 0;
      const note = parts[6] || '';

      if (!year) {
        skippedCount++;
        continue;
      }

      const tags = tagsStr.split('|').filter(Boolean).map(t => parseYearlyAttributionTagFromLabel(t)).filter((t): t is YearlyAttributionTag => t !== null);
      const keyMonths = keyMonthsStr.split('|').filter(Boolean);

      const data = loadData();
      const existingIndex = data.yearlyAttributions.findIndex(a => a.year === year);

      if (existingIndex >= 0 && mergeMode === 'skip') {
        skippedCount++;
        continue;
      }

      const attribution: YearlyAttribution = {
        id: existingIndex >= 0 && mergeMode === 'merge' ? data.yearlyAttributions[existingIndex].id : generateId(),
        year,
        netWorth,
        change,
        changePercent,
        tags,
        note,
        keyMonths,
        timestamp: Date.now(),
      };

      if (existingIndex >= 0) {
        if (mergeMode === 'merge') {
          const existingTags = new Set(data.yearlyAttributions[existingIndex].tags);
          tags.forEach(t => existingTags.add(t));
          attribution.tags = Array.from(existingTags);
        }
        data.yearlyAttributions[existingIndex] = attribution;
      } else {
        data.yearlyAttributions.push(attribution);
      }

      saveData(data);
      importedCount++;
    }

    return { success: true, message: `成功导入${importedCount}条年度归因记录`, importedCount, skippedCount };
  } catch (error) {
    console.error('Failed to import yearly attribution CSV:', error);
    return { success: false, message: '导入失败：文件格式错误', importedCount: 0, skippedCount: 0 };
  }
}

export function batchImportByRange(
  rows: ExcelImportRow[],
  startYear: number,
  startMonth: number,
  endYear: number,
  endMonth: number,
  mergeMode: 'overwrite' | 'merge' | 'skip' = 'merge'
): { success: boolean; message: string; importedCount: number } {
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

export function calculateFluctuationLevel(changePercent: number): FluctuationLevel {
  const absPercent = Math.abs(changePercent);
  if (absPercent > 30) {
    return 'abnormal';
  } else if (absPercent > 10) {
    return 'warning';
  }
  return 'normal';
}

export function getMonthlyAttribution(year: number, month: number): MonthlyAttribution | null {
  const data = loadData();
  return data.attributions.find(a => a.year === year && a.month === month) || null;
}

export function saveMonthlyAttribution(
  year: number,
  month: number,
  change: number,
  changePercent: number,
  tags: AttributionTag[],
  note?: string
): void {
  const data = loadData();

  const existingIndex = data.attributions.findIndex(a => a.year === year && a.month === month);

  const attribution: MonthlyAttribution = {
    id: existingIndex >= 0 ? data.attributions[existingIndex].id : generateId(),
    year,
    month,
    change,
    changePercent,
    fluctuationLevel: calculateFluctuationLevel(changePercent),
    tags,
    note,
    timestamp: Date.now(),
  };

  if (existingIndex >= 0) {
    data.attributions[existingIndex] = attribution;
  } else {
    data.attributions.push(attribution);
  }

  saveData(data);
}

export function getAllAttributions(): MonthlyAttribution[] {
  const data = loadData();
  return data.attributions.sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });
}

export function deleteMonthlyAttribution(year: number, month: number): void {
  const data = loadData();
  data.attributions = data.attributions.filter(a => !(a.year === year && a.month === month));
  saveData(data);
}

export function getAttributionTagLabel(tag: AttributionTag): string {
  const tagLabels: Record<string, string> = {
    salary: '工资积累',
    investment: '投资收益',
    daily: '日常波动',
    other: '其他',
    salary_income: '工资收入',
    bonus: '奖金',
    year_end_bonus: '年终奖',
    loan_repayment: '借款归还',
    large_expense: '大额支出',
    transfer: '转账调整',
    abnormal_other: '异常变动',
  };
  if (tagLabels[tag]) return tagLabels[tag];
  // 自定义标签：只有 custom_ 前缀的才需要查 localStorage
  if (tag.startsWith('custom_')) {
    const customTags = getCustomAttributionTags();
    const customTag = customTags.find(t => t.id === tag);
    return customTag ? customTag.label : tag;
  }
  return tag;
}

export function getAttributionTagEmoji(tag: AttributionTag): string {
  const tagEmojis: Record<string, string> = {
    salary: '💰',
    investment: '📈',
    daily: '🔄',
    other: '📝',
    salary_income: '💰',
    bonus: '🎁',
    year_end_bonus: '🧧',
    loan_repayment: '🔄',
    large_expense: '🛒',
    transfer: '🔀',
    abnormal_other: '📝',
  };
  if (tagEmojis[tag]) return tagEmojis[tag];
  // 自定义标签：只有 custom_ 前缀的才需要查 localStorage
  if (tag.startsWith('custom_')) {
    const customTags = getCustomAttributionTags();
    const customTag = customTags.find(t => t.id === tag);
    return customTag ? customTag.emoji : '📝';
  }
  return '📝';
}

export function getYearlyAttributionTagLabel(tag: string): string {
  const yearlyOption = PRESET_YEARLY_TAGS.find(t => t.id === tag);
  if (yearlyOption) return yearlyOption.label;
  const monthlyOption = PRESET_MONTHLY_TAGS.find(t => t.id === tag);
  if (monthlyOption) return monthlyOption.label;
  if (tag.startsWith('custom_')) {
    const customTag = getCustomAttributionTags().find(t => t.id === tag);
    return customTag ? customTag.label : tag;
  }
  return tag;
}

export function getYearlyAttributionTagEmoji(tag: string): string {
  const yearlyOption = PRESET_YEARLY_TAGS.find(t => t.id === tag);
  if (yearlyOption) return yearlyOption.emoji;
  const monthlyOption = PRESET_MONTHLY_TAGS.find(t => t.id === tag);
  if (monthlyOption) return monthlyOption.emoji;
  if (tag.startsWith('custom_')) {
    const customTag = getCustomAttributionTags().find(t => t.id === tag);
    return customTag ? customTag.emoji : '📝';
  }
  return '📝';
}

export function getCustomAttributionTags(): CustomAttributionTag[] {
  try {
    const raw = localStorage.getItem(CUSTOM_TAGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCustomAttributionTag(tag: Omit<CustomAttributionTag, 'id' | 'createdAt'>): CustomAttributionTag {
  const tags = getCustomAttributionTags();
  const newTag: CustomAttributionTag = {
    ...tag,
    id: `custom_${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(CUSTOM_TAGS_KEY, JSON.stringify([...tags, newTag]));
  return newTag;
}

export function deleteCustomAttributionTag(id: string): void {
  const tags = getCustomAttributionTags().filter(t => t.id !== id);
  localStorage.setItem(CUSTOM_TAGS_KEY, JSON.stringify(tags));
}

const PRESET_MONTHLY_TAGS: TagOption[] = [
  { id: 'salary', label: '工资积累', emoji: '💰', editable: false },
  { id: 'investment', label: '投资收益', emoji: '📈', editable: false },
  { id: 'daily', label: '日常波动', emoji: '🔄', editable: false },
  { id: 'other', label: '其他', emoji: '📝', editable: false },
  { id: 'salary_income', label: '工资收入', emoji: '💰', editable: false },
  { id: 'bonus', label: '奖金', emoji: '🎁', editable: false },
  { id: 'year_end_bonus', label: '年终奖', emoji: '🧧', editable: false },
  { id: 'loan_repayment', label: '借款归还', emoji: '🔄', editable: false },
  { id: 'large_expense', label: '大额支出', emoji: '🛒', editable: false },
  { id: 'transfer', label: '转账调整', emoji: '🔀', editable: false },
  { id: 'abnormal_other', label: '异常变动', emoji: '📝', editable: false },
];

export function getAllAttributionTagOptions(): TagOption[] {
  const customTags = getCustomAttributionTags().map(t => ({
    id: t.id,
    label: t.label,
    emoji: t.emoji,
    editable: true,
  }));
  return [...PRESET_MONTHLY_TAGS, ...customTags];
}

const PRESET_YEARLY_TAGS: TagOption[] = [
  { id: 'salary_growth', label: '工资增长', emoji: '💰', editable: false },
  { id: 'bonus_丰厚', label: '奖金丰厚', emoji: '🎁', editable: false },
  { id: 'investment_return', label: '投资丰收', emoji: '📈', editable: false },
  { id: 'asset_change', label: '资产变动', emoji: '🏠', editable: false },
  { id: 'large_expense', label: '大额支出', emoji: '💸', editable: false },
  { id: 'account_integration', label: '账户整合', emoji: '🔄', editable: false },
  { id: 'yearly_other', label: '其他', emoji: '📝', editable: false },
];

export function getAllYearlyTagOptions(): TagOption[] {
  const customTags = getCustomAttributionTags().map(t => ({
    id: t.id,
    label: t.label,
    emoji: t.emoji,
    editable: true,
  }));
  return [...PRESET_YEARLY_TAGS, ...customTags];
}

export function findAttributionTagOption(tagId: string): TagOption | undefined {
  return getAllAttributionTagOptions().find(t => t.id === tagId);
}

export function findAttributionTagOptionByLabel(label: string): TagOption | undefined {
  return getAllAttributionTagOptions().find(t => t.label === label);
}

export function getYearlyAttribution(year: number): YearlyAttribution | null {
  const data = loadData();
  return data.yearlyAttributions.find(a => a.year === year) || null;
}

export function saveYearlyAttribution(
  year: number,
  netWorth: number,
  change: number,
  changePercent: number,
  tags: YearlyAttributionTag[],
  note?: string,
  keyMonths: string[] = []
): void {
  const data = loadData();

  const existingIndex = data.yearlyAttributions.findIndex(a => a.year === year);

  const attribution: YearlyAttribution = {
    id: existingIndex >= 0 ? data.yearlyAttributions[existingIndex].id : generateId(),
    year,
    netWorth,
    change,
    changePercent,
    tags,
    note,
    keyMonths,
    timestamp: Date.now(),
  };

  if (existingIndex >= 0) {
    data.yearlyAttributions[existingIndex] = attribution;
  } else {
    data.yearlyAttributions.push(attribution);
  }

  saveData(data);
}

export function getAllYearlyAttributions(): YearlyAttribution[] {
  const data = loadData();
  return data.yearlyAttributions.sort((a, b) => b.year - a.year);
}

export function deleteYearlyAttribution(year: number): void {
  const data = loadData();
  data.yearlyAttributions = data.yearlyAttributions.filter(a => a.year !== year);
  saveData(data);
}

export function getMonthlyAttributionsByYear(year: number): MonthlyAttribution[] {
  const data = loadData();
  return data.attributions
    .filter(a => a.year === year)
    .sort((a, b) => a.month - b.month);
}

export function getAccountSnapshotsByMonth(year: number, month: number): AccountSnapshot[] {
  const data = loadData();
  const records = data.records.filter(r => r.year === year && r.month === month);
  const snapshots: AccountSnapshot[] = [];

  for (const record of records) {
    const account = data.accounts.find(a => a.id === record.accountId);
    if (!account) continue;

    let lastYear = year;
    let lastMonth = month - 1;
    if (lastMonth === 0) {
      lastYear--;
      lastMonth = 12;
    }
    const lastRecord = data.records.find(
      r => r.accountId === record.accountId && r.year === lastYear && r.month === lastMonth
    );
    const lastBalance = lastRecord ? lastRecord.balance : 0;

    snapshots.push({
      accountId: account.id,
      accountName: account.name,
      accountIcon: account.icon,
      accountType: account.type,
      balance: record.balance,
      change: record.balance - lastBalance,
    } as AccountSnapshot);
  }

  return snapshots;
}

// 获取指定月份的账户列表（快照机制 + 继承机制）
// 规则：该月份有记录的账户 + 历史上曾经有过记录且未在该月被删除的账户
export function getAccountsByMonth(year: number, month: number): Account[] {
  const data = loadData();

  // 获取该月份有记录的账户ID
  const monthRecordIds = new Set(
    data.records
      .filter(r => r.year === year && r.month === month)
      .map(r => r.accountId)
  );

  // 如果该月份有记录，直接返回有记录的账户
  if (monthRecordIds.size > 0) {
    return data.accounts.filter(a => monthRecordIds.has(a.id));
  }

  // 如果该月份没有记录，向前查找最近有记录的账户
  const allRecords = data.records
    .filter(r => {
      if (r.year < year) return true;
      if (r.year === year && r.month < month) return true;
      return false;
    })
    .sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });

  // 获取有历史记录的账户ID
  const historicallyRecordedIds = new Set(allRecords.map(r => r.accountId));
  return data.accounts.filter(a => historicallyRecordedIds.has(a.id));
}

// 获取指定月份账户的余额（支持继承机制）
export function getAccountBalanceForMonth(accountId: string, year: number, month: number): number {
  const data = loadData();
  const targetKey = year * 100 + month;

  // 1. 严格查找目标月份记录（取最新的：id最大的）
  const monthRecords = data.records
    .filter(r => r.accountId === accountId && r.year === year && r.month === month)
    .sort((a, b) => b.id.localeCompare(a.id));
  
  if (monthRecords.length > 0) {
    return monthRecords[0].balance;
  }

  // 2. 向前查找（历史继承），严格小于目标月份
  const previousRecords = data.records
    .filter(r => r.accountId === accountId)
    .filter(r => {
      const recordKey = r.year * 100 + r.month;
      return recordKey < targetKey;
    })
    .sort((a, b) => {
      const keyA = a.year * 100 + a.month;
      const keyB = b.year * 100 + b.month;
      return keyB - keyA;
    });

  if (previousRecords.length > 0) {
    return previousRecords[0].balance;
  }

  // 3. 如果没有历史记录，返回账户默认余额
  const account = data.accounts.find(a => a.id === accountId);
  return account?.balance || 0;
}

// ========== 月度账户快照核心逻辑 ==========

/**
 * 获取指定月份应显示的账户列表（基于 records 优先）
 * 策略：
 * 1. 该月有明确记录的账户 → 直接显示（不受首次激活时间限制）
 * 2. 该月无记录，但历史上曾有记录且未被当月删除 → 继承显示
 * 3. 继承逻辑需检查账户首次激活时间，防止新账户被回溯填充到创建之前的月份
 */
export function getAccountsForMonth(year: number, month: number): Account[] {
  const data = loadData();
  const targetKey = year * 100 + month;

  // 1. 获取该月有明确记录的账户ID（显式记录，不受首次激活时间限制）
  const monthRecordIds = new Set(
    data.records
      .filter(r => r.year === year && r.month === month)
      .map(r => r.accountId)
  );

  // 2. 获取该月被删除的账户ID
  const deletedIds = new Set(
    data.monthlyAccountConfigs
      .filter(c => c.year === year && c.month === month && c.status === 'deleted')
      .map(c => c.accountId)
  );

  // 3. 构建账户首次激活时间查找表
  const accountFirstActiveMap = new Map<string, number>();
  for (const config of data.monthlyAccountConfigs) {
    if (config.status === 'active') {
      const key = config.firstActiveYear * 100 + config.firstActiveMonth;
      const existing = accountFirstActiveMap.get(config.accountId);
      if (existing === undefined || key < existing) {
        accountFirstActiveMap.set(config.accountId, key);
      }
    }
  }

  // 4. 收集应继承显示的账户ID（只继承到账户创建之后的月份）
  const inheritedIds = new Set<string>();
  
  for (const account of data.accounts) {
    if (monthRecordIds.has(account.id)) continue;
    if (deletedIds.has(account.id)) continue;
    if (account.isHidden) continue;

    // 关键修复：只有当目标月份不早于账户首次激活月份时，才继承显示
    const firstActiveKey = accountFirstActiveMap.get(account.id);
    if (firstActiveKey !== undefined && targetKey < firstActiveKey) {
      continue; // 该账户在目标月份尚未创建，不继承
    }

    // 检查该账户是否在目标月份之前曾有记录
    const hasOldRecord = data.records.some(r => {
      if (r.accountId !== account.id) return false;
      const recordKey = r.year * 100 + r.month;
      return recordKey < targetKey;
    });

    if (hasOldRecord) {
      inheritedIds.add(account.id);
    }
  }

  // 5. 合并：该月有记录的 + 应继承的
  const allVisibleIds = new Set([...monthRecordIds, ...inheritedIds]);
  return data.accounts
    .filter(a => allVisibleIds.has(a.id) && !a.isHidden)
    .sort((a, b) => (a.sortOrder ?? 999999) - (b.sortOrder ?? 999999));
}

/**
 * 在当前月新增账户（打上首次激活标记）
 */
export function addAccountToMonth(
  account: Omit<Account, 'id'>,
  year: number,
  month: number
): Account {
  const data = loadData();
  const newAccount: Account = { ...account, id: generateId() };
  data.accounts.push(newAccount);

  data.monthlyAccountConfigs.push({
    id: generateId(),
    accountId: newAccount.id,
    year,
    month,
    status: 'active',
    firstActiveYear: year,
    firstActiveMonth: month,
  });

  if (newAccount.balance !== 0) {
    data.records.push({
      id: generateId(),
      accountId: newAccount.id,
      year,
      month,
      balance: newAccount.balance,
    });
  }

  data.logs.push({
    id: generateId(),
    accountId: newAccount.id,
    accountName: newAccount.name,
    year,
    month,
    oldBalance: 0,
    newBalance: newAccount.balance,
    timestamp: Date.now(),
    operationType: 'account_create',
  });

  saveData(data);
  return newAccount;
}

/**
 * 删除某月的账户（仅本月，不影响历史和未来）
 */
export function deleteAccountFromMonth(
  accountId: string,
  year: number,
  month: number
): boolean {
  const data = loadData();
  const account = data.accounts.find(a => a.id === accountId);
  if (!account) return false;

  const targetKey = year * 100 + month;

  // 删除该月及之后所有的记录（保留历史记录）
  data.records = data.records.filter(r => {
    if (r.accountId !== accountId) return true;
    const recordKey = r.year * 100 + r.month;
    return recordKey > targetKey;
  });

  // 检查目标月份是否已存在配置
  const configs = data.monthlyAccountConfigs.filter(c => c.accountId === accountId);
  const existingConfig = configs.find(c => c.year === year && c.month === month);
  
  if (existingConfig) {
    existingConfig.status = 'deleted';
  } else {
    // 找首次激活时间
    const activeConfig = configs.find(c => c.status === 'active');
    const firstActiveYear = activeConfig?.firstActiveYear || year;
    const firstActiveMonth = activeConfig?.firstActiveMonth || month;
    
    data.monthlyAccountConfigs.push({
      id: generateId(),
      accountId,
      year,
      month,
      status: 'deleted',
      firstActiveYear,
      firstActiveMonth,
    });
  }

  data.logs.push({
    id: generateId(),
    accountId,
    accountName: account.name,
    year,
    month,
    oldBalance: 0,
    newBalance: 0,
    timestamp: Date.now(),
    operationType: 'account_delete',
  });

  saveData(data);
  return true;
}

/**
 * 完全删除账户（清除所有历史）
 */
export function deleteAccountGlobally(accountId: string): boolean {
  const data = loadData();
  const index = data.accounts.findIndex(a => a.id === accountId);
  if (index === -1) return false;

  data.accounts.splice(index, 1);
  data.records = data.records.filter(r => r.accountId !== accountId);
  data.logs = data.logs.filter(l => l.accountId !== accountId);
  data.monthlyAccountConfigs = data.monthlyAccountConfigs.filter(
    c => c.accountId !== accountId
  );
  saveData(data);
  return true;
}

/**
 * 旧数据迁移：为现有账户生成 MonthlyAccountConfig
 */
export function migrateToMonthlyAccountConfigs(): void {
  const data = loadData();
  if (data.monthlyAccountConfigs.length > 0) return;

  const configs: MonthlyAccountConfig[] = [];

  for (const account of data.accounts) {
    const records = data.records
      .filter(r => r.accountId === account.id)
      .sort((a, b) => (a.year * 100 + a.month) - (b.year * 100 + b.month));

    const firstRecord = records[0];
    if (firstRecord) {
      configs.push({
        id: generateId(),
        accountId: account.id,
        year: firstRecord.year,
        month: firstRecord.month,
        status: 'active',
        firstActiveYear: firstRecord.year,
        firstActiveMonth: firstRecord.month,
      });
    }
  }

  data.monthlyAccountConfigs = configs;
  saveData(data);
}

// ========== 数据健康检查与去重工具 ==========

function buildRecordKey(r: MonthlyRecord): string {
  return `${r.accountId}-${r.year}-${r.month}`;
}

export function validateData(): { isHealthy: boolean; duplicates: string[]; recordCount: number } {
  const data = loadData();
  const seen = new Map<string, boolean>();
  const duplicates: string[] = [];

  data.records.forEach(r => {
    const key = buildRecordKey(r);
    if (seen.has(key)) {
      duplicates.push(key);
    }
    seen.set(key, true);
  });

  return {
    isHealthy: duplicates.length === 0,
    duplicates,
    recordCount: data.records.length,
  };
}

export function dedupeRecords(): number {
  const data = loadData();
  const recordMap = new Map<string, MonthlyRecord>();
  let removedCount = 0;

  data.records.forEach(r => {
    const key = buildRecordKey(r);
    if (recordMap.has(key)) {
      removedCount++;
    }
    recordMap.set(key, r);
  });

  data.records = Array.from(recordMap.values());
  saveData(data);

  return removedCount;
}

export interface FullBackup {
  version: string;
  exportedAt: string;
  accounts: Account[];
  records: MonthlyRecord[];
  attributions: MonthlyAttribution[];
  yearlyAttributions: YearlyAttribution[];
  settings: AppSettings;
}

export function exportFullBackupJSON(): string {
  const data = loadData();
  const backup: FullBackup = {
    version: CURRENT_VERSION,
    exportedAt: new Date().toISOString(),
    accounts: data.accounts,
    records: data.records,
    attributions: data.attributions,
    yearlyAttributions: data.yearlyAttributions,
    settings: data.settings,
  };
  return JSON.stringify(backup, null, 2);
}

export function importFullBackupJSON(
  jsonContent: string,
  mergeMode: 'overwrite' | 'merge' = 'overwrite'
): { success: boolean; message: string; importedAccounts: number; importedRecords: number } {
  try {
    const backup = JSON.parse(jsonContent) as FullBackup;
    
    if (!backup.accounts || !backup.records) {
      return { success: false, message: '备份文件格式无效', importedAccounts: 0, importedRecords: 0 };
    }

    const data = loadData();

    if (mergeMode === 'overwrite') {
      data.accounts = backup.accounts;
      data.records = backup.records;
      data.attributions = backup.attributions || [];
      data.yearlyAttributions = backup.yearlyAttributions || [];
      if (backup.settings) {
        data.settings = backup.settings;
      }
    } else {
      const existingAccountNames = new Set(data.accounts.map(a => a.name));
      for (const account of backup.accounts) {
        if (!existingAccountNames.has(account.name)) {
          data.accounts.push(account);
        }
      }

      const existingRecordKeys = new Set(
        data.records.map(r => `${r.accountId}-${r.year}-${r.month}`)
      );
      for (const record of backup.records) {
        const key = `${record.accountId}-${record.year}-${record.month}`;
        if (!existingRecordKeys.has(key)) {
          data.records.push(record);
        }
      }

      const existingAttrKeys = new Set(
        data.attributions.map(a => `${a.year}-${a.month}`)
      );
      for (const attr of backup.attributions || []) {
        const key = `${attr.year}-${attr.month}`;
        if (!existingAttrKeys.has(key)) {
          data.attributions.push(attr);
        }
      }

      const existingYearlyKeys = new Set(
        data.yearlyAttributions.map(a => a.year)
      );
      for (const attr of backup.yearlyAttributions || []) {
        if (!existingYearlyKeys.has(attr.year)) {
          data.yearlyAttributions.push(attr);
        }
      }
    }

    saveData(data);

    return {
      success: true,
      message: `成功导入 ${backup.accounts.length} 个账户和 ${backup.records.length} 条记录`,
      importedAccounts: backup.accounts.length,
      importedRecords: backup.records.length,
    };
  } catch (error) {
    console.error('Failed to import full backup:', error);
    return { success: false, message: '导入失败：文件格式错误', importedAccounts: 0, importedRecords: 0 };
  }
}