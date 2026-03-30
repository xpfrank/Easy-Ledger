import type { Account, MonthlyRecord, AppState, AppSettings, RecordLog, MonthlyAttribution, AttributionTag, FluctuationLevel, YearlyAttribution, YearlyAttributionTag, AccountSnapshot } from '@/types';

const STORAGE_KEY = 'simple-ledger-data';
const EXPANDED_GROUPS_KEY = 'simple-ledger-expanded-groups';
const RECORD_LOGS_EXPANDED_KEY = 'simple-ledger-record-logs-expanded';
const CURRENT_VERSION = '1.2';

// 默认数据
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
        attributions: [],
        yearlyAttributions: [],
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

// 检测文本是否包含乱码特征
export function hasGarbledText(text: string): boolean {
  // 检测替换字符（通常是编码问题的标志）
  if (text.includes('\uFFFD')) return true;
  // 检测大量不可见字符或异常字符比例
  const garbledPatterns = ['', '�'];
  for (const pattern of garbledPatterns) {
    if (text.includes(pattern)) return true;
  }
  return false;
}

// 解析 Excel CSV 内容
export function parseExcelCSV(content: string): ExcelImportRow[] {
  const lines = content.trim().split('\n');
  const result: ExcelImportRow[] = [];

  // 跳过标题行，从第2行开始
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue; // 跳过空行和注释行

    // 支持逗号、分号、制表符分隔（同时处理中英文标点）
    let parts: string[];
    if (line.includes('\t')) {
      parts = line.split('\t');
    } else if (line.includes(',')) {
      parts = line.split(',');
    } else if (line.includes(';')) {
      parts = line.split(';');
    } else {
      continue; // 无法识别的分隔符
    }

    if (parts.length < 3) continue;

    const monthRaw = parts[0].trim().replace(/"/g, '').replace(/^#.*/, ''); // 去除引号和注释
    const accountName = parts[1].trim().replace(/"/g, '');
    const balanceStr = parts[2].trim().replace(/"/g, '').replace(/[¥￥]/g, '').replace(/,/g, '').replace(/\s+/g, '');
    const balance = parseFloat(balanceStr);

    // 跳过无效行
    if (!monthRaw || !accountName) continue;

    // 转换日期格式为 YYYY-MM
    const normalizedMonth = normalizeMonthFormat(monthRaw);
    if (!normalizedMonth || isNaN(balance)) continue;

    result.push({ month: normalizedMonth, accountName, balance });
  }

  return result;
}

// 账户名称标准化（用于模糊匹配）
function normalizeAccountName(name: string): string {
  return name
    .trim()                           // 去除首尾空格
    .replace(/[\s\uFEFF\u200B]+/g, '') // 去除各种空白字符（包括 BOM 和零宽空格）
    .toLowerCase();                    // 统一小写
}

// 规范化月份格式，支持多种输入格式
// 支持格式: "YYYY-MM", "YYYY/MM", "MMM-YY" (如 Jan-24), "MMM/YY" (如 Jan/24), "YY-MMM" (如 25-Oct), "YY MMM" (如 25 Oct)
function normalizeMonthFormat(monthStr: string): string | null {
  // 月份映射表
  const monthMap: Record<string, string> = {
    'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
    'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
    'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
  };

  // 已经是 YYYY-MM 格式
  if (/^\d{4}-\d{2}$/.test(monthStr)) {
    return monthStr;
  }

  // YYYY/MM 格式
  if (/^\d{4}\/\d{2}$/.test(monthStr)) {
    return monthStr.replace('/', '-');
  }

  // 按分隔符分割 (支持 - / 空格分隔)
  const parts = monthStr.split(/[-\/ ]+/).filter(p => p.length > 0);
  if (parts.length === 2) {
    const [first, second] = parts;

    // 判断谁是月份，谁是年份
    const firstIsMonth = monthMap[first.toLowerCase()] !== undefined;
    const secondIsMonth = monthMap[second.toLowerCase()] !== undefined;
    const firstIsYear = /^\d{2,4}$/.test(first);
    const secondIsYear = /^\d{2,4}$/.test(second);

    if (firstIsMonth && secondIsYear) {
      // MMM-YY 格式 (如 Jan-24, Oct-25)
      let year = parseInt(second);
      if (second.length === 2) {
        year = year < 70 ? year + 2000 : year + 1900;
      }
      return `${year}-${monthMap[first.toLowerCase()]}`;
    }

    if (secondIsMonth && firstIsYear) {
      // YY-MMM 格式 (如 25-Oct, 24-Jan)
      let year = parseInt(first);
      if (first.length === 2) {
        year = year < 70 ? year + 2000 : year + 1900;
      }
      return `${year}-${monthMap[second.toLowerCase()]}`;
    }
  }

  return null;
}

// 批量导入月度数据（Excel 模式）
// 规则：指定账户设为 Excel 中的余额，其余所有账户余额设为 0
export function batchImportFromExcel(rows: ExcelImportRow[], mergeMode: 'overwrite' | 'merge' = 'merge'): { success: boolean; message: string; importedCount: number; unmatchedAccounts?: string[] } {
  if (rows.length === 0) {
    return { success: false, message: 'CSV 数据为空，请检查文件内容', importedCount: 0 };
  }

  try {
    const data = loadData();
    let importedCount = 0;
    const unmatchedAccounts: string[] = [];

    for (const row of rows) {
      // 解析月份
      const [yearStr, monthStr] = row.month.split('-');
      const year = parseInt(yearStr);
      const month = parseInt(monthStr);

      // 标准化后的账户名称用于匹配
      const normalizedRowName = normalizeAccountName(row.accountName);

      // 模糊查找目标账户：先精确匹配，再模糊匹配
      let targetAccount = data.accounts.find(a => a.name === row.accountName);
      if (!targetAccount) {
        // 尝试模糊匹配（去除空格和大小写后匹配）
        targetAccount = data.accounts.find(a => normalizeAccountName(a.name) === normalizedRowName);
      }

      if (!targetAccount) {
        // 收集未匹配的账户名称
        if (!unmatchedAccounts.includes(row.accountName)) {
          unmatchedAccounts.push(row.accountName);
        }
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

    // 构建返回消息
    if (unmatchedAccounts.length > 0) {
      const accountList = unmatchedAccounts.slice(0, 5).map(name => `「${name}」`).join('、');
      const moreText = unmatchedAccounts.length > 5 ? `等${unmatchedAccounts.length}个` : '';
      const hintText = '\n\n💡 提示：如账户名称匹配失败，请检查 CSV 文件是否使用 UTF-8 编码';
      return {
        success: true,
        message: `成功导入 ${importedCount} 个月的数据\n\n⚠️ 未找到以下账户：${accountList}${moreText}${hintText}`,
        importedCount,
        unmatchedAccounts
      };
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
  // UTF-8 BOM 头，让 Excel 正确识别中文编码
  const BOM = '\uFEFF';
  const header = '月份(YYYY-MM),目标存款账户名称,当月存款余额';
  const note = '# 支持格式: YYYY-MM (2024-01) 或 MMM-YY (Jan-24)，请保存为 UTF-8 编码';

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

  return BOM + [header, note, ...examples].join('\n');
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

// ==================== 归因记录功能 ====================

// 计算波动等级
export function calculateFluctuationLevel(changePercent: number): FluctuationLevel {
  const absPercent = Math.abs(changePercent);
  if (absPercent > 30) {
    return 'abnormal';
  } else if (absPercent > 10) {
    return 'warning';
  }
  return 'normal';
}

// 获取月度归因记录
export function getMonthlyAttribution(year: number, month: number): MonthlyAttribution | null {
  const data = loadData();
  return data.attributions.find(a => a.year === year && a.month === month) || null;
}

// 保存月度归因记录
export function saveMonthlyAttribution(
  year: number,
  month: number,
  change: number,
  changePercent: number,
  tags: AttributionTag[],
  note?: string
): void {
  const data = loadData();

  // 查找是否已有该月归因记录
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

// 获取所有归因记录
export function getAllAttributions(): MonthlyAttribution[] {
  const data = loadData();
  return data.attributions.sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });
}

// 删除归因记录
export function deleteMonthlyAttribution(year: number, month: number): void {
  const data = loadData();
  data.attributions = data.attributions.filter(a => !(a.year === year && a.month === month));
  saveData(data);
}

// 获取归因标签的中文显示
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

// 获取归因标签的 emoji
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

// ==================== 年度归因记录功能 ====================

// 获取年度归因记录
export function getYearlyAttribution(year: number): YearlyAttribution | null {
  const data = loadData();
  return data.yearlyAttributions.find(a => a.year === year) || null;
}

// 保存年度归因记录
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

  // 查找是否已有该年归因记录
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

// 获取所有年度归因记录
export function getAllYearlyAttributions(): YearlyAttribution[] {
  const data = loadData();
  return data.yearlyAttributions.sort((a, b) => b.year - a.year);
}

// 删除年度归因记录
export function deleteYearlyAttribution(year: number): void {
  const data = loadData();
  data.yearlyAttributions = data.yearlyAttributions.filter(a => a.year !== year);
  saveData(data);
}

// 根据年份获取该年所有月度归因
export function getMonthlyAttributionsByYear(year: number): MonthlyAttribution[] {
  const data = loadData();
  return data.attributions
    .filter(a => a.year === year)
    .sort((a, b) => a.month - b.month);
}

// 获取指定月份所有账户的余额快照
export function getAccountSnapshotsByMonth(year: number, month: number): AccountSnapshot[] {
  const data = loadData();
  const records = data.records.filter(r => r.year === year && r.month === month);

  return records.map(record => {
    const account = data.accounts.find(a => a.id === record.accountId);
    if (!account) return null;

    // 计算该账户在该月的变化
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

    return {
      accountId: account.id,
      accountName: account.name,
      accountIcon: account.icon,
      accountType: account.type,
      balance: record.balance,
      change: record.balance - lastBalance,
    };
  }).filter((s): s is AccountSnapshot => s !== null);
}