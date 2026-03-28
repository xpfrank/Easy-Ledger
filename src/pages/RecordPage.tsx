import { useState, useEffect } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Copy, RotateCcw, History, ChevronDown, Check, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Icon } from '@/components/Icon';
import type { Account, PageRoute, RecordMode, ThemeType, AttributionTag, FluctuationLevel } from '@/types';
import { NORMAL_TAGS, ABNORMAL_TAGS } from '@/types';
import {
  getAllAccounts,
  getMonthlyRecord,
  setMonthlyRecord,
  formatAmountNoSymbol,
  formatMonth,
  getSettings,
  saveMonthlyAttribution,
  getMonthlyAttribution,
  calculateFluctuationLevel,
  getAttributionTagLabel,
  getAttributionTagEmoji,
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

  // 预览确认弹窗状态
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewData, setPreviewData] = useState<{
    lastNetWorth: number;
    currentNetWorth: number;
    change: number;
    changePercent: number;
    fluctuationLevel: FluctuationLevel;
  } | null>(null);
  const [selectedTags, setSelectedTags] = useState<AttributionTag[]>([]);
  const [attributionNote, setAttributionNote] = useState('');
  const [hasPendingChanges, setHasPendingChanges] = useState(false);

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

  // 触发预览确认弹窗
  const triggerPreview = () => {
    if (recordMode !== 'monthly') return;

    let lastYear = year;
    let lastMonthNum = month - 1;
    if (lastMonthNum === 0) {
      lastYear--;
      lastMonthNum = 12;
    }
    const lastNW = calculateNetWorth(lastYear, lastMonthNum);
    const currentNW = calculateNetWorth(year, month);
    const changeAmt = currentNW - lastNW;
    const changePct = lastNW !== 0 ? (changeAmt / Math.abs(lastNW)) * 100 : 0;
    const level = calculateFluctuationLevel(changePct);

    // 加载已有归因记录
    const existingAttribution = getMonthlyAttribution(year, month);
    if (existingAttribution) {
      setSelectedTags(existingAttribution.tags);
      setAttributionNote(existingAttribution.note || '');
    } else {
      setSelectedTags([]);
      setAttributionNote('');
    }

    setPreviewData({
      lastNetWorth: lastNW,
      currentNetWorth: currentNW,
      change: changeAmt,
      changePercent: changePct,
      fluctuationLevel: level,
    });
    setShowPreviewDialog(true);
  };

  // 保存归因记录
  const handleSaveAttribution = () => {
    if (!previewData) return;

    // 异常波动必须选择标签
    if (previewData.fluctuationLevel === 'abnormal' && selectedTags.length === 0) {
      return;
    }

    saveMonthlyAttribution(
      year,
      month,
      previewData.change,
      previewData.changePercent,
      selectedTags,
      attributionNote || undefined
    );

    setShowPreviewDialog(false);
    setHasPendingChanges(false);
    setSelectedTags([]);
    setAttributionNote('');
  };

  // 跳过归因（仅正常波动可用）
  const handleSkipAttribution = () => {
    setShowPreviewDialog(false);
    setSelectedTags([]);
    setAttributionNote('');
  };

  // 处理标签选择（正常波动多选，异常波动单选）
  const handleTagToggle = (tag: AttributionTag, isAbnormal: boolean) => {
    if (isAbnormal) {
      // 异常波动：单选
      setSelectedTags([tag]);
    } else {
      // 正常波动：多选切换
      setSelectedTags(prev =>
        prev.includes(tag)
          ? prev.filter(t => t !== tag)
          : [...prev, tag]
      );
    }
  };

  // 获取变化等级标签
  const getFluctuationLevelLabel = (level: FluctuationLevel): { label: string; color: string } => {
    switch (level) {
      case 'normal':
        return { label: '正常', color: 'text-green-600 bg-green-50' };
      case 'warning':
        return { label: '需关注', color: 'text-yellow-600 bg-yellow-50' };
      case 'abnormal':
        return { label: '异常', color: 'text-red-600 bg-red-50' };
    }
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
    <div className="pb-24 bg-gray-50 min-h-screen overflow-x-hidden">
      {/* 标题栏 - 使用 fixed 定位确保始终可见 */}
      <header className="bg-white px-4 py-3 flex justify-between items-center fixed top-0 left-0 right-0 z-50 max-w-md mx-auto shadow-sm">
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

      {/* 占位元素，防止内容被固定标题栏遮挡 */}
      <div className="h-14"></div>

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
                {hideBalance ? '******' : (change >= 0 ? '+' : '')}{hideBalance ? '' : formatAmountNoSymbol(change)}
              </span>
              <span className={`ml-1 text-xs ${change >= 0 ? 'text-white' : 'text-red-200'}`}>
                {hideBalance ? '' : `(${change >= 0 ? '+' : ''}${changePercent.toFixed(1)}%)`}
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
          <>
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

            {/* 完成本月记账按钮 */}
            <Button
              className="w-full h-12 text-white font-medium"
              style={{ backgroundColor: themeConfig.primary }}
              onClick={triggerPreview}
            >
              <Check size={18} className="mr-2" />
              完成本月记账
            </Button>
          </>
        )}

        {/* 账户余额列表 */}
        <div className="space-y-2">
          <div className="flex justify-between items-center px-1">
            <h2 className="text-sm font-medium text-gray-500">
              {recordMode === 'monthly' ? '账户余额' : '年度账户余额'}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              style={{ color: themeConfig.primary }}
              onClick={() => onPageChange('accounts')}
            >
              管理账户
            </Button>
          </div>
          
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
                    <div
                      key={account.id}
                      className="p-3 hover:bg-gray-50 cursor-pointer"
                      onClick={() => onPageChange('account-detail', { accountId: account.id })}
                    >
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
                                  {balance > 0 ? ' · 欠款' : balance < 0 ? ' · 溢缴' : ''}
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
                              onClick={(e) => {
                                e.stopPropagation();
                                saveEdit();
                              }}
                            >
                              保存
                            </Button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startEdit(account);
                            }}
                            className={`text-right px-3 py-1 rounded-lg hover:bg-gray-100 ${
                              isCredit ? (balance > 0 ? 'text-red-500' : 'text-green-600') :
                              isDebt ? 'text-red-500' : ''
                            }`}
                          >
                            <div className="text-sm font-medium">
                              ¥{formatHiddenAmount(isDebt ? Math.abs(balance) : isCredit ? Math.abs(balance) : balance, hideBalance)}
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

      {/* 预览确认对话框 */}
      <Dialog open={showPreviewDialog} onOpenChange={(open) => {
        if (!open) {
          setShowPreviewDialog(false);
          setSelectedTags([]);
          setAttributionNote('');
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{formatMonth(year, month)} 记账预览</DialogTitle>
          </DialogHeader>

          {previewData && (
            <div className="py-4 space-y-4">
              {/* 变化摘要 */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-500">净资产变化</span>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${getFluctuationLevelLabel(previewData.fluctuationLevel).color}`}>
                    {getFluctuationLevelLabel(previewData.fluctuationLevel).label}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-center">
                    <div className="text-xs text-gray-400 mb-1">上月</div>
                    <div className="font-medium">
                      {hideBalance ? '******' : `¥${formatAmountNoSymbol(previewData.lastNetWorth)}`}
                    </div>
                  </div>
                  <div className="text-2xl text-gray-300">→</div>
                  <div className="text-center">
                    <div className="text-xs text-gray-400 mb-1">本月</div>
                    <div className="font-medium">
                      {hideBalance ? '******' : `¥${formatAmountNoSymbol(previewData.currentNetWorth)}`}
                    </div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-200 text-center">
                  <span className={`text-lg font-bold ${previewData.change >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                    {hideBalance ? '******' : (
                      <>
                        {previewData.change >= 0 ? '+' : ''}
                        ¥{formatAmountNoSymbol(previewData.change)}
                        <span className="text-sm ml-1">
                          ({previewData.change >= 0 ? '+' : ''}{previewData.changePercent.toFixed(1)}%)
                        </span>
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* 波动进度条 */}
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>正常</span>
                  <span>需关注</span>
                  <span>异常</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden flex">
                  <div className="h-full bg-green-500" style={{ width: '33.33%' }} />
                  <div className="h-full bg-yellow-500" style={{ width: '33.33%' }} />
                  <div className="h-full bg-red-500" style={{ width: '33.34%' }} />
                </div>
                {/* 当前位置指示器 */}
                <div
                  className="w-2 h-2 bg-white border-2 border-gray-800 rounded-full -mt-3 mx-auto"
                  style={{
                    marginLeft: `${Math.min(Math.max(Math.abs(previewData.changePercent), 0), 100) / 100 * 100}%`,
                    transform: 'translateX(-50%)'
                  }}
                />
              </div>

              {/* 异常波动警告 */}
              {previewData.fluctuationLevel === 'abnormal' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle className="text-red-500 flex-shrink-0 mt-0.5" size={18} />
                  <div className="text-sm text-red-700">
                    <div className="font-medium mb-1">本月变化幅度较大</div>
                    <div>请选择变化原因，以便后续回看分析</div>
                  </div>
                </div>
              )}

              {/* 原因标签 */}
              <div>
                <div className="text-sm text-gray-600 mb-2">
                  {previewData.fluctuationLevel === 'abnormal' ? '请选择原因（必选）' : '选择原因（可选）'}
                </div>
                <div className="flex flex-wrap gap-2">
                  {(previewData.fluctuationLevel === 'abnormal' ? ABNORMAL_TAGS : NORMAL_TAGS).map((tag) => {
                    const isSelected = selectedTags.includes(tag.value);
                    return (
                      <button
                        key={tag.value}
                        onClick={() => handleTagToggle(tag.value, previewData.fluctuationLevel === 'abnormal')}
                        className={`px-3 py-1.5 rounded-full text-sm flex items-center gap-1 transition-colors ${
                          isSelected
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        <span>{tag.emoji}</span>
                        <span>{tag.label}</span>
                        {isSelected && <Check size={14} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 备注输入 */}
              <div>
                <div className="text-sm text-gray-600 mb-2">详细备注（可选）</div>
                <textarea
                  value={attributionNote}
                  onChange={(e) => setAttributionNote(e.target.value)}
                  placeholder="添加备注说明..."
                  className="w-full p-3 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {previewData?.fluctuationLevel !== 'abnormal' && (
              <Button
                variant="outline"
                onClick={handleSkipAttribution}
                className="sm:flex-1"
              >
                跳过
              </Button>
            )}
            <Button
              onClick={handleSaveAttribution}
              disabled={previewData?.fluctuationLevel === 'abnormal' && selectedTags.length === 0}
              className="text-white sm:flex-1"
              style={{
                backgroundColor: themeConfig.primary,
                opacity: previewData?.fluctuationLevel === 'abnormal' && selectedTags.length === 0 ? 0.5 : 1
              }}
            >
              {previewData?.fluctuationLevel === 'abnormal' && selectedTags.length === 0
                ? '请选择原因'
                : '保存记录'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
