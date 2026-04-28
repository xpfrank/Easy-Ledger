import { useState, useEffect } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Copy, RotateCcw, History, ChevronDown, Check, AlertTriangle, Eye, EyeOff, Edit3 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Icon } from '@/components/Icon';
import type { Account, PageRoute, RecordMode, ThemeType, AttributionTag, FluctuationLevel, YearlyAttributionTag } from '@/types';
import { THEMES } from '@/types';
import {
  getAllAccounts,
  getMonthlyRecord,
  getAccountBalanceForMonth,
  setMonthlyRecord,
  formatAmountNoSymbol,
  formatMonth,
  saveMonthlyAttribution,
  getMonthlyAttribution,
  calculateFluctuationLevel,
  saveYearlyAttribution,
  getYearlyAttribution,
  getMonthlyAttributionsByYear,
  getAttributionTagLabel,
  getAttributionTagEmoji,
  getAccountsForMonth,
  getSettings,
  getAllAttributionTagOptions,
  getAllYearlyTagOptions,
  getAccountSnapshotsByMonth,
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
import MonthlyAttributionDetail from '@/components/attribution/MonthlyAttributionDetail';

interface RecordPageProps {
  onPageChange: (page: PageRoute, params?: any) => void;
  hideBalance: boolean;
  toggleHideBalance: () => void;
  params?: {
    year?: number;
    month?: number;
    mode?: RecordMode;
    openAttributionEdit?: boolean;
  };
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
  const currentDay = now.getDate(); // 获取系统当前日期

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
              ${day !== null && day === currentDay && viewYear === currentYear && viewMonth === currentMonth
                ? 'text-white shadow-md scale-110'
                : 'hover:bg-gray-100 hover:scale-105'
              }
            `}
            style={{
              backgroundColor: day !== null && day === currentDay && viewYear === currentYear && viewMonth === currentMonth
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

interface YearlyDashboardProps {
  year: number;
  netWorth: number;
  lastNetWorth: number;
  hideBalance: boolean;
  themeConfig: {
    primary: string;
    gradientFrom: string;
    gradientTo: string;
  };
  onEditAttribution: () => void;
  onMonthClick: (month: number, nw: number, changePercent: number) => void;
}

function fmtShort(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}亿`;
  if (abs >= 10_000)      return `${(n / 10_000).toFixed(1)}w`;
  if (abs >= 1_000)       return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

function YearlyDashboard({
  year,
  netWorth,
  lastNetWorth,
  hideBalance,
  themeConfig,
  onEditAttribution,
  onMonthClick,
}: YearlyDashboardProps) {
  const monthSnapshots = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const hasRecord = getAccountSnapshotsByMonth(year, m).length > 0;
    if (!hasRecord) {
      return { month: m, hasRecord: false, nw: 0, changePercent: 0 };
    }

    const accs = getAccountsForMonth(year, m).filter(a => !a.isHidden);
    const nw   = calculateNetWorth(accs, year, m);

    const prevM = m === 1 ? 12 : m - 1;
    const prevY = m === 1 ? year - 1 : year;
    const prevAccs = getAccountsForMonth(prevY, prevM).filter(a => !a.isHidden);
    const prevNw   = calculateNetWorth(prevAccs, prevY, prevM);

    const changePercent = prevNw !== 0 ? ((nw - prevNw) / Math.abs(prevNw)) * 100 : 0;
    return { month: m, hasRecord: true, nw, changePercent };
  });

  const lastRecordedMonth = getLastRecordedMonth(year) || 0;
  const recordedSlots     = monthSnapshots.filter(s => s.hasRecord);

  const peakNw = recordedSlots.length
    ? Math.max(...recordedSlots.map(s => s.nw))
    : netWorth;
  const avgNw  = recordedSlots.length
    ? Math.round(recordedSlots.reduce((sum, s) => sum + s.nw, 0) / recordedSlots.length)
    : netWorth;

  const yoyChange = netWorth - lastNetWorth;
  const yoyPct    = lastNetWorth !== 0 ? (yoyChange / Math.abs(lastNetWorth)) * 100 : 0;

  const monthlyAttrs = getMonthlyAttributionsByYear(year);

  type TagStat = { label: string; emoji: string; totalChange: number };
  const tagMap: Record<string, TagStat> = {};

  monthlyAttrs.forEach(attr => {
    attr.tags.forEach(tag => {
      if (!tagMap[tag]) {
        tagMap[tag] = {
          label:       getAttributionTagLabel(tag as any),
          emoji:       getAttributionTagEmoji(tag as any),
          totalChange: 0,
        };
      }
      // 优先使用 tagAmounts 中该标签的精确分配金额；
      // 若无自定义分配，则将总变动按标签数均分，避免多标签重复累计
      const tagAmount = attr.tagAmounts?.[tag] ?? (attr.change / Math.max(attr.tags.length, 1));
      tagMap[tag].totalChange += tagAmount;
    });
  });

  const totalAbsChange = Object.values(tagMap).reduce(
    (s, t) => s + Math.abs(t.totalChange), 0
  );

  const attrTop5 = Object.entries(tagMap)
    .sort((a, b) => b[1].totalChange - a[1].totalChange)
    .slice(0, 5)
    .map(([tag, stats]) => ({
      tag,
      ...stats,
      percent: totalAbsChange > 0 ? (stats.totalChange / totalAbsChange) * 100 : 0,
    }));

  const allAccounts = getAllAccounts().filter(a => !a.isHidden);

  const accRanking = allAccounts
    .map(acc => {
      const startBal = getAccountBalanceForMonth(acc.id, year - 1, 12);
      const endBal   = lastRecordedMonth
        ? getAccountBalanceForMonth(acc.id, year, lastRecordedMonth)
        : startBal;

      let peakBal = Math.abs(endBal);
      for (let m = 1; m <= 12; m++) {
        const rec = getMonthlyRecord(acc.id, year, m);
        if (rec) peakBal = Math.max(peakBal, Math.abs(rec.balance));
      }

      return {
        accountId:   acc.id,
        accountName: acc.name,
        accountIcon: acc.icon,
        accountType: acc.type,
        change:      endBal - startBal,
        peakBal,
      };
    })
    .filter(a => a.change !== 0 || a.peakBal > 0)
    .sort((a, b) => b.change - a.change);

  const fmt = (n: number) => formatAmountNoSymbol(n);

  return (
    <div className="space-y-3">
      <div
        className="rounded-2xl p-5 text-white shadow-lg"
        style={{
          background: `linear-gradient(135deg, ${themeConfig.gradientFrom} 0%, ${themeConfig.gradientTo} 100%)`,
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-white/75 text-xs font-medium">年度净资产</span>

          <span className="bg-white/20 rounded-full px-3 py-1 text-xs font-medium backdrop-blur-sm">
            {hideBalance ? '******' : (
              <>
                较上年 {yoyChange >= 0 ? '+' : ''}¥{fmt(yoyChange)}
                <span className="opacity-80 ml-1">
                  ({yoyChange >= 0 ? '+' : ''}{yoyPct.toFixed(1)}%)
                </span>
              </>
            )}
          </span>
        </div>

        <div className="text-3xl font-bold tracking-tight mb-4">
          {hideBalance ? '¥ ******' : `¥${fmt(netWorth)}`}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/15 rounded-xl p-3 backdrop-blur-sm">
            <div className="text-[11px] text-white/70 mb-1">年度峰值</div>
            <div className="text-base font-semibold">
              {hideBalance ? '******' : `¥${fmt(peakNw)}`}
            </div>
          </div>
          <div className="bg-white/15 rounded-xl p-3 backdrop-blur-sm">
            <div className="text-[11px] text-white/70 mb-1">年度平均</div>
            <div className="text-base font-semibold">
              {hideBalance ? '******' : `¥${fmt(avgNw)}`}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-gray-800">12 个月资产快照</span>
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: themeConfig.primary, opacity: 0.65 }}
            />
            已记录
          </div>
        </div>
        <p className="text-[11px] text-gray-400 mb-3">未记录月份不参与计算，绝不回填</p>

        <div className="grid grid-cols-4 gap-2">
          {monthSnapshots.map(({ month: m, hasRecord, nw, changePercent }) => {
            if (!hasRecord) {
              return (
                <div
                  key={m}
                  className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 p-2.5 text-center"
                >
                  <div className="text-[11px] font-medium text-gray-400 mb-1">{m}月</div>
                  <div className="text-[10px] text-gray-300">未记录</div>
                </div>
              );
            }

            const isCurrent  = m === lastRecordedMonth;
            const isPositive = changePercent >= 0;

            return (
<div
                  key={m}
                  className="rounded-xl p-2.5 text-center cursor-pointer active:scale-95 transition-transform select-none"
                  style={{
                    backgroundColor: isCurrent
                      ? `${themeConfig.primary}18`
                      : '#f0fdf4',
                    border: isCurrent
                      ? `1.5px solid ${themeConfig.primary}55`
                      : '1.5px solid transparent',
                  }}
                  onClick={() => onMonthClick(m, nw, changePercent)}
                >
                <div
                  className="text-[11px] font-semibold mb-1"
                  style={{ color: isCurrent ? themeConfig.primary : '#15803d' }}
                >
                  {m}月{isCurrent ? ' ·' : ''}
                </div>

                <div className="text-xs font-semibold text-gray-800">
                  {hideBalance ? '***' : `¥${fmtShort(nw)}`}
                </div>

                <div
                  className="text-[10px] mt-0.5"
                  style={{ color: isPositive ? '#16a34a' : '#dc2626' }}
                >
                  {isPositive ? '+' : ''}{changePercent.toFixed(1)}%
                </div>
              </div>
            );
          })}
        </div>

        {/* 颜色说明 — 放在 grid 外部，独立占满宽度 */}
        <div className="flex items-center justify-between mt-3 px-0.5">
          <span className="text-[10px] text-gray-400">跌幅大</span>
          <div className="flex items-center gap-0.5 flex-1 mx-3">
            {['#dc2626','#f87171','#fca5a5','#d1fae5','#86efac','#22c55e','#15803d'].map((c, i) => (
              <div
                key={i}
                className="h-2.5 flex-1 rounded-full"
                style={{ backgroundColor: c, opacity: i === 3 ? 0.25 : 1 }}
              />
            ))}
          </div>
          <span className="text-[10px] text-gray-400">涨幅大</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-800">
            年度归因{attrTop5.length > 0 ? ` TOP ${attrTop5.length}` : ''}
          </span>
          <button
            onClick={onEditAttribution}
            className="text-[11px] px-3 py-1 rounded-full border transition-colors hover:bg-gray-50"
            style={{
              color:       themeConfig.primary,
              borderColor: `${themeConfig.primary}40`,
            }}
          >
            {attrTop5.length > 0 ? '编辑归因' : '填写归因'}
          </button>
        </div>

        {attrTop5.length > 0 ? (
          <div className="space-y-3.5">
            {attrTop5.map(({ tag, label, emoji, totalChange, percent }) => {
              const isNeg    = totalChange < 0;
              const barColor = isNeg ? '#ef4444' : themeConfig.primary;
              return (
                <div key={tag} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-sm flex-shrink-0">
                    {emoji}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-sm text-gray-700 truncate">{label}</span>
                      <span
                        className="text-xs font-semibold ml-2 flex-shrink-0"
                        style={{ color: barColor }}
                      >
                        {isNeg ? '' : '+'}{percent.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width:           `${Math.min(Math.abs(percent), 100)}%`,
                          backgroundColor: barColor,
                          transition:      'width 0.4s ease',
                        }}
                      />
                    </div>
                  </div>

                  <span
                    className="text-xs font-medium flex-shrink-0 w-[72px] text-right"
                    style={{ color: isNeg ? '#ef4444' : '#16a34a' }}
                  >
                    {hideBalance
                      ? '***'
                      : `${isNeg ? '-' : '+'}¥${fmt(Math.abs(totalChange))}`
                    }
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-gray-400 text-center py-2">
            先记录月度归因，年度汇总会自动生成
          </p>
        )}
      </div>

      {accRanking.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="text-sm font-medium text-gray-800 mb-1">年度账户变动排行</div>
          <p className="text-[11px] text-gray-400 mb-3">
            变化额 = 年末余额 − 上年末；峰值取全年最高记录
          </p>

          <div className="divide-y divide-gray-50">
            {accRanking.slice(0, 8).map(
              ({ accountId, accountName, accountIcon, accountType, change, peakBal }) => {
                const isLiability = accountType === 'credit' || accountType === 'debt';
                const isPos       = change >= 0;

                return (
                  <div
                    key={accountId}
                    className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{
                        backgroundColor: isLiability
                          ? '#fef2f2'
                          : `${themeConfig.primary}15`,
                      }}
                    >
                      <Icon
                        name={accountIcon}
                        size={16}
                        color={isLiability ? '#ef4444' : themeConfig.primary}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {accountName}
                      </div>
                      <div className="text-[11px] text-gray-400">
                        峰值 {hideBalance ? '***' : `¥${fmt(peakBal)}`}
                      </div>
                    </div>

                    <div
                      className="text-sm font-semibold flex-shrink-0"
                      style={{ color: isPos ? '#16a34a' : '#dc2626' }}
                    >
                      {hideBalance
                        ? '***'
                        : `${isPos ? '+' : '-'}¥${fmt(Math.abs(change))}`
                      }
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </div>
      )}

      <div className="h-6" />
    </div>
  );
}

export function RecordPage({ onPageChange, hideBalance, toggleHideBalance, params }: RecordPageProps) {
  const now = new Date();
  const [recordMode, setRecordMode] = useState<RecordMode>(params?.mode || 'monthly');
  const [year, setYear] = useState(params?.year || now.getFullYear());
  const [month, setMonth] = useState(params?.month || now.getMonth() + 1);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [netWorth, setNetWorth] = useState(0);
  const [totalAssets, setTotalAssets] = useState(0);
  const [totalLiabilities, setTotalLiabilities] = useState(0);
  const [theme, setTheme] = useState<ThemeType>('blue');
  
  useEffect(() => {
    const settings = getSettings();
    setTheme(settings.theme || 'blue');
  }, []);
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false); // 年度记账年份选择器
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
  const [tagAmounts, setTagAmounts] = useState<Record<string, string>>({});
  // 记录用户已手动确认（失焦）的标签，锁定后不参与自动均分
  const [lockedTags, setLockedTags] = useState<Set<string>>(new Set());

  // 年度归因弹窗状态
  const [showYearlyAttributionDialog, setShowYearlyAttributionDialog] = useState(false);
  const [yearlySelectedTags, setYearlySelectedTags] = useState<YearlyAttributionTag[]>([]);
  const [yearlyAttributionNote, setYearlyAttributionNote] = useState('');
  const [yearlyKeyMonths, setYearlyKeyMonths] = useState<string[]>([]);

  // 月度归因弹窗
  const [monthAttrDialog, setMonthAttrDialog] = useState<{
    month: number;
    nw: number;
    changePercent: number;
  } | null>(null);

  const themeConfig = THEMES[theme];

  // 处理外部传入的参数：自动打开归因编辑弹窗
  useEffect(() => {
    if (params?.openAttributionEdit) {
      if (recordMode === 'monthly') {
        triggerPreview();
      } else {
        triggerYearlyAttribution();
      }
    }
  }, []);

  useEffect(() => {
    // 从全局 props 接收 hideBalance
    loadData();
    setHasChanges(false);
  }, [year, month, recordMode, hideBalance]);

  const loadData = () => {
    // 使用月度快照隔离机制：获取该月份应显示的账户列表
    const mergedAccounts = getAccountsForMonth(year, month).filter(a => !a.isHidden);
    
    setAccounts(mergedAccounts);

    if (recordMode === 'monthly') {
      const newBalances: Record<string, number> = {};
      for (const account of mergedAccounts) {
        // 使用继承机制获取余额：如果当月没有记录，继承最近月份的余额
        newBalances[account.id] = getAccountBalanceForMonth(account.id, year, month);
      }
      setBalances(newBalances);

      setNetWorth(calculateNetWorth(mergedAccounts, year, month));
      setTotalAssets(calculateTotalAssets(mergedAccounts, year, month));
      setTotalLiabilities(calculateTotalLiabilities(mergedAccounts, year, month));
    } else {
      const lastMonth = getLastRecordedMonth(year) || 12;
      const newBalances: Record<string, number> = {};
      for (const account of mergedAccounts) {
        newBalances[account.id] = getAccountBalanceForMonth(account.id, year, lastMonth);
      }
      setBalances(newBalances);

      const yearlyData = getYearlyNetWorth(mergedAccounts, year);
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

    const currentAccounts = getAccountsForMonth(year, month).filter(a => !a.isHidden);
    setTimeout(() => {
      setNetWorth(calculateNetWorth(currentAccounts, year, month));
      setTotalAssets(calculateTotalAssets(currentAccounts, year, month));
      setTotalLiabilities(calculateTotalLiabilities(currentAccounts, year, month));
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
    setNetWorth(calculateNetWorth(accounts, year, month));
    setTotalAssets(calculateTotalAssets(accounts, year, month));
    setTotalLiabilities(calculateTotalLiabilities(accounts, year, month));
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
    setNetWorth(calculateNetWorth(accounts, year, month));
    setTotalAssets(calculateTotalAssets(accounts, year, month));
    setTotalLiabilities(calculateTotalLiabilities(accounts, year, month));
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
    const lastAccounts = getAccountsForMonth(lastYear, lastMonthNum).filter(a => !a.isHidden);
    const currentAccounts = getAccountsForMonth(year, month).filter(a => !a.isHidden);
    const lastNW = calculateNetWorth(lastAccounts, lastYear, lastMonthNum);
    const currentNW = calculateNetWorth(currentAccounts, year, month);
    const changeAmt = currentNW - lastNW;
    const changePct = lastNW !== 0 ? (changeAmt / Math.abs(lastNW)) * 100 : 0;
    const level = calculateFluctuationLevel(changePct);

    // 计算账户资产变动 Top 3（按变动量排序）
    const allAccounts = getAllAccounts().filter(a => !a.isHidden);
    const accountChanges = allAccounts.map(account => {
      const currentRecord = getMonthlyRecord(account.id, year, month);
      const currentBalance = currentRecord ? currentRecord.balance : account.balance;
      const lastRecord = getMonthlyRecord(account.id, lastYear, lastMonthNum);
      const lastBalance = lastRecord ? lastRecord.balance : account.balance;
      return {
        accountId: account.id,
        accountName: account.name,
        accountIcon: account.icon,
        change: currentBalance - lastBalance,
      };
    });

    // 按变动量绝对值排序，取 Top 3
    const topAccountChanges = accountChanges
      .filter(a => a.change !== 0)
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
      .slice(0, 3);

    const existingAttribution = getMonthlyAttribution(year, month);
    if (existingAttribution) {
      setSelectedTags(existingAttribution.tags);
      setAttributionNote(existingAttribution.note || '');
      // 加载已有金额分配
      if (existingAttribution.tagAmounts) {
        const loaded: Record<string, string> = {};
        Object.entries(existingAttribution.tagAmounts).forEach(([tag, amount]) => {
          loaded[tag] = String(amount);
        });
        setTagAmounts(loaded);
      } else {
        setTagAmounts({});
      }
    } else {
      setSelectedTags([]);
      setAttributionNote('');
      setTagAmounts({});
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

    // 转换金额为数字
    const finalTagAmounts: Record<string, number> = {};
    let allocatedTotal = 0;
    selectedTags.forEach(tag => {
      const val = parseFloat(tagAmounts[tag] || '0');
      const amount = isNaN(val) ? 0 : val;
      finalTagAmounts[tag] = amount;
      allocatedTotal += amount;
    });

    // 如果未分配或总额不对，自动均分
    if (selectedTags.length > 0 && (allocatedTotal === 0 || Math.abs(allocatedTotal - Math.abs(previewData.change)) > 0.01)) {
      const equalAmount = Math.abs(previewData.change) / selectedTags.length;
      selectedTags.forEach(tag => {
        finalTagAmounts[tag] = equalAmount;
      });
    }

    saveMonthlyAttribution(
      year,
      month,
      previewData.change,
      previewData.changePercent,
      selectedTags,
      attributionNote || undefined,
      selectedTags.length > 0 ? finalTagAmounts : undefined
    );

    setShowPreviewDialog(false);
    setSelectedTags([]);
    setAttributionNote('');
    setTagAmounts({});
    setLockedTags(new Set());
    setHasChanges(false);
  };

  // 跳过归因
  const handleSkipAttribution = () => {
    setShowPreviewDialog(false);
    setSelectedTags([]);
    setAttributionNote('');
    setLockedTags(new Set());
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
      // 智能预填充：从月度归因数据生成
      const monthlyAttributions = getMonthlyAttributionsByYear(year);
      if (monthlyAttributions.length > 0) {
        const { topTags, summaryText } = generateYearlyAttributionFromMonthly(monthlyAttributions);
        setYearlySelectedTags(topTags);
        setYearlyAttributionNote(summaryText);
      } else {
        setYearlySelectedTags([]);
        setYearlyAttributionNote('');
      }
      setYearlyKeyMonths([]);
    }
    setShowYearlyAttributionDialog(true);
  };

  // 从月度归因生成年度归因（智能预填充）- 按累计影响金额排序，100%同步月度归因的中文名称
  const generateYearlyAttributionFromMonthly = (monthlyAttributions: any[]) => {
    // 统计标签出现频次和金额贡献，使用月度归因的中文名称
    const tagStats: Record<string, { count: number; totalChange: number; months: number[]; label: string; emoji: string }> = {};

    monthlyAttributions.forEach(attr => {
      attr.tags.forEach((tag: string) => {
        if (!tagStats[tag]) {
          tagStats[tag] = { 
            count: 0, 
            totalChange: 0, 
            months: [], 
            label: getAttributionTagLabel(tag as any), 
            emoji: getAttributionTagEmoji(tag as any) 
          };
        }
        tagStats[tag].count++;
        // 优先精确分配金额，否则按标签数均分，防止重复计入
        const tagAmount = attr.tagAmounts?.[tag] ?? (attr.change / Math.max(attr.tags.length, 1));
        tagStats[tag].totalChange += tagAmount;
        if (!tagStats[tag].months.includes(attr.month)) {
          tagStats[tag].months.push(attr.month);
        }
      });
    });

    // 按金额贡献排序，取 TOP3
    const sortedTags = Object.entries(tagStats)
      .sort((a, b) => b[1].totalChange - a[1].totalChange)
      .slice(0, 3);

    const topTags = sortedTags.map(([tag]) => tag as YearlyAttributionTag);

    // 生成汇总说明 - 使用月度归因的中文名称，正确体现金额正负
    const summaryParts = sortedTags.map(([, stats]) => {
      const sign = stats.totalChange >= 0 ? '+' : '-';
      return `${stats.emoji}${stats.label}(${stats.count}次，累计${sign}¥${formatAmountNoSymbol(Math.abs(stats.totalChange))})`;
    });
    const summaryText = `本年度月度归因汇总：${summaryParts.join('、')}`;

    return { topTags, summaryText, tagStats };
  };

  // 计算年度账户变化 Top 3
  const getYearlyAccountChanges = () => {
    const allAccounts = getAllAccounts().filter(a => !a.isHidden);
    const lastMonth = getLastRecordedMonth(year) || 12;

    const accountChanges = allAccounts.map(account => {
      // 年初余额（上年度12月）
      const lastRecord = getMonthlyRecord(account.id, year - 1, 12);
      const lastBalance = lastRecord ? lastRecord.balance : account.balance;
      // 年末余额（今年最后有记录的月份）
      const currentRecord = getMonthlyRecord(account.id, year, lastMonth);
      const currentBalance = currentRecord ? currentRecord.balance : account.balance;
      return {
        accountId: account.id,
        accountName: account.name,
        accountIcon: account.icon,
        change: currentBalance - lastBalance,
      };
    });

    return accountChanges
      .filter(a => a.change !== 0)
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
      .slice(0, 3);
  };

  // 从月度生成年度归因 - 按累计影响金额排序，使用月度归因的中文名称
  const generateYearlyFromMonthly = () => {
    const monthlyAttributions = getMonthlyAttributionsByYear(year);
    if (monthlyAttributions.length === 0) return;

    const tagStats: Record<string, { totalChange: number; count: number; label: string; emoji: string }> = {};
    monthlyAttributions.forEach(attr => {
      attr.tags.forEach(tag => {
        if (!tagStats[tag]) {
          tagStats[tag] = { 
            totalChange: 0, 
            count: 0, 
            label: getAttributionTagLabel(tag), 
            emoji: getAttributionTagEmoji(tag) 
          };
        }
        // 精确分配或均分，防止多标签重复累计
        const tagAmount = attr.tagAmounts?.[tag] ?? (attr.change / Math.max(attr.tags.length, 1));
        tagStats[tag].totalChange += tagAmount;
        tagStats[tag].count += 1;
      });
    });

    const sortedTags = Object.entries(tagStats)
      .sort((a, b) => b[1].totalChange - a[1].totalChange)
      .slice(0, 3)
      .map(([tag]) => tag as YearlyAttributionTag);

    setYearlySelectedTags(sortedTags);
  };

  // 保存年度归因
  const handleSaveYearlyAttribution = () => {
    const lastYearAccounts = getAccountsForMonth(year - 1, 12).filter(a => !a.isHidden);
    const lastYearNetWorth = calculateNetWorth(lastYearAccounts, year - 1, 12);
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
    const lastMonthAccounts = getAccountsForMonth(lastYear, lastMonthNum).filter(a => !a.isHidden);
    lastNetWorth = calculateNetWorth(lastMonthAccounts, lastYear, lastMonthNum);
  } else {
    const lastYearAccounts = getAccountsForMonth(year - 1, 12).filter(a => !a.isHidden);
    lastNetWorth = calculateNetWorth(lastYearAccounts, year - 1, 12);
  }
  const change = netWorth - lastNetWorth;
  const changePercent = lastNetWorth !== 0 ? (change / Math.abs(lastNetWorth)) * 100 : 0;

  return (
    <div className="pb-24 min-h-screen" style={{ backgroundColor: themeConfig.bgLight }}>
      {/* 标题栏 - fixed 定位，与其他页面保持一致，不受父级 overflow 影响 */}
      <header className="px-4 py-3 flex justify-between items-center fixed top-0 left-0 right-0 max-w-md mx-auto z-50 shadow-sm rounded-b-2xl" style={{ backgroundColor: themeConfig.primary }}>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="text-white" onClick={() => onPageChange('home')}>
            <ArrowLeft size={20} />
          </Button>

          <div className="relative">
            <button
              className="flex items-center gap-1.5 text-white bg-white/20 hover:bg-white/30 rounded-full px-3 py-1.5 transition-colors font-bold"
              onClick={() => setShowModeDropdown(!showModeDropdown)}
            >
              {recordMode === 'monthly' ? '月度记账' : '年度记账'}
              <ChevronDown size={16} className={`transition-transform ${showModeDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showModeDropdown && (
              <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50 min-w-[140px] animate-in fade-in zoom-in-95 duration-200">
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

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-white bg-white/20 hover:bg-white/30 rounded-full"
            onClick={toggleHideBalance}
          >
            {hideBalance ? <EyeOff size={16} /> : <Eye size={16} />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-white bg-white/20 hover:bg-white/30 rounded-full"
            onClick={() => onPageChange('record-logs', { year, month, mode: recordMode })}
          >
            <History size={16} />
            <span className="ml-1">记录</span>
          </Button>
        </div>
      </header>

      {/* 占位元素，防止内容被固定标题栏遮挡 */}
      <div className="h-14"></div>

      <div className="p-3 space-y-3">
        {/* 月份/年份选择器 - 紧凑版 */}
        <Card className="bg-white shadow-sm">
          <CardContent className="p-2">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={goToPrev} className="hover:bg-gray-100 h-8 w-8">
                <ChevronLeft size={18} />
              </Button>

              {recordMode === 'monthly' ? (
                <button
                  className="flex items-center gap-1.5 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-all"
                  onClick={() => setShowMonthPicker(true)}
                >
                  <span className="text-lg font-bold text-gray-900">{formatMonth(year, month)}</span>
                  <ChevronDown size={14} className="text-gray-400" />
                </button>
              ) : (
                <button
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                  onClick={() => setShowYearPicker(true)}
                >
                  <span className="text-lg font-bold text-gray-900">{year}年</span>
                  <ChevronDown size={14} className="text-gray-400" />
                </button>
              )}

              <Button variant="ghost" size="icon" onClick={goToNext} className="hover:bg-gray-100 h-8 w-8">
                <ChevronRight size={18} />
              </Button>
            </div>
          </CardContent>
        </Card>

{/* 净资产汇总 - 月度模式显示 */}
        {recordMode === 'monthly' && (
          <Card
            className="text-white shadow-lg"
            style={{ background: `linear-gradient(135deg, ${themeConfig.gradientFrom} 0%, ${themeConfig.gradientTo} 100%)` }}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/80 text-xs font-medium">
                  本月净资产
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-sm font-medium ${
                  change >= 0 ? 'text-white' : 'text-red-100'
                }`}>
                  较上月 {hideBalance ? '******' : (
                    <>
                      {change >= 0 ? '+' : ''}¥{formatAmountNoSymbol(change)}
                      <span className="ml-0.5 opacity-80">
                        ({change >= 0 ? '+' : ''}{changePercent.toFixed(1)}%)
                      </span>
                    </>
                  )}
                </span>
              </div>

              <div className="text-2xl font-bold mb-3 tracking-tight">¥{formatHiddenAmount(netWorth, hideBalance)}</div>

              <div className="mt-3 pt-3 border-t border-white/20 grid grid-cols-2 gap-3">
                <div className="bg-white/10 rounded-lg p-2 backdrop-blur-sm">
                  <div className="text-xs text-white/70 mb-0.5">总资产</div>
                  <div className="font-semibold text-base">¥{formatHiddenAmount(totalAssets, hideBalance)}</div>
                </div>
                <div className="bg-white/10 rounded-lg p-2 backdrop-blur-sm">
                  <div className="text-xs text-white/70 mb-0.5">负资产</div>
                  <div className="font-semibold text-base">¥{formatHiddenAmount(totalLiabilities, hideBalance)}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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

{/* 年度/月度账户列表 */}
        {recordMode === 'yearly' ? (
          <YearlyDashboard
            year={year}
            netWorth={netWorth}
            lastNetWorth={lastNetWorth}
            hideBalance={hideBalance}
            themeConfig={themeConfig}
            onEditAttribution={triggerYearlyAttribution}
            onMonthClick={(m, nw, changePercent) =>
              setMonthAttrDialog({ month: m, nw, changePercent })
            }
          />
        ) : (
          <div className="space-y-3">
            <div className="flex justify-between items-center px-1">
              <h2 className="text-sm font-medium text-gray-500">账户余额</h2>
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
                    const isCredit   = account.type === 'credit';
                    const isDebt     = account.type === 'debt';
                    const balance    = balances[account.id] || 0;
                    const isEditing  = editingAccount === account.id;

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
                              style={{
                                backgroundColor: isCredit || isDebt
                                  ? undefined
                                  : `${themeConfig.primary}15`,
                              }}
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
                                  onChange={e => setEditValue(e.target.value)}
                                  className="w-32 h-10 pl-7 text-sm font-medium"
                                  autoFocus
                                  onKeyDown={e => {
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
                                  isCredit
                                    ? balance > 0 ? 'text-red-500' : 'text-green-600'
                                    : isDebt ? 'text-red-500' : 'text-gray-900'
                                }`}
                              >
                                <div className="text-base font-medium">
                                  ¥{formatHiddenAmount(
                                    isDebt ? Math.abs(balance) : isCredit ? Math.abs(balance) : balance,
                                    hideBalance
                                  )}
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
        )}

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
          setTagAmounts({});
          setLockedTags(new Set());
        }
      }}>
        <DialogContent className="max-w-md overflow-y-auto" style={{ maxHeight: 'min(90dvh, 90vh)' }}>
          <DialogHeader>
            <DialogTitle className="text-xl">{formatMonth(year, month)} 记账预览</DialogTitle>
          </DialogHeader>

          {previewData && (
            <div className="py-4 space-y-5">
              {/* 变化摘要卡片 - 使用主题色 */}
              <div
                className="rounded-xl p-5 text-white"
                style={{
                  background: `linear-gradient(135deg, ${themeConfig.gradientFrom} 0%, ${themeConfig.gradientTo} 100%)`
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

              {/* 账户资产变动 Top 3 */}
              {previewData.topAccountChanges.length > 0 && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-sm font-medium text-gray-700 mb-3">账户资产变动TOP3</div>
                  <div className="space-y-2">
                    {previewData.topAccountChanges.map((item) => (
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
                          {item.change >= 0 ? '+' : ''}¥{hideBalance ? '******' : formatAmountNoSymbol(Math.abs(item.change))}
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

                {/* 原因选择 - 分类折叠面板 */}
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-3">
                    {previewData.fluctuationLevel === 'abnormal' ? (
                      <span className="text-red-600">* 请选择归因原因（必选）</span>
                    ) : '选择归因原因（可选）'}
                  </div>

                  {/* 已选标签快捷栏 */}
                  {selectedTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3 p-2 bg-gray-50 rounded-xl">
                      {selectedTags.map(tagId => {
                        const tag = getAllAttributionTagOptions().find(t => t.id === tagId);
                        if (!tag) return null;
                        return (
                          <span
                            key={tagId}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-white border border-gray-200 shadow-sm"
                          >
                            <span>{tag.emoji}</span>
                            <span className="text-gray-700">{tag.label}</span>
                            <button
                              onClick={() => setSelectedTags(prev => prev.filter(t => t !== tagId))}
                              className="ml-0.5 w-4 h-4 rounded-full bg-gray-100 hover:bg-red-100 text-gray-400 hover:text-red-500 flex items-center justify-center transition-colors"
                            >
                              ×
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* 金额分配 */}
                  {selectedTags.length > 1 && previewData && (
                    <div className="bg-gray-50 rounded-xl p-3 mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">金额分配</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">
                            总变动: {previewData.change >= 0 ? '+' : ''}¥{formatAmountNoSymbol(Math.abs(previewData.change))}
                          </span>
                          <button
                            onClick={() => {
                              const equal = Math.abs(previewData.change) / selectedTags.length;
                              const next: Record<string, string> = {};
                              selectedTags.forEach(tag => { next[tag] = String(equal.toFixed(2)); });
                              setTagAmounts(next);
                              // 均分时清空所有锁，让用户重新从平均基础上调整
                              setLockedTags(new Set());
                            }}
                            className="text-xs px-2 py-0.5 rounded-md bg-white border border-gray-200 text-gray-600 hover:bg-gray-100"
                          >
                            均分
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {selectedTags.map(tagId => {
                          const tag = getAllAttributionTagOptions().find(t => t.id === tagId);
                          if (!tag) return null;
                          const inputVal = tagAmounts[tagId] || '';
                          const isLocked = lockedTags.has(tagId);
                          return (
                            <div key={tagId} className="flex items-center gap-2">
                              <span className="text-xs flex-shrink-0 w-20 truncate">{tag.emoji} {tag.label}</span>
                              <div className="relative flex-1">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">¥</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={inputVal}
                                  onChange={e => {
                                    // onChange 只更新当前字段，不做联动
                                    setTagAmounts(prev => ({ ...prev, [tagId]: e.target.value }));
                                  }}
                                  onFocus={() => {
                                    // 获得焦点时解锁，允许用户重新调整
                                    setLockedTags(prev => {
                                      const next = new Set(prev);
                                      next.delete(tagId);
                                      return next;
                                    });
                                  }}
                                  onBlur={e => {
                                    const newVal = e.target.value;
                                    const total = Math.abs(previewData!.change);
                                    const currentNum = parseFloat(newVal);
                                    if (isNaN(currentNum) || selectedTags.length < 2) return;

                                    // 1. 将当前标签标记为已锁定
                                    setLockedTags(prev => new Set([...prev, tagId]));

                                    // 2. 找出除自身外 未锁定 的标签（这些才参与自动均分）
                                    const unlockedOthers = selectedTags.filter(
                                      t => t !== tagId && !lockedTags.has(t)
                                    );

                                    // 3. 计算所有已锁定标签（不含自身）已占用的金额
                                    const lockedOtherTotal = selectedTags
                                      .filter(t => t !== tagId && lockedTags.has(t))
                                      .reduce((sum, t) => {
                                        const v = parseFloat(tagAmounts[t] || '0');
                                        return sum + (isNaN(v) ? 0 : v);
                                      }, 0);

                                    // 4. 剩余金额 = 总额 - 当前 - 已锁定他人
                                    const remaining = total - currentNum - lockedOtherTotal;

                                    // 5. 若无未锁定标签或已平衡，不做联动
                                    if (unlockedOthers.length === 0 || Math.abs(remaining) < 0.01) return;

                                    // 6. 将剩余均分给未锁定标签
                                    const perTag = remaining / unlockedOthers.length;
                                    const next: Record<string, string> = { ...tagAmounts, [tagId]: newVal };
                                    unlockedOthers.forEach(t => {
                                      next[t] = String(perTag.toFixed(2));
                                    });
                                    setTagAmounts(next);
                                  }}
                                  placeholder="0.00"
                                  className={`w-full h-8 pl-5 pr-2 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-400 transition-colors ${
                                    isLocked
                                      ? 'border-sky-300 bg-sky-50 text-sky-700'
                                      : 'border-gray-200'
                                  }`}
                                />
                              </div>
                              {/* 锁定状态指示 */}
                              <span
                                className={`text-[10px] flex-shrink-0 w-6 text-center transition-opacity ${isLocked ? 'opacity-100' : 'opacity-0'}`}
                                title="已锁定，不参与自动均分"
                              >
                                🔒
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      {/* 剩余提示 */}
                      {(() => {
                        const total = Math.abs(previewData.change);
                        const allocated = selectedTags.reduce((sum, tag) => {
                          const v = parseFloat(tagAmounts[tag] || '0');
                          return sum + (isNaN(v) ? 0 : v);
                        }, 0);
                        const remaining = total - allocated;
                        if (Math.abs(remaining) > 0.01) {
                          return (
                            <div className={`text-xs mt-1.5 ${remaining > 0 ? 'text-amber-600' : 'text-red-500'}`}>
                              {remaining > 0
                                ? `⚠ 还剩 ¥${formatAmountNoSymbol(remaining)} 未分配`
                                : `⚠ 超出 ¥${formatAmountNoSymbol(Math.abs(remaining))}`}
                            </div>
                          );
                        }
                        return (
                          <div className="text-xs text-green-600 mt-1.5">✓ 已全部分配</div>
                        );
                      })()}
                    </div>
                  )}

                {/* 分类折叠面板 */}
                <div className="space-y-2">
                  {(() => {
                    const allTags = getAllAttributionTagOptions();
                    const categories = [
                      { id: 'income', label: '收入类', emoji: '📥', color: '#22c55e', bgColor: '#f0fdf4', borderColor: '#bbf7d0' },
                      { id: 'expense', label: '支出/流出类', emoji: '📤', color: '#ef4444', bgColor: '#fef2f2', borderColor: '#fecaca' },
                      { id: 'adjust', label: '调整类', emoji: '🔄', color: '#3b82f6', bgColor: '#eff6ff', borderColor: '#bfdbfe' },
                      { id: 'other', label: '其他', emoji: '📋', color: '#6b7280', bgColor: '#f9fafb', borderColor: '#e5e7eb' },
                    ] as const;

                    return categories.map(cat => {
                      const catTags = allTags.filter(t => t.category === cat.id);
                      if (catTags.length === 0) return null;

                      const selectedCount = catTags.filter(t => selectedTags.includes(t.id as AttributionTag)).length;

                      return (
                        <div key={cat.id} className="border border-gray-100 rounded-xl overflow-hidden">
                          <button
                            onClick={() => {
                              const key = `monthly-cat-${cat.id}`;
                              const el = document.getElementById(key);
                              const icon = document.getElementById(`monthly-icon-${cat.id}`);
                              if (el) {
                                const isOpen = el.style.maxHeight !== '0px' && el.style.maxHeight !== '';
                                el.style.maxHeight = isOpen ? '0px' : `${el.scrollHeight}px`;
                                el.style.opacity = isOpen ? '0' : '1';
                                if (icon) icon.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
                              }
                            }}
                            className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-7 h-7 rounded-lg flex items-center justify-center text-sm" style={{ backgroundColor: cat.bgColor }}>
                                {cat.emoji}
                              </span>
                              <span className="text-sm font-medium text-gray-700">{cat.label}</span>
                              {selectedCount > 0 && (
                                <span className="px-1.5 py-0.5 rounded-full text-[10px] text-white font-medium" style={{ backgroundColor: cat.color }}>
                                  {selectedCount}
                                </span>
                              )}
                            </div>
                            <svg
                              id={`monthly-icon-${cat.id}`}
                              className="w-4 h-4 text-gray-400 transition-transform duration-300"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          <div
                            id={`monthly-cat-${cat.id}`}
                            className="overflow-hidden transition-all duration-300"
                            style={{ maxHeight: cat.id === 'income' ? `${catTags.length * 48 + 16}px` : '0px', opacity: cat.id === 'income' ? 1 : 0 }}
                          >
                            <div className="p-2 grid grid-cols-2 gap-1.5">
                              {catTags.map(tag => {
                                const isSelected = selectedTags.includes(tag.id as AttributionTag);
                                return (
                                  <button
                                    key={tag.id}
                                    onClick={() => {
                                      setSelectedTags(prev =>
                                        isSelected
                                          ? prev.filter(t => t !== tag.id)
                                          : [...prev, tag.id as AttributionTag]
                                      );
                                      // 取消选中时同步解锁，下次重新选中该标签应从空白开始
                                      if (isSelected) {
                                        setLockedTags(prev => {
                                          const next = new Set(prev);
                                          next.delete(tag.id);
                                          return next;
                                        });
                                      }
                                    }}
                                    className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all duration-200 border-2 text-left ${
                                      isSelected
                                        ? 'shadow-sm'
                                        : 'bg-white border-gray-100 hover:border-gray-200'
                                    }`}
                                    style={{
                                      backgroundColor: isSelected ? cat.bgColor : undefined,
                                      borderColor: isSelected ? cat.borderColor : undefined,
                                      color: isSelected ? cat.color : '#4b5563',
                                    }}
                                  >
                                    <span className="text-sm flex-shrink-0">{tag.emoji}</span>
                                    <span className="truncate flex-1">{tag.label}</span>
                                    {isSelected && <Check size={12} className="flex-shrink-0" style={{ color: cat.color }} />}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* 备注输入 */}
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">详细备注（可选）</div>
                <textarea
                  value={attributionNote}
                  onChange={(e) => setAttributionNote(e.target.value)}
                  onFocus={(e) => {
                    // 使用 visualViewport 感知键盘弹出，滚动弹窗至备注区域可见
                    const el = e.currentTarget;
                    const scroll = () => {
                      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    };
                    if (window.visualViewport) {
                      // 等待键盘动画完成后再滚动（iOS ≈ 300ms，Android ≈ 200ms）
                      const vv = window.visualViewport;
                      const onResize = () => {
                        scroll();
                        vv.removeEventListener('resize', onResize);
                      };
                      vv.addEventListener('resize', onResize);
                      // 兜底：若 visualViewport 不触发 resize，300ms 后直接滚动
                      setTimeout(scroll, 350);
                    } else {
                      setTimeout(scroll, 350);
                    }
                  }}
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

      {/* 年度记账年份选择器 */}
      <Dialog open={showYearPicker} onOpenChange={setShowYearPicker}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>选择年份</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
              {Array.from({ length: 50 }, (_, i) => {
                const y = new Date().getFullYear() - 20 + i;
                return (
                  <button
                    key={y}
                    onClick={() => {
                      setYear(y);
                      setShowYearPicker(false);
                      setHasChanges(false);
                    }}
                    className={`p-3 rounded-lg text-sm transition-all duration-200 ${
                      year === y
                        ? 'text-white shadow-md scale-105'
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                    style={{ backgroundColor: year === y ? themeConfig.primary : undefined }}
                  >
                    {y}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" onClick={() => setShowYearPicker(false)}>
              取消
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 年度归因对话框 */}
      <Dialog open={showYearlyAttributionDialog} onOpenChange={setShowYearlyAttributionDialog}>
        <DialogContent className="max-w-md overflow-y-auto" style={{ maxHeight: 'min(90dvh, 90vh)' }}>
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
              <div className="flex items-center justify-between mb-4">
                <span className="text-white/80 text-sm">净资产变化</span>
              </div>

              <div className="flex items-center justify-between mb-4">
                <div className="text-center">
                  <div className="text-xs text-white/70 mb-1">年初</div>
                  <div className="text-lg font-bold">
                    {hideBalance ? '******' : `¥${formatAmountNoSymbol(lastNetWorth)}`}
                  </div>
                </div>
                <div className="text-2xl text-white/50">→</div>
                <div className="text-center">
                  <div className="text-xs text-white/70 mb-1">年末</div>
                  <div className="text-lg font-bold">
                    {hideBalance ? '******' : `¥${formatAmountNoSymbol(netWorth)}`}
                  </div>
                </div>
              </div>

              <div className="text-center pt-3 border-t border-white/20">
                <span className="text-2xl font-bold">
                  {hideBalance ? '******' : (
                    <>
                      {change >= 0 ? '+' : ''}¥{formatAmountNoSymbol(change)}
                      <span className="text-base ml-2 opacity-80">
                        ({change >= 0 ? '+' : ''}{changePercent.toFixed(1)}%)
                      </span>
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* 波动进度条 */}
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex justify-between text-xs text-gray-500 mb-2 font-medium">
                <span>正常</span><span>需关注</span><span>异常</span>
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
                    left: `${Math.min(Math.max(Math.abs(changePercent), 0), 100)}%`,
                  }}
                >
                  <div className="w-4 h-4 bg-white border-2 rounded-full shadow-md -mt-0.5" style={{ borderColor: themeConfig.primary }} />
                </div>
              </div>
              <div className="text-center text-xs text-gray-400 mt-3">
                当前波动: {Math.abs(changePercent).toFixed(1)}%
              </div>
            </div>

            {/* 变化最大的账户 TOP3 */}
            {(() => {
              const yearlyChanges = getYearlyAccountChanges();
              if (yearlyChanges.length === 0) {
                return (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="text-sm font-medium text-gray-700 mb-2">变化最大的账户 TOP3</div>
                    <div className="text-xs text-gray-400 text-center py-4">暂无账户变动数据</div>
                  </div>
                );
              }
              return (
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-sm font-medium text-gray-700 mb-3">变化最大的账户 TOP3</div>
                  <div className="space-y-2">
                    {yearlyChanges.map((item) => (
                      <div
                        key={item.accountId}
                        className="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => {
                          setShowYearlyAttributionDialog(false);
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
                          {item.change >= 0 ? '+' : ''}¥{hideBalance ? '******' : formatAmountNoSymbol(Math.abs(item.change))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* 归因排行 TOP3 - 100%同步月度归因的中文名称 */}
            {(() => {
              const monthlyAttributions = getMonthlyAttributionsByYear(year);
              if (monthlyAttributions.length === 0) return null;

              const { tagStats } = generateYearlyAttributionFromMonthly(monthlyAttributions);
              const sortedTags = Object.entries(tagStats)
                .sort((a, b) => b[1].totalChange - a[1].totalChange)
                .slice(0, 3);

              if (sortedTags.length === 0) return null;

              return (
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-sm font-medium text-gray-700 mb-3">归因排行 TOP3</div>
                  <div className="space-y-2">
                    {sortedTags.map(([tag, stats], index) => (
                      <div key={tag} className="flex items-center justify-between p-2 bg-white rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-gray-100 text-xs flex items-center justify-center font-medium">
                            {index + 1}
                          </span>
                          <span className="text-sm">{stats.emoji} {stats.label}</span>
                          <span className="text-xs text-gray-400">{stats.months.length}个月</span>
                        </div>
                        <span className={`text-sm font-medium ${stats.totalChange >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {stats.totalChange >= 0 ? '+' : ''}¥{hideBalance ? '******' : formatAmountNoSymbol(Math.abs(stats.totalChange))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

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

            {/* 年度标签选择 - 分类折叠面板 */}
            <div>
              <div className="text-sm font-medium text-gray-700 mb-3">选择原因（可选）</div>

              {/* 已选标签快捷栏 */}
              {yearlySelectedTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3 p-2 bg-gray-50 rounded-xl">
                  {yearlySelectedTags.map(tagId => {
                    const tag = getAllYearlyTagOptions().find(t => t.id === tagId);
                    if (!tag) return null;
                    return (
                      <span
                        key={tagId}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-white border border-gray-200 shadow-sm"
                      >
                        <span>{tag.emoji}</span>
                        <span className="text-gray-700">{tag.label}</span>
                        <button
                          onClick={() => setYearlySelectedTags(prev => prev.filter(t => t !== tagId))}
                          className="ml-0.5 w-4 h-4 rounded-full bg-gray-100 hover:bg-red-100 text-gray-400 hover:text-red-500 flex items-center justify-center transition-colors"
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              {/* 分类折叠面板 */}
              <div className="space-y-2">
                {(() => {
                  const allTags = getAllYearlyTagOptions();
                  const categories = [
                    { id: 'income', label: '收入类', emoji: '📥', color: '#22c55e', bgColor: '#f0fdf4', borderColor: '#bbf7d0' },
                    { id: 'expense', label: '支出/流出类', emoji: '📤', color: '#ef4444', bgColor: '#fef2f2', borderColor: '#fecaca' },
                    { id: 'adjust', label: '调整类', emoji: '🔄', color: '#3b82f6', bgColor: '#eff6ff', borderColor: '#bfdbfe' },
                    { id: 'other', label: '其他', emoji: '📋', color: '#6b7280', bgColor: '#f9fafb', borderColor: '#e5e7eb' },
                  ] as const;

                  return categories.map(cat => {
                    const catTags = allTags.filter(t => t.category === cat.id);
                    if (catTags.length === 0) return null;

                    const selectedCount = catTags.filter(t => yearlySelectedTags.includes(t.id as YearlyAttributionTag)).length;

                    return (
                      <div key={cat.id} className="border border-gray-100 rounded-xl overflow-hidden">
                        <button
                          onClick={() => {
                            const key = `yearly-cat-${cat.id}`;
                            const el = document.getElementById(key);
                            const icon = document.getElementById(`yearly-icon-${cat.id}`);
                            if (el) {
                              const isOpen = el.style.maxHeight !== '0px' && el.style.maxHeight !== '';
                              el.style.maxHeight = isOpen ? '0px' : `${el.scrollHeight}px`;
                              el.style.opacity = isOpen ? '0' : '1';
                              if (icon) icon.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
                            }
                          }}
                          className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-lg flex items-center justify-center text-sm" style={{ backgroundColor: cat.bgColor }}>
                              {cat.emoji}
                            </span>
                            <span className="text-sm font-medium text-gray-700">{cat.label}</span>
                            {selectedCount > 0 && (
                              <span className="px-1.5 py-0.5 rounded-full text-[10px] text-white font-medium" style={{ backgroundColor: cat.color }}>
                                {selectedCount}
                              </span>
                            )}
                          </div>
                          <svg
                            id={`yearly-icon-${cat.id}`}
                            className="w-4 h-4 text-gray-400 transition-transform duration-300"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        <div
                          id={`yearly-cat-${cat.id}`}
                          className="overflow-hidden transition-all duration-300"
                          style={{ maxHeight: cat.id === 'income' ? `${catTags.length * 48 + 16}px` : '0px', opacity: cat.id === 'income' ? 1 : 0 }}
                        >
                          <div className="p-2 grid grid-cols-2 gap-1.5">
                            {catTags.map(tag => {
                              const isSelected = yearlySelectedTags.includes(tag.id as YearlyAttributionTag);
                              return (
                                <button
                                  key={tag.id}
                                  onClick={() => handleYearlyTagToggle(tag.id as YearlyAttributionTag)}
                                  className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all duration-200 border-2 text-left ${
                                    isSelected
                                      ? 'shadow-sm'
                                      : 'bg-white border-gray-100 hover:border-gray-200'
                                  }`}
                                  style={{
                                    backgroundColor: isSelected ? cat.bgColor : undefined,
                                    borderColor: isSelected ? cat.borderColor : undefined,
                                    color: isSelected ? cat.color : '#4b5563',
                                  }}
                                >
                                  <span className="text-sm flex-shrink-0">{tag.emoji}</span>
                                  <span className="truncate flex-1">{tag.label}</span>
                                  {isSelected && <Check size={12} className="flex-shrink-0" style={{ color: cat.color }} />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
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

          <DialogFooter className="flex-row gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setShowYearlyAttributionDialog(false)}
              className="flex-1 h-11 bg-white hover:bg-gray-50"
            >
              取消
            </Button>
            <Button
              onClick={handleSaveYearlyAttribution}
              className="flex-1 h-11 font-semibold text-white"
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

      {/* 月度快照归因弹窗 — 使用完整 MonthlyAttributionDetail 组件 */}
      {monthAttrDialog && (() => {
        const mAttr = getMonthlyAttribution(year, monthAttrDialog.month);
        const isPos = monthAttrDialog.changePercent >= 0;

        // 有归因记录 → 展示完整归因详情
        if (mAttr) {
          return (
            <MonthlyAttributionDetail
              year={year}
              month={monthAttrDialog.month}
              hideBalance={hideBalance}
              theme={theme}
              onClose={() => setMonthAttrDialog(null)}
              onEdit={() => {
                const targetMonth = monthAttrDialog.month;
                setMonthAttrDialog(null);
                // 跳转回月度记账模式并自动打开归因编辑
                onPageChange('record', {
                  year,
                  month: targetMonth,
                  mode: 'monthly' as RecordMode,
                  openAttributionEdit: true,
                });
              }}
            />
          );
        }

        // 无归因记录 → 展示简单快照 + 引导填写
        return (
          <Dialog open={true} onOpenChange={() => setMonthAttrDialog(null)}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>{year}年{monthAttrDialog.month}月 · 资产快照</DialogTitle>
                <DialogDescription>
                  净资产{' '}
                  <span className="font-semibold text-gray-800">
                    {hideBalance ? '¥ ******' : `¥${formatAmountNoSymbol(monthAttrDialog.nw)}`}
                  </span>
                  <span className={`ml-2 font-semibold ${isPos ? 'text-green-600' : 'text-red-500'}`}>
                    {isPos ? '+' : ''}{monthAttrDialog.changePercent.toFixed(1)}%
                  </span>
                </DialogDescription>
              </DialogHeader>
              <div className="py-6 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto text-2xl">
                  📝
                </div>
                <p className="text-sm text-gray-400">该月暂无归因记录</p>
                <Button
                  className="w-full text-white"
                  style={{ backgroundColor: themeConfig.primary }}
                  onClick={() => {
                    const targetMonth = monthAttrDialog.month;
                    setMonthAttrDialog(null);
                    onPageChange('record', {
                      year,
                      month: targetMonth,
                      mode: 'monthly' as RecordMode,
                      openAttributionEdit: true,
                    });
                  }}
                >
                  前往该月填写归因
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
  );
}
