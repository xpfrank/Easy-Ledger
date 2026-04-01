import { useState, useEffect } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Copy, RotateCcw, History, ChevronDown, Check, AlertTriangle, BarChart3, Eye, EyeOff, Edit3 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Icon } from '@/components/Icon';
import type { Account, PageRoute, RecordMode, ThemeType, AttributionTag, FluctuationLevel, YearlyAttributionTag } from '@/types';
import { NORMAL_TAGS, ABNORMAL_TAGS, YEARLY_TAGS } from '@/types';
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
  saveYearlyAttribution,
  getYearlyAttribution,
  getMonthlyAttributionsByYear,
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
  if (hide) return '******';
  return formatAmountNoSymbol(amount);
}

// 日历式月份选择器组件
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
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const defaultYear = year || currentYear;
  const defaultMonth = month || currentMonth;

  const [viewYear, setViewYear] = useState(defaultYear);
  const [viewMonth, setViewMonth] = useState(defaultMonth);
  const [showYearSelector, setShowYearSelector] = useState(false);
  const themeConfig = THEMES[theme];

  const getDaysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();
  const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m - 1, 1).getDay();
  const yearRange = Array.from({ length: 211 }, (_, i) => 1990 + i);

  const generateCalendar = () => {
    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
    const days = [];

    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  };

  const calendarDays = generateCalendar();
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  const prevMonth = () => {
    if (viewMonth === 1) {
      setViewYear(viewYear - 1);
      setViewMonth(12);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 12) {
      setViewYear(viewYear + 1);
      setViewMonth(1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

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
          <button onClick={() => setShowYearSelector(false)} className="text-gray-500 hover:bg-gray-100 p-2 rounded-full transition-colors">
            <ChevronLeft size={20} />
          </button>
          <span className="font-medium text-base">选择年份</span>
          <div className="w-10" />
        </div>
        <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto scrollbar-hide">
          {yearRange.map((y) => (
            <button
              key={y}
              onClick={() => {
                setViewYear(y);
                setShowYearSelector(false);
              }}
              className={`p-3 rounded-lg text-sm transition-all duration-200 ${
                viewYear === y
                  ? 'text-white shadow-md scale-105'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
              style={{ backgroundColor: viewYear === y ? themeConfig.primary : undefined }}
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
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
          <ChevronLeft size={20} className="text-gray-500" />
        </button>
        <button
          onClick={() => setShowYearSelector(true)}
          className="flex items-center gap-1 font-medium text-base hover:bg-gray-50 px-4 py-2 rounded-lg transition-colors"
        >
          {viewYear}年{viewMonth}月
          <ChevronDown size={16} className="text-gray-400" />
        </button>
        <button onClick={nextMonth} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
          <ChevronRight size={20} className="text-gray-500" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map((day) => (
          <div key={day} className="text-center text-sm text-gray-400 py-2 font-medium">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, index) => (
          <button
            key={index}
            onClick={() => selectDate(day)}
            disabled={day === null}
            className={`
              aspect-square flex items-center justify-center rounded-full text-sm transition-all duration-200
              ${day === null ? 'invisible' : ''}
              ${day !== null && viewYear === year && viewMonth === month
                ? 'text-white shadow-md scale-110'
                : 'hover:bg-gray-100 hover:scale-105'
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

      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
        <button
          onClick={onClose}
          className="px-5 py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium"
        >
          取消
        </button>
        <button
          onClick={() => {
            onSelect(viewYear, viewMonth);
            onClose();
          }}
          className="px-5 py-2.5 text-sm text-white rounded-lg transition-all duration-200 font-medium shadow-md hover:shadow-lg hover:scale-105"
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
  const [hasChanges, setHasChanges] = useState(false);

  // 预览确认弹窗状态
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewData, setPreviewData] = useState<{
    lastNetWorth: number;
    currentNetWorth: number;
    change: number;
    changePercent: number;
    fluctuationLevel: FluctuationLevel;
    topAccountChanges: Array<{ accountId: string; accountName: string; accountIcon: string; change: number }>;
  } | null>(null);
  const [selectedTags, setSelectedTags] = useState<AttributionTag[]>([]);
  const [attributionNote, setAttributionNote] = useState('');

  // 年度归因弹窗状态
  const [showYearlyAttributionDialog, setShowYearlyAttributionDialog] = useState(false);
  const [yearlySelectedTags, setYearlySelectedTags] = useState<YearlyAttributionTag[]>([]);
  const [yearlyAttributionNote, setYearlyAttributionNote] = useState('');
  const [yearlyKeyMonths, setYearlyKeyMonths] = useState<string[]>([]);

  const themeConfig = THEMES[theme];

  useEffect(() => {
    const settings = getSettings();
    setHideBalance(settings.hideBalance);
    setTheme(settings.theme || 'blue');
    loadData();
    setHasChanges(false);
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
    setHasChanges(false);
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
    setHasChanges(false);
  };

  const handleSelectMonth = (selectedYear: number, selectedMonth: number) => {
    setYear(selectedYear);
    setMonth(selectedMonth);
    setHasChanges(false);
  };

  const handleBalanceChange = (accountId: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setBalances(prev => ({ ...prev, [accountId]: numValue }));
    setMonthlyRecord(accountId, year, month, numValue);
    setHasChanges(true);

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
    setHasChanges(true);
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
    setHasChanges(true);
    setShowClearDialog(false);
  };

  const startEdit = (account: Account, e?: React.MouseEvent) => {
    e?.stopPropagation();
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

    // 计算账户变化 Top 3
    const allAccounts = getAllAccounts().filter(a => !a.isHidden);
    const accountChanges = allAccounts.map(account => {
      const lastRecord = getMonthlyRecord(account.id, lastYear, lastMonthNum);
      const currentRecord = getMonthlyRecord(account.id, year, month);
      const lastBalance = lastRecord ? lastRecord.balance : account.balance;
      const currentBalance = currentRecord ? currentRecord.balance : account.balance;
      return {
        accountId: account.id,
        accountName: account.name,
        accountIcon: account.icon,
        change: currentBalance - lastBalance,
      };
    });

    // 按变化量绝对值排序，取 Top 3
    const topAccountChanges = accountChanges
      .filter(a => a.change !== 0)
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
      .slice(0, 3);

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
      topAccountChanges,
    });
    setShowPreviewDialog(true);
  };

  // 保存归因记录
  const handleSaveAttribution = () => {
    if (!previewData) return;

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
    setSelectedTags([]);
    setAttributionNote('');
    setHasChanges(false);
  };

  // 跳过归因
  const handleSkipAttribution = () => {
    setShowPreviewDialog(false);
    setSelectedTags([]);
    setAttributionNote('');
    setHasChanges(false);
  };

  // 触发年度归因弹窗
  const triggerYearlyAttribution = () => {
    const existingAttribution = getYearlyAttribution(year);
    if (existingAttribution) {
      setYearlySelectedTags(existingAttribution.tags);
      setYearlyAttributionNote(existingAttribution.note || '');
      setYearlyKeyMonths(existingAttribution.keyMonths);
    } else {
      setYearlySelectedTags([]);
      setYearlyAttributionNote('');
      setYearlyKeyMonths([]);
    }
    setShowYearlyAttributionDialog(true);
  };

  // 从月度生成年度归因
  const generateYearlyFromMonthly = () => {
    const monthlyAttributions = getMonthlyAttributionsByYear(year);
    if (monthlyAttributions.length === 0) return;

    const tagCounts: Record<string, number> = {};
    monthlyAttributions.forEach(attr => {
      attr.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    const sortedTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([tag]) => tag as YearlyAttributionTag);

    setYearlySelectedTags(sortedTags);
  };

  // 保存年度归因
  const handleSaveYearlyAttribution = () => {
    const lastYearNetWorth = calculateNetWorth(year - 1, 12);
    const yearlyChange = netWorth - lastYearNetWorth;
    const yearlyChangePercent = lastYearNetWorth !== 0 ? (yearlyChange / Math.abs(lastYearNetWorth)) * 100 : 0;

    saveYearlyAttribution(
      year,
      netWorth,
      yearlyChange,
      yearlyChangePercent,
      yearlySelectedTags,
      yearlyAttributionNote || undefined,
      yearlyKeyMonths
    );

    setShowYearlyAttributionDialog(false);
  };

  // 处理年度标签选择
  const handleYearlyTagToggle = (tag: YearlyAttributionTag) => {
    setYearlySelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  // 处理关键月份选择
  const handleKeyMonthToggle = (month: string) => {
    setYearlyKeyMonths(prev =>
      prev.includes(month)
        ? prev.filter(m => m !== month)
        : [...prev, month]
    );
  };

  // 处理标签选择
  const handleTagToggle = (tag: AttributionTag, isAbnormal: boolean) => {
    if (isAbnormal) {
      setSelectedTags([tag]);
    } else {
      setSelectedTags(prev =>
        prev.includes(tag)
          ? prev.filter(t => t !== tag)
          : [...prev, tag]
      );
    }
  };

  // 获取变化等级标签
  const getFluctuationLevelLabel = (level: FluctuationLevel): { label: string; color: string; bgColor: string } => {
    switch (level) {
      case 'normal':
        return { label: '正常波动', color: 'text-green-700', bgColor: 'bg-green-100' };
      case 'warning':
        return { label: '需关注', color: 'text-yellow-700', bgColor: 'bg-yellow-100' };
      case 'abnormal':
        return { label: '异常波动', color: 'text-red-700', bgColor: 'bg-red-100' };
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
      {/* 标题栏 */}
      <header className="bg-white px-4 py-3 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => onPageChange('home')}>
            <ArrowLeft size={20} />
          </Button>

          <div className="relative">
            <button
              className="flex items-center gap-1 text-lg font-semibold hover:bg-gray-50 px-2 py-1 rounded-lg transition-colors"
              onClick={() => setShowModeDropdown(!showModeDropdown)}
            >
              {recordMode === 'monthly' ? '月度记账' : '年度记账'}
              <ChevronDown size={18} className={`text-gray-400 transition-transform ${showModeDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showModeDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50 min-w-[140px] animate-in fade-in zoom-in-95 duration-200">
                <button
                  className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${recordMode === 'monthly' ? 'text-white' : 'hover:bg-gray-50'}`}
                  style={{ backgroundColor: recordMode === 'monthly' ? themeConfig.primary : undefined }}
                  onClick={() => {
                    setRecordMode('monthly');
                    setShowModeDropdown(false);
                  }}
                >
                  月度记账
                </button>
                <button
                  className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${recordMode === 'yearly' ? 'text-white' : 'hover:bg-gray-50'}`}
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

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setHideBalance(!hideBalance)}
            className="text-gray-500"
          >
            {hideBalance ? <EyeOff size={18} /> : <Eye size={18} />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            style={{ color: themeConfig.primary }}
            onClick={() => onPageChange('record-logs', { year, month, mode: recordMode })}
          >
            <History size={18} className="mr-1" />
            记录
          </Button>
        </div>
      </header>

      <div className="p-4 space-y-4">
        {/* 月份/年份选择器 */}
        <Card className="bg-white shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={goToPrev} className="hover:bg-gray-100">
                <ChevronLeft size={24} />
              </Button>

              {recordMode === 'monthly' ? (
                <button
                  className="text-center hover:bg-gray-50 px-6 py-2 rounded-xl transition-all"
                  onClick={() => setShowMonthPicker(true)}
                >
                  <div className="text-xl font-bold text-gray-900">{formatMonth(year, month)}</div>
                  <div className="text-xs text-gray-400 mt-1">点击切换月份</div>
                </button>
              ) : (
                <div className="text-center px-6 py-2">
                  <div className="text-xl font-bold text-gray-900">{year}年</div>
                  <div className="text-xs text-gray-400 mt-1">年度汇总</div>
                </div>
              )}

              <Button variant="ghost" size="icon" onClick={goToNext} className="hover:bg-gray-100">
                <ChevronRight size={24} />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 净资产汇总 */}
        <Card
          className="text-white shadow-lg"
          style={{ background: `linear-gradient(135deg, ${themeConfig.gradientFrom} 0%, ${themeConfig.gradientTo} 100%)` }}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-white/80 text-sm font-medium">
                {recordMode === 'monthly' ? '本月净资产' : '年度净资产'}
              </span>
              <span className={`text-sm px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm font-medium ${
                change >= 0 ? 'text-white' : 'text-red-100'
              }`}>
                较{recordMode === 'monthly' ? '上月' : '上年'} {hideBalance ? '******' : (
                  <>
                    {change >= 0 ? '+' : ''}¥{formatAmountNoSymbol(change)}
                    <span className="ml-1 opacity-80">
                      ({change >= 0 ? '+' : ''}{changePercent.toFixed(1)}%)
                    </span>
                  </>
                )}
              </span>
            </div>

            <div className="text-3xl font-bold mb-3 tracking-tight">¥{formatHiddenAmount(netWorth, hideBalance)}</div>

            <div className="mt-4 pt-4 border-t border-white/20 grid grid-cols-2 gap-4">
              <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
                <div className="text-xs text-white/70 mb-1">总资产</div>
                <div className="font-semibold text-lg">¥{formatHiddenAmount(totalAssets, hideBalance)}</div>
              </div>
              <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
                <div className="text-xs text-white/70 mb-1">负资产</div>
                <div className="font-semibold text-lg">¥{formatHiddenAmount(totalLiabilities, hideBalance)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 悬浮预览按钮 - 固定在底部导航栏上方 */}
        {recordMode === 'monthly' && (
          <div
            className={`
              fixed left-4 right-4 z-40 transition-all duration-300 ease-in-out
              ${hasChanges ? 'bottom-20 opacity-100 translate-y-0' : 'bottom-0 opacity-0 translate-y-full pointer-events-none'}
            `}
            style={{ bottom: hasChanges ? '80px' : '0px' }}
          >
            <div
              className="glass-panel rounded-2xl p-1.5 border-2 alert-pulse bg-gradient-to-br from-white to-gray-50 shadow-2xl"
              style={{
                '--theme-color': themeConfig.primary,
                borderColor: themeConfig.primary
              } as React.CSSProperties}
            >
              <Button
                className="w-full h-14 text-white font-semibold text-base shadow-lg hover:shadow-xl transition-all duration-200 rounded-xl"
                style={{ backgroundColor: themeConfig.primary }}
                onClick={triggerPreview}
              >
                <Check size={20} className="mr-2" />
                预览本月记账
              </Button>
            </div>
          </div>
        )}

        {/* 年度归因按钮（月度模式下隐藏，年度模式下显示在固定位置） */}
        {recordMode === 'yearly' && (
          <div className="px-1">
            <Button
              variant="outline"
              className="w-full h-12 font-semibold text-base border-2 bg-white hover:bg-gray-50"
              style={{ borderColor: themeConfig.primary, color: themeConfig.primary }}
              onClick={triggerYearlyAttribution}
            >
              <BarChart3 size={20} className="mr-2" />
              年度归因
            </Button>
          </div>
        )}

        {/* 快捷操作 */}
        {recordMode === 'monthly' && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 h-11 hover:bg-gray-50 transition-colors text-sm font-medium bg-white"
              onClick={() => setShowCopyDialog(true)}
            >
              <Copy size={16} className="mr-2" />
              复制上月
            </Button>
            <Button
              variant="outline"
              className="flex-1 h-11 hover:bg-gray-50 transition-colors text-sm font-medium bg-white"
              onClick={() => setShowClearDialog(true)}
            >
              <RotateCcw size={16} className="mr-2" />
              清空
            </Button>
          </div>
        )}

        {/* 账户余额列表 */}
        <div className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <h2 className="text-sm font-medium text-gray-500">
              {recordMode === 'monthly' ? '账户余额' : '年度账户余额'}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-sm"
              style={{ color: themeConfig.primary }}
              onClick={() => onPageChange('accounts')}
            >
              管理账户
            </Button>
          </div>

          {accounts.length === 0 ? (
            <Card className="bg-white">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <Icon name="wallet" size={28} className="text-gray-400" />
                </div>
                <p className="text-gray-500 font-medium mb-4">还没有账户</p>
                <Button
                  className="text-white px-6"
                  style={{ backgroundColor: themeConfig.primary }}
                  onClick={() => onPageChange('account-edit')}
                >
                  添加账户
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-white shadow-sm overflow-hidden">
              <div className="divide-y divide-gray-100">
                {accounts.map((account, index) => {
                  const isCredit = account.type === 'credit';
                  const isDebt = account.type === 'debt';
                  const balance = balances[account.id] || 0;
                  const isEditing = editingAccount === account.id;

                  return (
                    <div
                      key={account.id}
                      className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                      style={{ animationDelay: `${index * 50}ms` }}
                      onClick={() => onPageChange('account-detail', { accountId: account.id })}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
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
                            <div className="font-medium text-sm text-gray-900">{account.name}</div>
                            <div className="text-xs text-gray-400 flex items-center gap-1">
                              {getAccountTypeLabel(account.type)}
                              {isCredit && balance > 0 && (
                                <span className="text-red-500">· 欠款</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {isEditing ? (
                          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">¥</span>
                              <Input
                                type="number"
                                step="0.01"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="w-32 h-10 pl-7 text-sm font-medium"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveEdit();
                                  if (e.key === 'Escape') cancelEdit();
                                }}
                              />
                            </div>
                            <Button
                              size="sm"
                              className="h-10 px-4 text-white text-sm"
                              style={{ backgroundColor: themeConfig.primary }}
                              onClick={saveEdit}
                            >
                              保存
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => startEdit(account, e)}
                              className={`text-right px-3 py-2 rounded-xl hover:bg-gray-100 transition-all ${
                                isCredit ? (balance > 0 ? 'text-red-500' : 'text-green-600') :
                                isDebt ? 'text-red-500' : 'text-gray-900'
                              }`}
                            >
                              <div className="text-base font-medium">
                                ¥{formatHiddenAmount(isDebt ? Math.abs(balance) : isCredit ? Math.abs(balance) : balance, hideBalance)}
                              </div>
                              <div className="text-xs text-gray-400">点击编辑</div>
                            </button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-400 hover:text-gray-600"
                              onClick={(e) => startEdit(account, e)}
                            >
                              <Edit3 size={16} />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>

        {/* 底部占位，防止内容被固定按钮遮挡 */}
        {recordMode === 'monthly' && <div className="h-20"></div>}
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
          <DialogFooter className="gap-2">
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
          <DialogFooter className="gap-2">
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
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">{formatMonth(year, month)} 记账预览</DialogTitle>
          </DialogHeader>

          {previewData && (
            <div className="py-4 space-y-5">
              {/* 变化摘要卡片 */}
              <div
                className="rounded-xl p-5 text-white"
                style={{
                  background: `linear-gradient(135deg, ${
                    previewData.change >= 0 ? '#22c55e' : '#ef4444'
                  } 0%, ${
                    previewData.change >= 0 ? '#16a34a' : '#dc2626'
                  } 100%)`
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-white/80 text-sm">净资产变化</span>
                  <span className={`text-xs px-3 py-1 rounded-full font-semibold bg-white/20 backdrop-blur-sm`}>
                    {getFluctuationLevelLabel(previewData.fluctuationLevel).label}
                  </span>
                </div>

                <div className="flex items-center justify-between mb-4">
                  <div className="text-center">
                    <div className="text-xs text-white/70 mb-1">上月</div>
                    <div className="text-lg font-bold">
                      {hideBalance ? '******' : `¥${formatAmountNoSymbol(previewData.lastNetWorth)}`}
                    </div>
                  </div>
                  <div className="text-2xl text-white/50">→</div>
                  <div className="text-center">
                    <div className="text-xs text-white/70 mb-1">本月</div>
                    <div className="text-lg font-bold">
                      {hideBalance ? '******' : `¥${formatAmountNoSymbol(previewData.currentNetWorth)}`}
                    </div>
                  </div>
                </div>

                <div className="text-center pt-3 border-t border-white/20">
                  <span className="text-2xl font-bold">
                    {hideBalance ? '******' : (
                      <>
                        {previewData.change >= 0 ? '+' : ''}
                        ¥{formatAmountNoSymbol(previewData.change)}
                        <span className="text-base ml-2 opacity-80">
                          ({previewData.change >= 0 ? '+' : ''}{previewData.changePercent.toFixed(1)}%)
                        </span>
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* 波动进度条 */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex justify-between text-xs text-gray-500 mb-2 font-medium">
                  <span>正常</span>
                  <span>需关注</span>
                  <span>异常</span>
                </div>
                <div className="relative">
                  <div className="h-3 bg-gray-200 rounded-full overflow-hidden flex">
                    <div className="h-full bg-green-500" style={{ width: '33.33%' }} />
                    <div className="h-full bg-yellow-500" style={{ width: '33.33%' }} />
                    <div className="h-full bg-red-500" style={{ width: '33.34%' }} />
                  </div>
                  <div
                    className="absolute top-0 w-4 h-3 -ml-2"
                    style={{
                      left: `${Math.min(Math.max(Math.abs(previewData.changePercent), 0), 100)}%`,
                    }}
                  >
                    <div className="w-4 h-4 bg-white border-2 rounded-full shadow-md -mt-0.5" style={{ borderColor: themeConfig.primary }} />
                  </div>
                </div>
                <div className="text-center text-xs text-gray-400 mt-3">
                  当前波动: {Math.abs(previewData.changePercent).toFixed(1)}%
                </div>
              </div>

              {/* 账户变化 Top 3 */}
              {previewData.topAccountChanges.length > 0 && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-sm font-medium text-gray-700 mb-3">变化最大的账户</div>
                  <div className="space-y-2">
                    {previewData.topAccountChanges.map((item, index) => (
                      <div
                        key={item.accountId}
                        className="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => {
                          setShowPreviewDialog(false);
                          onPageChange('account-detail', { accountId: item.accountId });
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: `${themeConfig.primary}15` }}
                          >
                            <Icon name={item.accountIcon} size={16} color={themeConfig.primary} />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{item.accountName}</div>
                            <div className="text-xs text-gray-400">点击查看详情</div>
                          </div>
                        </div>
                        <div className={`text-sm font-semibold ${
                          item.change >= 0 ? 'text-green-600' : 'text-red-500'
                        }`}>
                          {item.change >= 0 ? '+' : ''}¥{formatAmountNoSymbol(Math.abs(item.change))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 异常波动警告 */}
              {previewData.fluctuationLevel === 'abnormal' && (
                <div className="rounded-xl p-4 flex items-start gap-3 bg-gradient-to-br from-red-50 to-white border-2 border-red-200">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="text-red-500" size={20} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-red-800 mb-1">本月变化幅度较大</div>
                    <p className="text-xs text-red-600 leading-relaxed">请选择变化原因，这将帮助您后续分析资产变化趋势。</p>
                  </div>
                </div>
              )}

              {/* 原因标签 */}
              <div>
                <div className="text-sm font-medium text-gray-700 mb-3">
                  {previewData.fluctuationLevel === 'abnormal' ? (
                    <span className="text-red-600">* 请选择原因（必选）</span>
                  ) : '选择原因（可选）'}
                </div>
                <div className="flex flex-wrap gap-2">
                  {(previewData.fluctuationLevel === 'abnormal' ? ABNORMAL_TAGS : NORMAL_TAGS).map((tag) => {
                    const isSelected = selectedTags.includes(tag.value);
                    return (
                      <button
                        key={tag.value}
                        onClick={() => handleTagToggle(tag.value, previewData.fluctuationLevel === 'abnormal')}
                        className={`px-4 py-2 rounded-full text-sm flex items-center gap-1.5 transition-all duration-200 ${
                          isSelected
                            ? 'text-white shadow-md scale-105'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                        style={{ backgroundColor: isSelected ? themeConfig.primary : undefined }}
                      >
                        <span className="text-base">{tag.emoji}</span>
                        <span className="font-medium">{tag.label}</span>
                        {isSelected && <Check size={14} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 备注输入 */}
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">详细备注（可选）</div>
                <textarea
                  value={attributionNote}
                  onChange={(e) => setAttributionNote(e.target.value)}
                  placeholder="添加备注说明，如工资到账、投资收益等..."
                  className="w-full p-4 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-opacity-50 focus:border-transparent transition-all"
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex-row gap-3 pt-4 border-t">
            {previewData?.fluctuationLevel !== 'abnormal' && (
              <Button
                variant="outline"
                onClick={handleSkipAttribution}
                className="flex-1 h-11"
              >
                取消
              </Button>
            )}
            <Button
              onClick={handleSaveAttribution}
              disabled={previewData?.fluctuationLevel === 'abnormal' && selectedTags.length === 0}
              className="flex-1 h-11 font-semibold transition-all duration-200"
              style={{
                backgroundColor: themeConfig.primary,
                opacity: previewData?.fluctuationLevel === 'abnormal' && selectedTags.length === 0 ? 0.5 : 1
              }}
            >
              {previewData?.fluctuationLevel === 'abnormal' && selectedTags.length === 0
                ? '请选择原因'
                : '确认保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 年度归因对话框 */}
      <Dialog open={showYearlyAttributionDialog} onOpenChange={setShowYearlyAttributionDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">{year}年年度归因</DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-5">
            {/* 年度变化摘要 */}
            <div
              className="rounded-xl p-5 text-white"
              style={{
                background: `linear-gradient(135deg, ${themeConfig.gradientFrom} 0%, ${themeConfig.gradientTo} 100%)`
              }}
            >
              <div className="text-center mb-4">
                <div className="text-white/70 text-sm mb-1">年末净资产</div>
                <div className="text-3xl font-bold">{hideBalance ? '******' : `¥${formatAmountNoSymbol(netWorth)}`}</div>
              </div>
              <div className="flex items-center justify-center gap-6 pt-4 border-t border-white/20">
                <div className="text-center">
                  <div className="text-white/70 text-xs mb-1">较年初</div>
                  <div className={`font-bold text-lg ${change >= 0 ? 'text-white' : 'text-red-100'}`}>
                    {hideBalance ? '******' : `${change >= 0 ? '+' : ''}${formatAmountNoSymbol(change)}`}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-white/70 text-xs mb-1">变化率</div>
                  <div className={`font-bold text-lg ${changePercent >= 0 ? 'text-white' : 'text-red-100'}`}>
                    {hideBalance ? '******' : `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(1)}%`}
                  </div>
                </div>
              </div>
            </div>

            {/* 关键月份 */}
            <div>
              <div className="text-sm font-medium text-gray-700 mb-3">关键月份（可选）</div>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <button
                    key={m}
                    onClick={() => handleKeyMonthToggle(String(m))}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                      yearlyKeyMonths.includes(String(m))
                        ? 'text-white shadow-md scale-105'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    style={{ backgroundColor: yearlyKeyMonths.includes(String(m)) ? themeConfig.primary : undefined }}
                  >
                    {m}月
                  </button>
                ))}
              </div>
            </div>

            {/* 年度标签选择 */}
            <div>
              <div className="text-sm font-medium text-gray-700 mb-3">选择原因（可选）</div>
              <div className="flex flex-wrap gap-2">
                {YEARLY_TAGS.map((tag) => {
                  const isSelected = yearlySelectedTags.includes(tag.value);
                  return (
                    <button
                      key={tag.value}
                      onClick={() => handleYearlyTagToggle(tag.value)}
                      className={`px-4 py-2 rounded-full text-sm flex items-center gap-1.5 transition-all duration-200 ${
                        isSelected
                          ? 'text-white shadow-md scale-105'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                      style={{ backgroundColor: isSelected ? themeConfig.primary : undefined }}
                    >
                      <span className="text-base">{tag.emoji}</span>
                      <span className="font-medium">{tag.label}</span>
                      {isSelected && <Check size={14} />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 备注输入 */}
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">详细备注（可选）</div>
              <textarea
                value={yearlyAttributionNote}
                onChange={(e) => setYearlyAttributionNote(e.target.value)}
                placeholder="添加年度总结说明..."
                className="w-full p-4 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-opacity-50 focus:border-transparent transition-all"
                rows={3}
              />
            </div>

            {/* 从月度生成按钮 */}
            <Button
              variant="outline"
              onClick={generateYearlyFromMonthly}
              className="w-full h-11"
            >
              从月度归因智能生成
            </Button>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setShowYearlyAttributionDialog(false)}
              className="sm:flex-1 h-11"
            >
              取消
            </Button>
            <Button
              onClick={handleSaveYearlyAttribution}
              className="text-white sm:flex-1 h-11 font-semibold"
              style={{ backgroundColor: themeConfig.primary }}
            >
              保存年度归因
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSS 动画样式 */}
      <style>{`
        @keyframes alert-pulse {
          0%, 100% {
            border-color: var(--theme-color);
            box-shadow: 0 0 0 0 rgba(var(--theme-color-rgb), 0.4);
          }
          50% {
            border-color: var(--theme-color);
            box-shadow: 0 0 20px 4px rgba(var(--theme-color-rgb), 0.2);
          }
        }
        .alert-pulse {
          animation: alert-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
    </div>
  );
}
