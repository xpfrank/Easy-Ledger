import type { Account, MonthlyRecord, AppState, AppSettings, RecordLog, MonthlyAttribution, AttributionTag, FluctuationLevel, YearlyAttribution, YearlyAttributionTag, AccountSnapshot } from '@/types';

const STORAGE_KEY = 'simple-ledger-data';
const EXPANDED_GROUPS_KEY = 'simple-ledger-expanded-groups';
const RECORD_LOGS_EXPANDED_KEY = 'simple-ledger-record-logs-expanded';
const CURRENT_VERSION = '1.3';

const defaultState: AppState = {
  accounts: [],
  records: [],
  logs: [],
  attributions: [],
  yearlyAttributions: [],
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

  return JSON.stringify({
    accounts: data.accounts,
    records: filteredRecords,
    logs: filteredLogs,
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
      saveData({
        accounts: data.accounts,
        records: data.records,
        logs: data.logs || [],
        attributions: [],
        yearlyAttributions: [],
        settings: { ...defaultState.settings, ...data.settings },
        version: CURRENT_VERSION,
      });
      return true;
    }

    if (mergeMode === 'overwrite') {
      currentData.records = currentData.records.filter(r => 
        !(r.year === targetYear && r.month === targetMonth)
      );
      currentData.logs = currentData.logs.filter(l => 
        !(l.year === targetYear && l.month === targetMonth)
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

    currentData.records.push(...importedRecords);
    currentData.logs.push(...importedLogs);

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
  return data.accounts;
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
    
    if (account.type === 'credit' || account.type === 'debt') {
      totalLiabilities += Math.abs(record.balance);
    }
  }
  
  return totalLiabilities;
}

export interface ExcelImportRow {
  month: string;
  accountName: string;
  balance: number;
  attributionTag?: string;
  note?: string;
}

export function hasGarbledText(text: string): boolean {
  const cleanText = text.replace(/^\uFEFF/, '');
  return cleanText.includes('\uFFFD');
}

export function parseExcelCSV(content: string): ExcelImportRow[] {
  const cleanContent = content.replace(/^\uFEFF/, '').trim();
  const lines = cleanContent.split('\n');
  const result: ExcelImportRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;

    let parts: string[];
    if (line.includes('\t')) {
      parts = line.split('\t');
    } else if (line.includes(',')) {
      parts = line.split(',');
    } else if (line.includes(';')) {
      parts = line.split(';');
    } else {
      continue;
    }

    if (parts.length < 3) continue;

    const monthRaw = parts[0].trim().replace(/"/g, '').replace(/^#.*/, '');
    const accountName = parts[1].trim().replace(/"/g, '');
    const balanceStr = parts[2].trim().replace(/"/g, '').replace(/[¥￥]/g, '').replace(/,/g, '').replace(/\s+/g, '');
    const balance = parseFloat(balanceStr);
    const attributionTag = parts[3]?.trim().replace(/"/g, '') || undefined;
    const note = parts[4]?.trim().replace(/"/g, '') || undefined;

    if (!monthRaw || !accountName) continue;

    const normalizedMonth = normalizeMonthFormat(monthRaw);
    if (!normalizedMonth || isNaN(balance)) continue;

    result.push({ month: normalizedMonth, accountName, balance, attributionTag, note });
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

export function batchImportFromExcel(rows: ExcelImportRow[], mergeMode: 'overwrite' | 'merge' = 'merge'): { success: boolean; message: string; importedCount: number; unmatchedAccounts?: string[]; createdAccounts?: string[] } {
  if (rows.length === 0) {
    return { success: false, message: 'CSV 数据为空，请检查文件内容', importedCount: 0 };
  }

  try {
    const data = loadData();
    let importedCount = 0;
    const unmatchedAccounts: string[] = [];
    const attributionData: { year: number; month: number; change: number; tags: string[]; note?: string }[] = [];
    const createdAccounts: string[] = [];

    // 第一遍：收集并自动创建不存在的账户
    const accountSet = new Set(data.accounts.map(a => normalizeAccountName(a.name)));
    for (const row of rows) {
      const normalizedRowName = normalizeAccountName(row.accountName);
      if (!accountSet.has(normalizedRowName)) {
        // 检查是否已添加过
        const alreadyAdded = data.accounts.some(a => normalizeAccountName(a.name) === normalizedRowName);
        if (!alreadyAdded) {
          // 自动创建账户（默认类型：储蓄卡）
          const newAccount: Account = {
            id: generateId(),
            name: row.accountName,
            type: 'debit',
            icon: 'credit-card',
            balance: 0,
            includeInTotal: true,
            isHidden: false,
          };
          data.accounts.push(newAccount);
          createdAccounts.push(row.accountName);
          accountSet.add(normalizedRowName);
        }
      }
    }

    // 第二遍：导入资产数据
    for (const row of rows) {
      const [yearStr, monthStr] = row.month.split('-');
      const year = parseInt(yearStr);
      const month = parseInt(monthStr);

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
          year,
          month,
          change: row.balance - existingRecord.balance,
          tags: row.attributionTag ? [row.attributionTag] : [],
          note: row.note
        });
        existingRecord.balance = row.balance;
      } else {
        attributionData.push({
          year,
          month,
          change: row.balance,
          tags: row.attributionTag ? [row.attributionTag] : [],
          note: row.note
        });
        data.records.push({
          id: generateId(),
          accountId: targetAccount.id,
          year,
          month,
          balance: row.balance,
        });
      }

      importedCount++;
    }

    // 处理归因数据导入
    if (attributionData.length > 0) {
      const uniqueMonths = new Map<string, { year: number; month: number; tags: string[]; note?: string }>();
      
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
              existingAttr.tags = attr.tags as any;
              existingAttr.note = attr.note;
            } else {
              existingAttr.tags = [...new Set([...existingAttr.tags, ...attr.tags])] as any;
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
              tags: attr.tags as any,
              note: attr.note,
              timestamp: Date.now(),
            });
          }
        }
      }
    }

    saveData(data);

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
  const header = '月份(YYYY-MM),账户名称,余额,归因标签(可选),备注(可选)';

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
      const monthStr = `${year}-${month.toString().padStart(2, '0')}`;
      
      for (const account of data.accounts) {
        const record = data.records.find(r => 
          r.accountId === account.id && r.year === year && r.month === month
        );
        
        if (record) {
          const attribution = data.attributions.find(a => 
            a.year === year && a.month === month
          );
          const tag = attribution?.tags?.[0] || '';
          const note = attribution?.note || '';
          rows.push(`${monthStr},${account.name},${record.balance.toFixed(2)},${tag},${note}`);
        }
      }
    }
  }

  return BOM + rows.join('\n');
}

export function batchImportByRange(
  rows: ExcelImportRow[],
  startYear: number,
  startMonth: number,
  endYear: number,
  endMonth: number,
  mergeMode: 'overwrite' | 'merge' = 'merge'
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
  const tagLabels: Record<AttributionTag, string> = {
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
    abnormal_other: '其他',
  };
  return tagLabels[tag] || tag;
}

export function getAttributionTagEmoji(tag: AttributionTag): string {
  const tagEmojis: Record<AttributionTag, string> = {
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
  return tagEmojis[tag] || '📝';
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

  // 1. 先查找指定月份的记录
  const record = data.records.find(
    r => r.accountId === accountId && r.year === year && r.month === month
  );
  if (record) {
    return record.balance;
  }

  // 2. 如果没有，向前查找最近月份的记录（继承机制）
  const previousRecords = data.records
    .filter(r => r.accountId === accountId)
    .filter(r => {
      if (r.year < year) return true;
      if (r.year === year && r.month < month) return true;
      return false;
    })
    .sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });

  if (previousRecords.length > 0) {
    return previousRecords[0].balance;
  }

  // 3. 如果没有历史记录，返回账户默认余额
  const account = data.accounts.find(a => a.id === accountId);
  return account?.balance || 0;
}