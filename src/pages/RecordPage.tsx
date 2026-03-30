fullText:
import { useState, useEffect } from 'react';
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

// 新增：将 hex 颜色转换为 RGB 字符串，用于 CSS 变量
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '0, 0, 0';
}

// 新增：定义脉冲动画 CSS
const pulseAnimationCss = `
  @keyframes alert-pulse {
    0%, 100% {
      border-color: var(--pulse-color);
      opacity: 1;
    }
    50% {
      border-color: rgba(var(--pulse-color-rgb), 0.3);
      opacity: 0.8;
    }
  }
  .alert-pulse {
    animation: alert-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
`;

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
    setHasChanges(false); // 保存后重置 hasChanges，隐藏预览按钮面板
  };

  // 跳过归因
  const handleSkipAttribution = () => {
    setShowPreviewDialog(false);
    setSelectedTags([]);
    setAttributionNote('');
    setHasChanges(false); // 跳过后也隐藏
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
    <>
      {/* 新增：注入脉冲动画 CSS */}
      <style>{pulseAnimationCss}</style>
      
      {/* 调整：增加底部 padding (pb-[180px])，为导航栏和新上移的预览面板留出空间 */}
      <div className="pb-[180px] bg-gray-50 min-h-screen overflow-x-hidden">
        {/* 标题栏 */}
        <header className="bg-white px-4 py-3 flex justify-between items-center fixed top-0 left-0 right-0 z-50 max-w-md mx-auto shadow-sm">
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

        <div className="h-14"></div>

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
                <span className={`text-xs px-2 py-1 rounded-full bg-white/20 backdrop-blur-sm ${
                  change >= 0 ? 'text-white' : 'text-red-100'
                }`}>
                  较{recordMode === 'monthly' ? '上月' : '上年'} {change >= 0 ? '+' : ''}{changePercent.toFixed(1)}%
                </span>
              </div>
              
              <div className="text-3xl font-bold mb-3 tracking-tight">¥{formatHiddenAmount(netWorth, hideBalance)}</div>
              
              <div className="flex items-center gap-2 text-sm">
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg ${
                  change >= 0 ? 'bg-white/20 text-white' : 'bg-red-500/30 text-red-100'
                }`}>
                  {change >= 0 ? '+' : ''}{formatHiddenAmount(change, hideBalance)}
                </span>
              </div>
              
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

          {/* 快捷操作 */}
          {recordMode === 'monthly' && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 h-11 hover:bg-gray-50 transition-colors"
                onClick={() => setShowCopyDialog(true)}
              >
                <Copy size={16} className="mr-2" />
                复制上月
              </Button>
              <Button
                variant="outline"
                className="flex-1 h-11 hover:bg-gray-50 transition-colors"
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
              <h2 className="text-sm font-semibold text-gray-600">
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
                        className="p-4 hover:bg-gray-50 transition-colors"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div 
                              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                                isCredit || isDebt ? 'bg-red-50' : 'bg-blue-50'
                              }`}
                            >
                              <Icon 
                                name={account.icon} 
                                size={20} 
                                className={isCredit || isDebt ? 'text-red-500' : 'text-blue-500'}
                              />
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900">{account.name}</div>
                              <div className="text-xs text-gray-400 flex items-center gap-1">
                                {getAccountTypeLabel(account.type)}
                                {isCredit && balance > 0 && (
                                  <span className="text-red-500">· 欠款</span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {isEditing ? (
                            <div className="flex items-center gap-2">
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
                                className="h-10 px-4 text-white"
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
                              onClick={() => startEdit(account)}
                              className={`text-right px-4 py-2 rounded-xl hover:bg-gray-100 transition-all ${
                                isCredit ? (balance > 0 ? 'text-red-500' : 'text-green-600') :
                                isDebt ? 'text-red-500' : 'text-gray-900'
                              }`}
                            >
                              <div className="text-base font-bold">
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

        {/* 底部固定操作栏 */}
        {/* 重构：上移面板位置，位于导航栏之上，并根据 changes 状态显示/隐藏，应用 glass 风格和主题色脉冲动画 */}
        {recordMode === 'monthly' && hasChanges && (
          <div 
            className="fixed bottom-[80px] left-0 right-0 max-w-md mx-auto z-40 p-3" // 上移，为导航栏留位置
          >
            <div 
              className="glass-panel rounded-2xl p-4 border-2 alert-pulse shadow-xl" // 应用用户要求的 glass 风格和自定义脉冲类
              style={{ 
                borderColor: themeConfig.primary, // 动态主题边框
                background: `linear-gradient(to bottom right, ${themeConfig.bgLight} 0%, white 100%)`, // 动态主题背景渐变
                // 设置 CSS 变量用于动画
                '--pulse-color': themeConfig.primary,
                '--pulse-color-rgb': hexToRgb(themeConfig.primary),
              } as React.CSSProperties}
            >
              <Button
                className="w-full h-12 text-white font-semibold text-base transition-all duration-200"
                style={{ 
                  backgroundColor: themeConfig.primary,
                  // 移除 hasChanges 控制的灰色和缩放，因为父容器控制了显示隐藏
                }}
                onClick={triggerPreview}
              >
                <Check size={20} className="mr-2" />
                预览本月记账
              </Button>
            </div>
          </div>
        )}

        {/* 年度记账按钮容器，不需要特殊样式，保持在最底部 */}
        {recordMode === 'yearly' && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 max-w-md mx-auto z-40">
            <Button
              variant="outline"
              className="w-full h-12 font-semibold text-base border-2"
              style={{ borderColor: themeConfig.primary, color: themeConfig.primary }}
              onClick={triggerYearlyAttribution}
            >
              <BarChart3 size={20} className="mr-2" />
              年度归因
            </Button>
          </div>
        )}

        {/* 月份选择器弹窗 */}
        {/* ...（MonthPicker 弹窗代码保持不变）... */}

        {/* 复制确认对话框 */}
        {/* ...（复制确认弹窗代码保持不变）... */}

        {/* 清空确认对话框 */}
        {/* ...（清空确认弹窗代码保持不变）... */}

        {/* 预览确认对话框 - 优化设计 */}
        {/* ...（预览确认弹窗代码保持不变，包括 handleSaveAttribution 和 handleSkipAttribution）... */}

        {/* 年度归因对话框 */}
        {/* ...（年度归因弹窗代码保持不变）... */}
      </div>
    </>
  );
}