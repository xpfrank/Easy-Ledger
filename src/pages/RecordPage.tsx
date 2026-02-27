import { useState, useEffect } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Copy, RotateCcw, History, ChevronDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Icon } from '@/components/Icon';
import type { Account, PageRoute, RecordMode, ThemeType } from '@/types';
import { 
  getAllAccounts, 
  getMonthlyRecord, 
  setMonthlyRecord,
  formatAmountNoSymbol,
  formatMonth,
  getSettings,
} from '@/lib/storage';
import { 
  calculateNetWorth, 
  calculateTotalAssets,
  calculateTotalLiabilities,
  getAccountTypeLabel,
  getYearlyNetWorth,
  getLastRecordedMonth,
} from '@/lib/calculator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { THEMES } from '@/types';

interface RecordPageProps {
  onPageChange: (page: PageRoute, params?: any) => void;
}

// 隐藏金额显示
function formatHiddenAmount(amount: number, hide: boolean): string {
  if (hide) {
    return '******';
  }
  return formatAmountNoSymbol(amount);
}

// 日历式月份选择器组件（参考图6）
function MonthPicker({
  year,
  month,
  onSelect,
  onClose,
  theme,
}: {
  year: number;
  month: number;
  onSelect: (y: number, m: number) => void;
  onClose: () => void;
  theme: ThemeType;
}) {
  // 使用系统当前日期作为默认选中
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  // 如果传入的 year/month 是当前年月，则使用当前日期，否则使用传入的值
  const defaultYear = year || currentYear;
  const defaultMonth = month || currentMonth;
  
  const [viewYear, setViewYear] = useState(defaultYear);
  const [viewMonth, setViewMonth] = useState(defaultMonth);
  const [showYearSelector, setShowYearSelector] = useState(false);
  const themeConfig = THEMES[theme];

  // 获取当前月份的天数
  const getDaysInMonth = (y: number, m: number) => {
    return new Date(y, m, 0).getDate();
  };

  // 获取月份第一天是星期几
  const getFirstDayOfMonth = (y: number, m: number) => {
    return new Date(y, m - 1, 1).getDay();
  };

  // 生成年份列表（1990年～2100年）
  const yearRange = Array.from({ length: 211 }, (_, i) => 1990 + i);

  // 生成日历数据
  const generateCalendar = () => {
    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
    const days = [];

    // 填充空白（上个月）
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    // 填充当月日期
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    return days;
  };

  const calendarDays = generateCalendar();
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  // 切换到上个月
  const prevMonth = () => {
    if (viewMonth === 1) {
      setViewYear(viewYear - 1);
      setViewMonth(12);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  // 切换到下个月
  const nextMonth = () => {
    if (viewMonth === 12) {
      setViewYear(viewYear + 1);
      setViewMonth(1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  // 选择日期（这里选择月份，所以点击任意日期都选中该月）
  const selectDate = (day: number | null) => {
    if (day !== null) {
      onSelect(viewYear, viewMonth);
      onClose();
    }
  };

  if (showYearSelector) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setShowYearSelector(false)} className="text-gray-500">
            <ChevronLeft size={20} />
          </button>
          <span className="font-medium">选择年份</span>
          <div className="w-5" />
        </div>
        <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
          {yearRange.map((y) => (
            <button
              key={y}
              onClick={() => {
                setViewYear(y);
                setShowYearSelector(false);
              }}
              className={`p-3 rounded-lg text-sm transition-colors ${
                viewYear === y
                  ? 'text-white'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
              style={{ backgroundColor: viewYear === y ? themeConfig.primary : undefined }}
              title={`${y}年`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* 年月选择器 */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-1 rounded-full hover:bg-gray-100">
          <ChevronLeft size={20} className="text-gray-500" />
        </button>
        <button 
          onClick={() => setShowYearSelector(true)}
          className="flex items-center gap-1 font-medium text-lg"
        >
          {viewYear}年{viewMonth}月
          <ChevronDown size={16} className="text-gray-400" />
        </button>
        <button onClick={nextMonth} className="p-1 rounded-full hover:bg-gray-100">
          <ChevronRight size={20} className="text-gray-500" />
        </button>
      </div>

      {/* 星期标题 */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map((day) => (
          <div key={day} className="text-center text-sm text-gray-400 py-2">
            {day}
          </div>
        ))}
      </div>

      {/* 日期网格 */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, index) => (
          <button
            key={index}
            onClick={() => selectDate(day)}
            disabled={day === null}
            className={`
              aspect-square flex items-center justify-center rounded-full text-sm transition-colors
              ${day === null ? 'invisible' : ''}
              ${day !== null && viewYear === year && viewMonth === month
                ? 'text-white' 
                : 'hover:bg-gray-100'
              }
            `}
            style={{ 
              backgroundColor: day !== null && viewYear === year && viewMonth === month 
                ? themeConfig.primary 
                : undefined 
            }}
          >
            {day}
          </button>
        ))}
      </div>

      {/* 底部按钮 */}
      <div className="flex justify-end gap-4 mt-4 pt-4 border-t border-gray-100">
        <button 
          onClick={onClose}
          className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
        >
          取消
        </button>
        <button 
          onClick={() => {
            onSelect(viewYear, viewMonth);
            onClose();
          }}
          className="px-4 py-2 text-sm text-white rounded-lg transition-colors"
          style={{ backgroundColor: themeConfig.primary }}
        >
          确定
        </button>
      </div>
    </div>
  );
}

export function RecordPage({ onPageChange }: RecordPageProps) {
  const now = new Date();
  const [recordMode, setRecordMode] = useState<RecordMode>('monthly');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [netWorth, setNetWorth] = useState(0);
  const [totalAssets, setTotalAssets] = useState(0);
  const [totalLiabilities, setTotalLiabilities] = useState(0);
  const [hideBalance, setHideBalance] = useState(false);
  const [theme, setTheme] = useState<ThemeType>('blue');
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const [editingAccount, setEditingAccount] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const themeConfig = THEMES[theme];

  useEffect(() => {
    const settings = getSettings();
    setHideBalance(settings.hideBalance);
    setTheme(settings.theme || 'blue');
    loadData();
  }, [year, month, recordMode]);

  const loadData = () => {
    const allAccounts = getAllAccounts().filter(a => !a.isHidden);
    setAccounts(allAccounts);

    if (recordMode === 'monthly') {
      const newBalances: Record<string, number> = {};
      for (const account of allAccounts) {
        const record = getMonthlyRecord(account.id, year, month);
        newBalances[account.id] = record ? record.balance : account.balance;
      }
      setBalances(newBalances);

      setNetWorth(calculateNetWorth(year, month));
      setTotalAssets(calculateTotalAssets(year, month));
      setTotalLiabilities(calculateTotalLiabilities(year, month));
    } else {
      const lastMonth = getLastRecordedMonth(year) || 12;
      const newBalances: Record<string, number> = {};
      for (const account of allAccounts) {
        const record = getMonthlyRecord(account.id, year, lastMonth);
        newBalances[account.id] = record ? record.balance : account.balance;
      }
      setBalances(newBalances);

      const yearlyData = getYearlyNetWorth(year);
      setNetWorth(yearlyData.netWorth);
      setTotalAssets(yearlyData.totalAssets);
      setTotalLiabilities(yearlyData.totalLiabilities);
    }
  };

  const goToPrev = () => {
    if (recordMode === 'monthly') {
      if (month === 1) {
        setYear(y => y - 1);
        setMonth(12);
      } else {
        setMonth(m => m - 1);
      }
    } else {
      setYear(y => y - 1);
    }
  };

  const goToNext = () => {
    if (recordMode === 'monthly') {
      if (month === 12) {
        setYear(y => y + 1);
        setMonth(1);
      } else {
        setMonth(m => m + 1);
      }
    } else {
      setYear(y => y + 1);
    }
  };

  const handleSelectMonth = (selectedYear: number, selectedMonth: number) => {
    setYear(selectedYear);
    setMonth(selectedMonth);
  };

  const handleBalanceChange = (accountId: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setBalances(prev => ({ ...prev, [accountId]: numValue }));
    setMonthlyRecord(accountId, year, month, numValue);
    
    setTimeout(() => {
      setNetWorth(calculateNetWorth(year, month));
      setTotalAssets(calculateTotalAssets(year, month));
      setTotalLiabilities(calculateTotalLiabilities(year, month));
    }, 0);
  };

  const handleCopyLastMonth = () => {
    let lastYear = year;
    let lastMonth = month - 1;
    if (lastMonth === 0) {
      lastYear--;
      lastMonth = 12;
    }

    const newBalances: Record<string, number> = { ...balances };
    for (const account of accounts) {
      const lastRecord = getMonthlyRecord(account.id, lastYear, lastMonth);
      if (lastRecord) {
        newBalances[account.id] = lastRecord.balance;
        setMonthlyRecord(account.id, year, month, lastRecord.balance);
      }
    }
    setBalances(newBalances);
    setNetWorth(calculateNetWorth(year, month));
    setTotalAssets(calculateTotalAssets(year, month));
    setTotalLiabilities(calculateTotalLiabilities(year, month));
    setShowCopyDialog(false);
  };

  const handleClear = () => {
    const newBalances: Record<string, number> = {};
    for (const account of accounts) {
      newBalances[account.id] = 0;
      setMonthlyRecord(account.id, year, month, 0);
    }
    setBalances(newBalances);
    setNetWorth(calculateNetWorth(year, month));
    setTotalAssets(calculateTotalAssets(year, month));
    setTotalLiabilities(calculateTotalLiabilities(year, month));
    setShowClearDialog(false);
  };

  const startEdit = (account: Account) => {
    setEditingAccount(account.id);
    setEditValue(balances[account.id]?.toString() || '0');
  };

  const saveEdit = () => {
    if (editingAccount) {
      handleBalanceChange(editingAccount, editValue);
      setEditingAccount(null);
    }
  };

  const cancelEdit = () => {
    setEditingAccount(null);
    setEditValue('');
  };

  let lastNetWorth = 0;
  if (recordMode === 'monthly') {
    let lastYear = year;
    let lastMonthNum = month - 1;
    if (lastMonthNum === 0) {
      lastYear--;
      lastMonthNum = 12;
    }
    lastNetWorth = calculateNetWorth(lastYear, lastMonthNum);
  } else {
    lastNetWorth = calculateNetWorth(year - 1, 12);
  }
  const change = netWorth - lastNetWorth;
  const changePercent = lastNetWorth !== 0 ? (change / Math.abs(lastNetWorth)) * 100 : 0;

  return (
    <div className="pb-24 bg-gray-50 min-h-screen">
      {/* 标题栏 */}
      <header className="bg-white px-4 py-3 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => onPageChange('home')}>
            <ArrowLeft size={20} />
          </Button>
          
          {/* 模式切换下拉 */}
          <div className="relative">
            <button 
              className="flex items-center gap-1 text-lg font-semibold"
              onClick={() => setShowModeDropdown(!showModeDropdown)}
            >
              {recordMode === 'monthly' ? '月度记账' : '年度记账'}
              <ChevronDown size={18} />
            </button>
            
            {showModeDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50 min-w-[120px]">
                <button
                  className={`w-full px-4 py-2 text-left text-sm ${recordMode === 'monthly' ? 'text-white' : 'hover:bg-gray-50'}`}
                  style={{ backgroundColor: recordMode === 'monthly' ? themeConfig.primary : undefined }}
                  onClick={() => {
                    setRecordMode('monthly');
                    setShowModeDropdown(false);
                  }}
                >
                  月度记账
                </button>
                <button
                  className={`w-full px-4 py-2 text-left text-sm ${recordMode === 'yearly' ? 'text-white' : 'hover:bg-gray-50'}`}
                  style={{ backgroundColor: recordMode === 'yearly' ? themeConfig.primary : undefined }}
                  onClick={() => {
                    setRecordMode('yearly');
                    setShowModeDropdown(false);
                  }}
                >
                  年度记账
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* 记账记录按钮 */}
        <Button 
          variant="ghost" 
          size="sm" 
          style={{ color: themeConfig.primary }}
          onClick={() => onPageChange('record-logs', { year, month, mode: recordMode })}
        >
          <History size={18} className="mr-1" />
          记账记录
        </Button>
      </header>

      <div className="p-4 space-y-4">
        {/* 月份/年份选择器 */}
        <Card className="bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={goToPrev}>
                <ChevronLeft size={24} />
              </Button>
              
              {/* 可点击的日期显示 */}
              {recordMode === 'monthly' ? (
                <button 
                  className="text-center"
                  onClick={() => setShowMonthPicker(true)}
                >
                  <div className="text-lg font-semibold">{formatMonth(year, month)}</div>
                  <div className="text-xs text-gray-400">点击选择月份</div>
                </button>
              ) : (
                <div className="text-center">
                  <div className="text-lg font-semibold">{year}年</div>
                  <div className="text-xs text-gray-400">年度汇总</div>
                </div>
              )}
              
              <Button variant="ghost" size="icon" onClick={goToNext}>
                <ChevronRight size={24} />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 净资产汇总 */}
        <Card 
          className="text-white"
          style={{ background: `linear-gradient(135deg, ${themeConfig.gradientFrom} 0%, ${themeConfig.gradientTo} 100%)` }}
        >
          <CardContent className="p-4">
            <div className="text-white/70 text-sm mb-1">
              {recordMode === 'monthly' ? '本月净资产' : '年度净资产'}
            </div>
            <div className="text-2xl font-bold mb-1">¥{formatHiddenAmount(netWorth, hideBalance)}</div>
            <div className="flex items-center text-sm">
              <span className="text-white/70">较{recordMode === 'monthly' ? '上月' : '上年'}</span>
              <span className={`ml-2 font-medium ${change >= 0 ? 'text-white' : 'text-red-200'}`}>
                {change >= 0 ? '+' : ''}{formatAmountNoSymbol(change)}
              </span>
              <span className={`ml-1 text-xs ${change >= 0 ? 'text-white' : 'text-red-200'}`}>
                ({change >= 0 ? '+' : ''}{changePercent.toFixed(1)}%)
              </span>
            </div>
            
            {/* 总资产、负资产 */}
            <div className="mt-3 pt-3 border-t border-white/20 grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-white/70">总资产</div>
                <div className="font-medium">¥{formatHiddenAmount(totalAssets, hideBalance)}</div>
              </div>
              <div>
                <div className="text-xs text-white/70">负资产</div>
                <div className="font-medium">¥{formatHiddenAmount(totalLiabilities, hideBalance)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 快捷操作（仅月度模式） */}
        {recordMode === 'monthly' && (
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex-1 h-10"
              onClick={() => setShowCopyDialog(true)}
            >
              <Copy size={16} className="mr-1" />
              复制上月
            </Button>
            <Button 
              variant="outline" 
              className="flex-1 h-10"
              onClick={() => setShowClearDialog(true)}
            >
              <RotateCcw size={16} className="mr-1" />
              清空
            </Button>
          </div>
        )}

        {/* 账户余额列表 */}
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-gray-500 px-1">
            {recordMode === 'monthly' ? '账户余额' : '年度账户余额'}
          </h2>
          
          {accounts.length === 0 ? (
            <Card className="bg-white">
              <CardContent className="p-8 text-center">
                <p className="text-gray-500">还没有账户</p>
                <Button 
                  className="mt-4 text-white"
                  style={{ backgroundColor: themeConfig.primary }}
                  onClick={() => onPageChange('account-edit')}
                >
                  添加账户
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-white overflow-hidden">
              <div className="divide-y divide-gray-100">
                {accounts.map((account) => {
                  const isCredit = account.type === 'credit';
                  const isDebt = account.type === 'debt';
                  const balance = balances[account.id] || 0;
                  const isEditing = editingAccount === account.id;

                  return (
                    <div key={account.id} className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div 
                            className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                              isCredit || isDebt ? 'bg-red-50' : ''
                            }`}
                            style={{ backgroundColor: isCredit || isDebt ? undefined : `${themeConfig.primary}15` }}
                          >
                            <Icon 
                              name={account.icon} 
                              size={18} 
                              className={isCredit || isDebt ? 'text-red-500' : ''}
                              color={isCredit || isDebt ? undefined : themeConfig.primary}
                            />
                          </div>
                          <div>
                            <div className="font-medium text-sm">{account.name}</div>
                            <div className="text-xs text-gray-400">
                              {getAccountTypeLabel(account.type)}
                              {isCredit && (
                                <span className={balance > 0 ? 'text-red-500' : 'text-green-600'}>
                                  {balance > 0 ? ' · 欠款' : ' · 溢缴款'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">¥</span>
                              <Input
                                type="number"
                                step="0.01"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="w-28 h-9 pl-5 text-sm"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveEdit();
                                  if (e.key === 'Escape') cancelEdit();
                                }}
                              />
                            </div>
                            <Button 
                              size="sm" 
                              className="h-8 px-2 text-white"
                              style={{ backgroundColor: themeConfig.primary }}
                              onClick={saveEdit}
                            >
                              保存
                            </Button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(account)}
                            className={`text-right px-3 py-1 rounded-lg hover:bg-gray-100 ${
                              isCredit ? (balance > 0 ? 'text-red-500' : 'text-green-600') : 
                              isDebt ? 'text-red-500' : ''
                            }`}
                          >
                            <div className="text-sm font-medium">
                              {isCredit && balance > 0 ? '欠' : ''}
                              ¥{formatHiddenAmount(isDebt ? Math.abs(balance) : balance, hideBalance)}
                            </div>
                            <div className="text-xs text-gray-400">点击编辑</div>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* 月份选择器弹窗 */}
      <Dialog open={showMonthPicker} onOpenChange={setShowMonthPicker}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>选择月份</DialogTitle>
          </DialogHeader>
          <MonthPicker
            year={year}
            month={month}
            onSelect={handleSelectMonth}
            onClose={() => setShowMonthPicker(false)}
            theme={theme}
          />
        </DialogContent>
      </Dialog>

      {/* 复制确认对话框 */}
      <Dialog open={showCopyDialog} onOpenChange={setShowCopyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>复制上月余额</DialogTitle>
            <DialogDescription>
              确定要将上月的余额数据复制到本月吗？这将覆盖本月已有的余额数据。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCopyDialog(false)}>
              取消
            </Button>
            <Button 
              className="text-white"
              style={{ backgroundColor: themeConfig.primary }}
              onClick={handleCopyLastMonth}
            >
              确认复制
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 清空确认对话框 */}
      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>清空本月数据</DialogTitle>
            <DialogDescription>
              确定要清空本月所有账户的余额数据吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClearDialog(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleClear}>
              确认清空
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
