import { useState, useRef, useCallback, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Droplets, Landmark, TrendingUp, Shield, Tag } from 'lucide-react';
import type { Account } from '@/types';
import { saveAccountAssetCategory, getAccountBalanceForMonth, getCurrentYearMonth, getSettings, convertToBaseCurrency } from '@/lib/storage';
import { Icon } from '@/components/Icon';
import { getCurrencyConfig } from '@/types';

interface QuickClassifyFlowProps {
  unclassifiedAccounts: Account[];
  primaryColor: string;
  onComplete: () => void;
  onDismiss: () => void;
  /** 允许重新分类已分类的账户 */
  reclassify?: boolean;
  /** 所有账户（reclassify 模式下使用） */
  allAccounts?: Account[];
  hideBalance?: boolean;
  baseCurrencySymbol?: string;
}

const CATEGORIES = [
  { key: 'cash' as const, label: '现金/应急', IconComp: Droplets, desc: '日常流动资金、应急储备', color: '#22c55e', hint: '随时可取' },
  { key: 'stable' as const, label: '稳健储蓄', IconComp: Landmark, desc: '银行存款、低风险理财', color: '#0ea5e9', hint: '追求稳定' },
  { key: 'invest' as const, label: '投资增值', IconComp: TrendingUp, desc: '股票、基金、权益类', color: '#a855f7', hint: '追求收益' },
  { key: 'insure' as const, label: '保险保障', IconComp: Shield, desc: '保险、年金等保障类', color: '#f59e0b', hint: '风险兜底' },
];

const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map(c => [c.key, c]));

export function QuickClassifyFlow({ unclassifiedAccounts, primaryColor, onComplete, onDismiss, reclassify = false, allAccounts = [], hideBalance = false }: QuickClassifyFlowProps) {
  if (reclassify && allAccounts.length > 0) {
    return (
      <ReclassifyMode
        accounts={allAccounts}
        primaryColor={primaryColor}
        onDismiss={onDismiss}
        onComplete={onComplete}
        hideBalance={hideBalance}
      />
    );
  }

  return (
    <ClassifyMode
      accounts={unclassifiedAccounts}
      primaryColor={primaryColor}
      onComplete={onComplete}
      onDismiss={onDismiss}
      hideBalance={hideBalance}
    />
  );
}

