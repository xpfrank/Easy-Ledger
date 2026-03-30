import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Copy, RotateCcw, History, ChevronDown, Check, AlertTriangle, BarChart3, Eye, EyeOff } from 'lucide-react';
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

function formatHiddenAmount(amount: number, hide: boolean): string {
  if (hide) return '******';
  return formatAmountNoSymbol(amount);
}

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
          <span className="font-medium text-lg">选择年份</span>
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
          className="flex items-center gap-1 font-medium text-lg hover:bg-gray-50 px-4 py-2 rounded-lg transition-colors"
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

  const handleSkipAttribution = () => {
    setShowPreviewDialog(false);
    setSelectedTags([]);
    setAttributionNote('');
    setHasChanges(false);
  };

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

  const handleYearlyTagToggle = (tag: YearlyAttributionTag) => {
    setYearlySelectedTags(prev =>