// ── 重新分类模式：账户列表 + 单个修改 ──
function ReclassifyMode({
  accounts,
  primaryColor,
  onDismiss,
  onComplete,
  hideBalance = false,
}: {
  accounts: Account[];
  primaryColor: string;
  onDismiss: () => void;
  onComplete: () => void;
  hideBalance?: boolean;
}) {
  const { year, month } = getCurrentYearMonth();
  const baseCurrency = getSettings().baseCurrency || 'CNY';
  const currencySymbol = getCurrencyConfig(baseCurrency).symbol;
  const getBalance = (acc: Account) => {
    const raw = getAccountBalanceForMonth(acc.id, year, month);
    return convertToBaseCurrency(raw, acc.currency || 'CNY', year, month);
  };
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [accountList, setAccountList] = useState<Account[]>(accounts);

  const handleUpdateCategory = (accountId: string, category: Account['assetCategory']) => {
    saveAccountAssetCategory(accountId, category);
    setAccountList(prev => prev.map(acc =>
      acc.id === accountId ? { ...acc, assetCategory: category } : acc
    ));
  };

  if (editingAccount) {
    return (
      <SingleAccountEditor
        account={editingAccount}
        primaryColor={primaryColor}
        hideBalance={hideBalance}
        onBack={() => setEditingAccount(null)}
        onDone={() => setEditingAccount(null)}
        onUpdate={handleUpdateCategory}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[3px]" onClick={onDismiss} />
      <div
        className="relative bg-white rounded-t-[24px] shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-slide-up"
        style={{ maxHeight: '65dvh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 shrink-0" />

        <div className="flex items-center justify-between px-5 pt-3 pb-2 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${primaryColor}15` }}>
              <Tag size={14} style={{ color: primaryColor }} />
            </div>
            <span className="text-[15px] font-bold text-gray-800">调整分类</span>
          </div>
          <button onClick={onDismiss} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
            <X size={14} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-3" style={{ paddingBottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))' }}>
          <p className="text-[12px] text-gray-400 mb-3">点击账户可修改其分类</p>
          <div className="space-y-2">
            {accountList.map(acc => {
              const cat = acc.assetCategory ? CATEGORY_MAP[acc.assetCategory] : null;
              return (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => setEditingAccount(acc)}
                  className="w-full flex items-center gap-2.5 py-2.5 px-3 rounded-xl border border-gray-100 hover:border-gray-200 transition-all active:scale-[0.99] text-left"
                >
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-white border border-gray-200 shrink-0">
                    <Icon name={acc.icon || 'credit-card'} size={18} color={primaryColor} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-gray-800 truncate">{acc.name}</div>
                    <div className="text-[11px] text-gray-400">{hideBalance ? '******' : `${currencySymbol}${getBalance(acc).toFixed(2)}`}</div>
                  </div>
                  {cat ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <cat.IconComp size={14} style={{ color: cat.color }} />
                      <span className="text-[11px] font-semibold" style={{ color: cat.color }}>{cat.label}</span>
                    </div>
                  ) : acc.assetCategory === 'skipped' ? (
                    <span className="text-[11px] text-gray-400 font-semibold shrink-0">已跳过</span>
                  ) : (
                    <span className="text-[11px] text-amber-600 font-semibold shrink-0">未分类</span>
                  )}
                  <ChevronRight size={14} className="text-gray-300 shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up { animation: slide-up 0.35s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
      `}</style>
    </div>
  );
}

// ── 单个账户编辑器 ──
function SingleAccountEditor({
  account,
  primaryColor,
  onBack,
  onDone,
  onUpdate,
  hideBalance = false,
}: {
  account: Account;
  primaryColor: string;
  onBack: () => void;
  onDone: () => void;
  onUpdate: (accountId: string, category: Account['assetCategory']) => void;
  hideBalance?: boolean;
}) {
  const currentCat = account.assetCategory && account.assetCategory !== 'skipped' ? account.assetCategory : null;

  const handleSelect = (category: 'cash' | 'stable' | 'invest' | 'insure') => {
    onUpdate(account.id, category);
    onDone();
  };

  const handleRemoveClassification = () => {
    onUpdate(account.id, 'skipped');
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[3px]" onClick={onBack} />
      <div
        className="relative bg-white rounded-t-[24px] shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-slide-up"
        style={{ maxHeight: '75dvh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 shrink-0" />

        <div className="flex items-center gap-3 px-5 pt-3 pb-2 shrink-0">
          <button onClick={onBack} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
            <ChevronLeft size={14} className="text-gray-500" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-white border border-gray-200 shadow-sm">
              <Icon name={account.icon || 'credit-card'} size={14} color={primaryColor} />
            </div>
            <div>
              <div className="text-[13px] font-bold text-gray-800">{account.name}</div>
              <div className="text-[10px] text-gray-400">{hideBalance ? '******' : (() => { const { year: y, month: m } = getCurrentYearMonth(); const s = getCurrencyConfig(getSettings().baseCurrency || 'CNY').symbol; return s + convertToBaseCurrency(getAccountBalanceForMonth(account.id, y, m), account.currency || 'CNY', y, m).toFixed(2); })()}</div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-3" style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))' }}>
          <p className="text-[12px] text-gray-400 mb-3">选择新的分类</p>
          <div className="space-y-2">
            {CATEGORIES.map(cat => {
              const CatIcon = cat.IconComp;
              const isCurrent = currentCat === cat.key;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => handleSelect(cat.key)}
                  className={`w-full text-left rounded-xl p-3 border transition-all active:scale-[0.98] ${
                    isCurrent ? 'border-2' : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                  }`}
                  style={{
                    backgroundColor: isCurrent ? `${cat.color}12` : '#fafafa',
                    borderColor: isCurrent ? cat.color : undefined,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${cat.color}15`, color: cat.color }}>
                      <CatIcon size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold text-gray-800">{cat.label}</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">{cat.desc}</div>
                    </div>
                    {isCurrent && (
                      <div className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: `${cat.color}20`, color: cat.color }}>
                        当前
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {currentCat && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <button
                onClick={handleRemoveClassification}
                className="w-full flex items-center justify-center gap-1.5 text-[12px] text-gray-500 font-medium px-3 py-2 rounded-full border border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-gray-300 active:scale-[0.97] transition-all"
              >
                <X size={13} />
                取消分类，设为跳过
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up { animation: slide-up 0.35s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
      `}</style>
    </div>
  );
}

// ── 首次分类模式：逐个账户分类 ──
function ClassifyMode({
  accounts,
  primaryColor,
  onComplete,
  onDismiss,
  hideBalance = false,
}: {
  accounts: Account[];
  primaryColor: string;
  onComplete: () => void;
  onDismiss: () => void;
  hideBalance?: boolean;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showDoneOverlay, setShowDoneOverlay] = useState(false);
  const [saving, setSaving] = useState(false);
  const selectionsRef = useRef<Record<number, string>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const total = accounts.length;
  const currentAccount = accounts[currentIndex];
  const progress = (currentIndex + 1) / total;
  const previousSelection = selectionsRef.current[currentIndex] || (currentAccount?.assetCategory && currentAccount.assetCategory !== 'skipped' ? currentAccount.assetCategory : null);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const handleSelect = useCallback((category: 'cash' | 'stable' | 'invest' | 'insure') => {
    if (saving) return;
    setSaving(true);
    selectionsRef.current[currentIndex] = category;
    saveAccountAssetCategory(currentAccount.id, category);
    timerRef.current = setTimeout(() => {
      setSaving(false);
      if (currentIndex + 1 >= total) {
        setShowDoneOverlay(true);
      } else {
        setCurrentIndex(prev => prev + 1);
      }
    }, 180);
  }, [currentIndex, currentAccount, total, saving]);

  const handleBack = useCallback(() => {
    if (currentIndex <= 0 || saving) return;
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    setSaving(false);
    setCurrentIndex(prev => prev - 1);
  }, [currentIndex, saving]);

  const handleSkip = useCallback(() => {
    if (saving) return;
    saveAccountAssetCategory(currentAccount.id, 'skipped');
    if (currentIndex + 1 >= total) {
      setShowDoneOverlay(true);
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, currentAccount, total, saving]);

  if (!currentAccount) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[3px]" onClick={onDismiss} />
      <div
        className="relative bg-white rounded-t-[24px] shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-slide-up"
        style={{ maxHeight: 'calc(100dvh - 20px)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 shrink-0" />

        <div className="flex items-center justify-between px-5 pt-4 pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${primaryColor}15` }}>
              <Tag size={16} style={{ color: primaryColor }} />
            </div>
            <div>
              <span className="text-[16px] font-bold text-gray-800">快速分类</span>
              <span className="text-[11px] text-gray-400 ml-1">引导资产配置</span>
            </div>
          </div>
          <button onClick={onDismiss} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {showDoneOverlay ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-6 overflow-y-auto">
            <div className="relative mb-6">
              <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${primaryColor}, #0b6eb5)` }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
            </div>
            <div className="text-xl font-bold text-gray-800 mb-2">分类完成</div>
            <div className="text-sm text-gray-500 text-center mb-1">{total} 个账户已处理</div>
            <div className="text-xs text-gray-400 text-center mb-6">现在可以查看完整的资产配置分析了</div>
            <div style={{ paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' }}>
              <button
                onClick={onComplete}
                className="w-full py-4 px-8 rounded-2xl text-white font-bold text-[16px] transition-transform active:scale-[0.98]"
                style={{ background: `linear-gradient(135deg, ${primaryColor}, #0b6eb5)`, boxShadow: `0 4px 14px ${primaryColor}40` }}
              >
                查看更新后的资产结构
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 pt-2" style={{ paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' }}>
            <div className="flex items-center gap-3 mb-4">
              {currentIndex > 0 && (
                <button onClick={handleBack} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0 active:bg-gray-200">
                  <ChevronLeft size={16} className="text-gray-500" />
                </button>
              )}
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${progress * 100}%`, backgroundColor: primaryColor, boxShadow: `0 0 8px ${primaryColor}60` }} />
              </div>
              <div className="flex items-center gap-1 text-[12px] text-gray-400 font-medium shrink-0">
                <span className="font-bold" style={{ color: primaryColor }}>{currentIndex + 1}</span>
                <span>/</span>
                <span>{total}</span>
              </div>
            </div>

            <div className="rounded-2xl p-4 mb-4 border border-gray-100" style={{ background: 'linear-gradient(135deg, #f8fbfe, #ffffff)' }}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white border border-gray-200 shadow-sm">
                  <Icon name={currentAccount.icon || 'credit-card'} size={24} color={primaryColor} />
                </div>
                <div className="flex-1">
                  <div className="text-[15px] font-bold text-gray-800">{currentAccount.name}</div>
                  <div className="text-[12px] text-gray-500 mt-0.5">余额 <span className="font-semibold text-gray-700">{hideBalance ? '******' : (() => { const { year: y, month: m } = getCurrentYearMonth(); const s = getCurrencyConfig(getSettings().baseCurrency || 'CNY').symbol; return s + convertToBaseCurrency(getAccountBalanceForMonth(currentAccount.id, y, m), currentAccount.currency || 'CNY', y, m).toFixed(2); })()}</span></div>
                </div>
                {previousSelection && CATEGORY_MAP[previousSelection] ? (
                  <div className="px-2 py-1 rounded-lg text-[10px] font-bold" style={{ backgroundColor: `${CATEGORY_MAP[previousSelection].color}15`, color: CATEGORY_MAP[previousSelection].color }}>
                    {CATEGORY_MAP[previousSelection].label}
                  </div>
                ) : currentAccount?.assetCategory === 'skipped' ? (
                  <div className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-gray-50 text-gray-500">已跳过</div>
                ) : (
                  <div className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-700">未分类</div>
                )}
              </div>
              {previousSelection && CATEGORY_MAP[previousSelection] && (
                <div className="text-[10px] text-gray-400 mt-2">上次选择：{CATEGORY_MAP[previousSelection].label} · 选择其他分类可覆盖</div>
              )}
              {currentAccount?.assetCategory === 'skipped' && (
                <div className="text-[10px] text-gray-400 mt-2">此账户已跳过 · 选择分类可取消跳过</div>
              )}
              <div className="text-[11px] text-gray-400 text-center mt-2">请为这个账户选择一个分类类型</div>
            </div>

            <div className="text-[11px] font-bold text-gray-400 mb-2 uppercase tracking-wider">选择资产类型</div>
            <div className="space-y-2">
              {CATEGORIES.map(cat => {
                const CatIcon = cat.IconComp;
                const isPrevious = previousSelection === cat.key;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => handleSelect(cat.key)}
                    disabled={saving}
                    className={`w-full text-left rounded-xl p-3 border transition-all active:scale-[0.98] ${isPrevious ? 'border-2' : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'} ${saving ? 'opacity-50' : ''}`}
                    style={{ backgroundColor: isPrevious ? `${cat.color}12` : '#fafafa', borderColor: isPrevious ? cat.color : undefined }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${cat.color}15`, color: cat.color }}>
                        <CatIcon size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-bold text-gray-800">{cat.label}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">{cat.desc}</div>
                      </div>
                      <div className="text-[9px] px-1.5 py-0.5 rounded-md font-medium shrink-0" style={{ backgroundColor: `${cat.color}12`, color: cat.color }}>{cat.hint}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-center gap-2 mt-3">
              <button
                onClick={handleSkip}
                disabled={saving}
                className="text-[12px] text-gray-500 font-medium px-3 py-1 rounded-full border border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-gray-300 active:scale-[0.97] transition-all disabled:opacity-40"
              >
                跳过此账户
              </button>
              <span className="text-gray-300">·</span>
              <span className="text-[11px] text-gray-400">剩余 {total - currentIndex - 1} 个账户未分类</span>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slide-up { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-slide-up { animation: slide-up 0.35s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
      `}</style>
    </div>
  );
}
