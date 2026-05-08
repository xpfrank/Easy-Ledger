import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Save, Trash2, Plus, ChevronRight, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Icon } from '@/components/Icon';
import type { Account, AccountType, PageRoute, IconCategory, CustomAccountType, } from '@/types';
import {
  addAccountToMonth,
  updateAccount,
  deleteAccountGlobally,
  getAccountById,
  getMonthlyRecord,
  getCustomAccountTypes,
  addCustomAccountType,
  deleteCustomAccountType,
  getAllAccounts,
} from '@/lib/storage';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { THEMES, CURRENCIES, getCurrencyConfig } from '@/types';
import { getSettings } from '@/lib/storage';

// ─────────────────────────────────────────────────────────────────────────────
// Static data
// ─────────────────────────────────────────────────────────────────────────────

interface AccountEditPageProps {
  onPageChange: (page: PageRoute, params?: any) => void;
  onBack?: () => void;
  accountId?: string;
}

const BUILTIN_TYPES: { type: AccountType; label: string; icon: string }[] = [
  { type: 'cash',       label: '现金',     icon: 'banknote'    },
  { type: 'debit',      label: '储蓄卡',   icon: 'credit-card' },
  { type: 'digital',    label: '网络支付', icon: 'wallet'      },
  { type: 'investment', label: '投资账户', icon: 'trending-up' },
  { type: 'loan',       label: '借出',     icon: 'handshake'   },
  { type: 'credit',     label: '信用卡',   icon: 'credit-card' },
  { type: 'debt',       label: '借入',     icon: 'clipboard'   },
];

const ICON_GROUPS: { id: IconCategory; label: string; icons: { name: string; label: string }[] }[] = [
  {
    id: 'finance',
    label: '金融',
    icons: [
      { name: 'banknote',    label: '现金'    },
      { name: 'credit-card', label: '银行卡'  },
      { name: 'wallet',      label: '钱包'    },
      { name: 'coins',       label: '硬币'    },
      { name: 'piggy-bank',  label: '储蓄'    },
      { name: 'landmark',    label: '银行'    },
      { name: 'building',    label: '机构'    },
      { name: 'receipt',     label: '收据'    },
      { name: 'dollar-sign', label: '美元'    },
      { name: 'euro',        label: '欧元'    },
      { name: 'bitcoin',     label: '数字货币' },
      { name: 'gem',         label: '宝石'    },
      { name: 'shield',      label: '保险'    },
      { name: 'handshake',   label: '借出'    },
      { name: 'clipboard',   label: '借入'    },
      { name: 'lock',        label: '锁定'    },
    ],
  },
  {
    id: 'investment',
    label: '投资',
    icons: [
      { name: 'trending-up',       label: '涨势' },
      { name: 'trending-down',     label: '跌势' },
      { name: 'bar-chart',         label: '柱图' },
      { name: 'bar-chart-2',       label: '基金' },
      { name: 'pie-chart',         label: '配置' },
      { name: 'line-chart',        label: '折线' },
      { name: 'activity',          label: '波动' },
      { name: 'candlestick-chart', label: 'K线'  },
      { name: 'percent',           label: '利率' },
      { name: 'arrow-up-right',    label: '收益' },
      { name: 'layers',            label: '组合' },
      { name: 'refresh-cw',        label: '复利' },
    ],
  },
  {
    id: 'life',
    label: '生活',
    icons: [
      { name: 'home',           label: '房产'   },
      { name: 'car',            label: '汽车'   },
      { name: 'plane',          label: '旅行'   },
      { name: 'train',          label: '火车'   },
      { name: 'bus',            label: '公交'   },
      { name: 'ship',           label: '轮船'   },
      { name: 'shopping-bag',   label: '购物袋' },
      { name: 'shopping-cart',  label: '购物车' },
      { name: 'gift',           label: '礼物'   },
      { name: 'heart',          label: '健康'   },
      { name: 'stethoscope',    label: '医疗'   },
      { name: 'pill',           label: '药品'   },
      { name: 'graduation-cap', label: '教育'   },
      { name: 'book',           label: '读书'   },
      { name: 'baby',           label: '育儿'   },
      { name: 'coffee',         label: '餐饮'   },
      { name: 'utensils',       label: '餐具'   },
      { name: 'smartphone',     label: '手机'   },
      { name: 'music',          label: '音乐'   },
      { name: 'gamepad-2',      label: '游戏'   },
      { name: 'umbrella',       label: '雨伞'   },
      { name: 'dog',            label: '宠物'   },
      { name: 'map-pin',        label: '地点'   },
      { name: 'sun',            label: '阳光'   },
    ],
  },
  {
    id: 'work',
    label: '工作',
    icons: [
      { name: 'building-2', label: '办公楼' },
      { name: 'factory',    label: '工厂'   },
      { name: 'briefcase',  label: '公事包' },
      { name: 'file-text',  label: '文件'   },
      { name: 'calculator', label: '计算器' },
      { name: 'printer',    label: '打印'   },
      { name: 'mail',       label: '邮件'   },
      { name: 'phone',      label: '电话'   },
      { name: 'award',      label: '奖项'   },
      { name: 'star',       label: '星级'   },
      { name: 'target',     label: '目标'   },
      { name: 'globe',      label: '国际'   },
      { name: 'flag',       label: '旗帜'   },
      { name: 'newspaper',  label: '报告'   },
    ],
  },
];

function guessIconGroup(iconName: string): IconCategory {
  for (const g of ICON_GROUPS) {
    if (g.icons.some((i) => i.name === iconName)) return g.id;
  }
  return 'finance';
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function AccountEditPage({ onPageChange, accountId, onBack }: AccountEditPageProps) {
  const isEdit = !!accountId;

  const [theme, setTheme] = useState<string>('blue');
  useEffect(() => { setTheme(getSettings().theme || 'blue'); }, []);
  const themeConfig = THEMES[theme as keyof typeof THEMES] || THEMES.blue;

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [activeIconGroup, setActiveIconGroup] = useState<IconCategory>('finance');
  const [showCurrencyDialog, setShowCurrencyDialog] = useState(false);

  // Custom type state
  const [isCustomType, setIsCustomType] = useState(false);
  const [customTypeName, setCustomTypeName] = useState('');
  const [customBehavior, setCustomBehavior] = useState<'asset' | 'liability'>('asset');
  const [customIcon, setCustomIcon] = useState('circle');
  const [savedCustomTypes, setSavedCustomTypes] = useState<CustomAccountType[]>([]);

  const [formData, setFormData] = useState<Partial<Account>>({
    name: '',
    type: 'cash',
    icon: 'banknote',
    balance: 0,
    includeInTotal: true,
    isHidden: false,
    note: '',
    billDay: 1,
    repaymentDay: 10,
    graceDays: 0,
    creditLimit: 0,
    customTypeLabel: undefined,
    currency: 'CNY',
  });

  // Load saved custom types
  useEffect(() => {
    setSavedCustomTypes(getCustomAccountTypes());
  }, []);

  // Load existing account
  useEffect(() => {
    if (!isEdit || !accountId) return;
    const account = getAccountById(accountId);
    if (!account) return;

    const now = new Date();
    const rec = getMonthlyRecord(accountId, now.getFullYear(), now.getMonth() + 1);

    setFormData({
      name: account.name,
      type: account.type,
      icon: account.icon,
      balance: rec ? rec.balance : account.balance,
      includeInTotal: account.includeInTotal,
      isHidden: account.isHidden,
      note: account.note || '',
      billDay: account.billDay || 1,
      repaymentDay: account.repaymentDay || 10,
      graceDays: account.graceDays || 0,
      creditLimit: account.creditLimit || 0,
      customTypeLabel: account.customTypeLabel,
      currency: account.currency || 'CNY',
    });

    if (account.customTypeLabel) {
      setIsCustomType(true);
      setCustomTypeName(account.customTypeLabel);
      setCustomBehavior(account.type === 'debt' || account.type === 'credit' ? 'liability' : 'asset');
      // Find matching saved custom type for icon
      const saved = getCustomAccountTypes().find(ct => ct.label === account.customTypeLabel);
      if (saved) setCustomIcon(saved.icon);
    }

    setActiveIconGroup(guessIconGroup(account.icon));
  }, [accountId, isEdit]);

  // Sync customIcon with formData.icon when in custom mode
  useEffect(() => {
    if (isCustomType && formData.icon) {
      setCustomIcon(formData.icon);
    }
  }, [formData.icon, isCustomType]);

  // Save
  const handleSave = () => {
    if (!formData.name?.trim()) { alert('请输入账户名称'); return; }

    const effectiveData: Partial<Account> = { ...formData };

    if (isCustomType) {
      const label = customTypeName.trim();
      if (!label) { alert('请输入自定义类型名称'); return; }
      effectiveData.customTypeLabel = label;
      effectiveData.type = customBehavior === 'liability' ? 'debt' : 'debit';
      // Register globally if not already saved
      const existing = getCustomAccountTypes().find(ct => ct.label === label);
      if (!existing) {
        addCustomAccountType({ label, icon: customIcon, behavior: customBehavior });
      }
    } else {
      effectiveData.customTypeLabel = undefined;
    }

    if (isEdit && accountId) {
      updateAccount(accountId, effectiveData);
    } else {
      const now = new Date();
      addAccountToMonth(effectiveData as Omit<Account, 'id'>, now.getFullYear(), now.getMonth() + 1);
    }
    onPageChange('home', { refresh: true });
  };

  const handleDelete = () => {
    if (accountId) {
      deleteAccountGlobally(accountId);
      onPageChange('accounts');
    }
  };

  const handleDeleteCustomType = (e: React.MouseEvent, ct: CustomAccountType) => {
    e.stopPropagation();

    const allAccounts = getAllAccounts();
    const usedCount = allAccounts.filter(a => a.customTypeLabel === ct.label).length;

    if (usedCount > 0) {
      alert(`「${ct.label}」正在被 ${usedCount} 个账户使用，请先修改这些账户的分类后再删除。`);
      return;
    }

    if (!confirm(`确定删除自定义分类「${ct.label}」吗？`)) return;

    deleteCustomAccountType(ct.id);
    setSavedCustomTypes(getCustomAccountTypes());

    if (isCustomType && customTypeName === ct.label) {
      setIsCustomType(false);
      setCustomTypeName('');
      setFormData(p => ({ ...p, type: 'cash', customTypeLabel: undefined, icon: 'banknote' }));
    }
  };

  const isCredit = !isCustomType && formData.type === 'credit';

  const allIconsFlat = useMemo(() => ICON_GROUPS.flatMap((g) => g.icons), []);
  const activeGroupIcons = useMemo(
    () => ICON_GROUPS.find((g) => g.id === activeIconGroup)?.icons ?? [],
    [activeIconGroup],
  );
  const selectedIconLabel = allIconsFlat.find((i) => i.name === formData.icon)?.label ?? formData.icon ?? '';

  return (
    <div className="pb-28 bg-gray-50 min-h-screen overflow-x-hidden">
      {/* Header */}
      <header
        className="px-4 py-3 flex justify-between items-center fixed top-0 left-0 right-0 z-50 max-w-md mx-auto shadow-sm rounded-b-2xl"
        style={{ backgroundColor: themeConfig.primary }}
      >
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="text-white" onClick={() => onBack ? onBack() : onPageChange('accounts')}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-lg font-semibold text-white">{isEdit ? '编辑账户' : '添加账户'}</h1>
        </div>
        <Button variant="ghost" size="icon" className="text-white" onClick={handleSave}>
          <Save size={20} />
        </Button>
      </header>

      <div className="h-14" />

      <div className="p-4 space-y-4">

        {/* ══ 账户类型 ══════════════════════════════════════════════ */}
        <Card className="bg-white">
          <CardContent className="p-4">
            <Label className="text-sm font-medium mb-3 block">账户类型</Label>

            <div className="grid grid-cols-4 gap-2">
              {/* 7 内置类型 */}
              {BUILTIN_TYPES.map((t) => {
                const sel = !isCustomType && formData.type === t.type;
                return (
                  <button
                    key={t.type}
                    onClick={() => {
                      setIsCustomType(false);
                      setFormData((p) => ({ ...p, type: t.type, customTypeLabel: undefined }));
                    }}
                    className="flex flex-col items-center justify-center py-3 px-1 rounded-xl border transition-all active:scale-95"
                    style={sel
                      ? { borderColor: themeConfig.primary, backgroundColor: `${themeConfig.primary}14`, color: themeConfig.primary }
                      : { borderColor: '#e5e7eb', color: '#9ca3af' }}
                  >
                    <Icon name={t.icon} size={20} color={sel ? themeConfig.primary : undefined} className={sel ? '' : 'text-gray-400'} />
                    <span className="text-xs mt-1 font-medium leading-tight">{t.label}</span>
                  </button>
                );
              })}

              {/* 已保存的自定义类型 */}
              {savedCustomTypes.map((ct) => {
                const sel = isCustomType && customTypeName === ct.label;
                return (
                  <div key={ct.id} className="relative">
                    <button
                      onClick={() => {
                        setIsCustomType(true);
                        setCustomTypeName(ct.label);
                        setCustomBehavior(ct.behavior);
                        setCustomIcon(ct.icon);
                        setFormData((p) => ({ ...p, icon: ct.icon, customTypeLabel: ct.label, type: ct.behavior === 'liability' ? 'debt' : 'debit' }));
                      }}
                      className="flex flex-col items-center justify-center py-3 px-1 rounded-xl border transition-all active:scale-95 w-full"
                      style={sel
                        ? { borderColor: themeConfig.primary, backgroundColor: `${themeConfig.primary}14`, color: themeConfig.primary }
                        : { borderColor: '#e5e7eb', color: '#9ca3af' }}
                    >
                      <Icon name={ct.icon} size={20} color={sel ? themeConfig.primary : undefined} className={sel ? '' : 'text-gray-400'} />
                      <span className="text-xs mt-1 font-medium leading-tight truncate max-w-full px-1">{ct.label}</span>
                    </button>
                    <button
                      onClick={(e) => handleDeleteCustomType(e, ct)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center shadow-sm hover:bg-red-600 active:scale-90"
                    >
                      ×
                    </button>
                  </div>
                );
              })}

              {/* 新建自定义 */}
              <button
                onClick={() => {
                  setIsCustomType(true);
                  setCustomTypeName('');
                  setCustomIcon('wallet');
                  setCustomBehavior('asset');
                }}
                className="flex flex-col items-center justify-center py-3 px-1 rounded-xl border transition-all active:scale-95"
                style={(isCustomType && !savedCustomTypes.some(ct => ct.label === customTypeName))
                  ? { borderColor: themeConfig.primary, backgroundColor: `${themeConfig.primary}14`, color: themeConfig.primary }
                  : { borderColor: '#d1d5db', borderStyle: 'dashed', color: '#9ca3af' }}
              >
                <Plus size={20} color={(isCustomType && !savedCustomTypes.some(ct => ct.label === customTypeName)) ? themeConfig.primary : '#9ca3af'} />
                <span className="text-xs mt-1 font-medium leading-tight">自定义</span>
              </button>
            </div>

            {/* 自定义展开面板 */}
            {isCustomType && (
              <div
                className="mt-3 p-3 rounded-xl space-y-3"
                style={{ backgroundColor: `${themeConfig.primary}08`, border: `1px solid ${themeConfig.primary}25` }}
              >
                <div>
                  <Label className="text-xs font-medium text-gray-500 mb-1.5 block">自定义类型名称</Label>
                  <Input
                    value={customTypeName}
                    onChange={(e) => setCustomTypeName(e.target.value)}
                    placeholder="例：公积金账户、医保个账、外币账户…"
                    className="h-10 text-sm"
                  />
                </div>

                <div>
                  <Label className="text-xs font-medium text-gray-500 mb-1.5 block">图标</Label>
                  <div className="flex flex-wrap gap-2">
                    {['circle','wallet','landmark','shield','gem','lock','piggy-bank','coins','receipt','star','heart','home','car','globe','briefcase','smartphone'].map((iconName) => (
                      <button
                        key={iconName}
                        onClick={() => setCustomIcon(iconName)}
                        className="w-9 h-9 rounded-lg flex items-center justify-center border transition-all"
                        style={customIcon === iconName
                          ? { borderColor: themeConfig.primary, backgroundColor: `${themeConfig.primary}14` }
                          : { borderColor: '#e5e7eb' }}
                      >
                        <Icon name={iconName} size={16} color={customIcon === iconName ? themeConfig.primary : '#9ca3af'} />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-medium text-gray-500 mb-2 block">计入净资产的方式</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { val: 'asset' as const,     label: '资产类', sub: '增加净资产', icon: 'trending-up',   activeColor: '#10b981' },
                      { val: 'liability' as const, label: '负债类', sub: '减少净资产', icon: 'trending-down', activeColor: '#ef4444' },
                    ]).map((opt) => {
                      const active = customBehavior === opt.val;
                      return (
                        <button
                          key={opt.val}
                          onClick={() => setCustomBehavior(opt.val)}
                          className="flex items-center gap-2 p-2.5 rounded-lg border text-left transition-all"
                          style={active
                            ? { borderColor: opt.activeColor, backgroundColor: `${opt.activeColor}10` }
                            : { borderColor: '#e5e7eb' }}
                        >
                          <span
                            className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: active ? opt.activeColor : '#f3f4f6' }}
                          >
                            <Icon name={opt.icon} size={14} color={active ? '#fff' : '#9ca3af'} />
                          </span>
                          <div>
                            <div className="text-xs font-semibold" style={{ color: active ? opt.activeColor : '#374151' }}>{opt.label}</div>
                            <div className="text-xs text-gray-400">{opt.sub}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <p className="text-xs text-gray-400 leading-relaxed">
                  💡 自定义类型与内置类型功能完全相同，资产/负债属性决定它参与净资产计算的方式。
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ══ 基本信息 ═══════════════════════════════════════════════ */}
        <Card className="bg-white">
          <CardContent className="p-4 space-y-4">
            {/* 名称 */}
            <div>
              <Label htmlFor="name" className="text-sm font-medium mb-2 block">
                账户名称 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                placeholder="例如：招商银行储蓄卡"
                className="h-11"
              />
            </div>

            {/* 币种 - 改为弹窗选择 */}
            <div>
              <Label className="text-sm font-medium mb-2 block">币种</Label>
              <button
                onClick={() => setShowCurrencyDialog(true)}
                className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{getCurrencyConfig(formData.currency || 'CNY').symbol}</span>
                  <span className="text-sm font-medium">{formData.currency || 'CNY'}</span>
                  <span className="text-xs text-gray-400">{getCurrencyConfig(formData.currency || 'CNY').name}</span>
                </div>
                <ChevronRight size={16} className="text-gray-400" />
              </button>
            </div>

            {/* 图标 */}
            <div>
              <Label className="text-sm font-medium mb-2 block">图标</Label>

              {/* 分组 Tab */}
              <div className="flex gap-1 mb-2 p-1 bg-gray-100 rounded-lg">
                {ICON_GROUPS.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setActiveIconGroup(g.id)}
                    className="flex-1 py-1.5 text-xs font-medium rounded-md transition-all"
                    style={activeIconGroup === g.id
                      ? { backgroundColor: themeConfig.primary, color: '#fff' }
                      : { color: '#6b7280' }}
                  >
                    {g.label}
                  </button>
                ))}
              </div>

              {/* 图标网格 */}
              <div className="grid grid-cols-8 gap-1.5 max-h-40 overflow-y-auto overscroll-contain pr-0.5">
                {activeGroupIcons.map((icon) => {
                  const sel = formData.icon === icon.name;
                  return (
                    <button
                      key={icon.name}
                      title={icon.label}
                      onClick={() => setFormData((p) => ({ ...p, icon: icon.name }))}
                      className="aspect-square rounded-lg flex items-center justify-center transition-all active:scale-90"
                      style={sel
                        ? { backgroundColor: themeConfig.primary }
                        : { backgroundColor: '#f3f4f6' }}
                    >
                      <Icon name={icon.name} size={18} color={sel ? '#fff' : '#6b7280'} />
                    </button>
                  );
                })}
              </div>

              {/* 已选提示 */}
              {formData.icon && (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span
                    className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: themeConfig.primary }}
                  >
                    <Icon name={formData.icon} size={12} color="#fff" />
                  </span>
                  <span className="text-xs text-gray-400">{selectedIconLabel}</span>
                </div>
              )}
            </div>

            {/* 余额 */}
            <div>
              <Label htmlFor="balance" className="text-sm font-medium mb-2 block">当前余额</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">{getCurrencyConfig(formData.currency || 'CNY').symbol}</span>
                <Input
                  id="balance"
                  type="number"
                  step="0.01"
                  value={formData.balance || ''}
                  onChange={(e) => setFormData((p) => ({ ...p, balance: parseFloat(e.target.value) || 0 }))}
                  placeholder="0.00"
                  className="h-11 pl-7"
                />
              </div>
              {isCredit && (
                <p className="text-xs text-gray-400 mt-1">正数 = 欠款，负数 = 溢缴款（多还的钱）</p>
              )}
            </div>

            {/* 备注 */}
            <div>
              <Label htmlFor="note" className="text-sm font-medium mb-2 block">
                备注 <span className="text-gray-400">(可选)</span>
              </Label>
              <Input
                id="note"
                value={formData.note}
                onChange={(e) => setFormData((p) => ({ ...p, note: e.target.value }))}
                placeholder="添加备注信息"
                className="h-11"
              />
            </div>
          </CardContent>
        </Card>

        {/* ══ 信用卡专属设置 ════════════════════════════════════════ */}
        {isCredit && (
          <Card className="bg-white">
            <CardContent className="p-4 space-y-4">
              <Label className="text-sm font-medium block">信用卡设置</Label>

              <div>
                <Label htmlFor="creditLimit" className="text-xs text-gray-500 mb-1 block">总额度</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">{getCurrencyConfig(formData.currency || 'CNY').symbol}</span>
                  <Input
                    id="creditLimit"
                    type="number" step="0.01" min="0"
                    value={formData.creditLimit || ''}
                    onChange={(e) => setFormData((p) => ({ ...p, creditLimit: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                    className="h-11 pl-7"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">设置信用卡总额度，系统将自动计算剩余额度</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="billDay" className="text-xs text-gray-500 mb-1 block">账单日</Label>
                  <Input id="billDay" type="number" min={1} max={31}
                    value={formData.billDay}
                    onChange={(e) => setFormData((p) => ({ ...p, billDay: parseInt(e.target.value) || 1 }))}
                    className="h-10" />
                </div>
                <div>
                  <Label htmlFor="repaymentDay" className="text-xs text-gray-500 mb-1 block">还款日</Label>
                  <Input id="repaymentDay" type="number" min={1} max={31}
                    value={formData.repaymentDay}
                    onChange={(e) => setFormData((p) => ({ ...p, repaymentDay: parseInt(e.target.value) || 10 }))}
                    className="h-10" />
                </div>
                <div>
                  <Label htmlFor="graceDays" className="text-xs text-gray-500 mb-1 block">顺延天数</Label>
                  <Input id="graceDays" type="number" min={0} max={10}
                    value={formData.graceDays}
                    onChange={(e) => setFormData((p) => ({ ...p, graceDays: parseInt(e.target.value) || 0 }))}
                    className="h-10" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ══ 设置项 ════════════════════════════════════════════════ */}
        <Card className="bg-white">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">计入总资产</div>
                <div className="text-xs text-gray-400">该账户余额计入净资产计算</div>
              </div>
              <Switch
                checked={formData.includeInTotal}
                onCheckedChange={(checked) => setFormData((p) => ({ ...p, includeInTotal: checked }))}
                style={{ '--tw-bg-opacity': '1' } as React.CSSProperties}
                className="data-[state=checked]:bg-theme"
              />
            </div>
            <div className="border-t border-gray-100 pt-4 flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">隐藏账户</div>
                <div className="text-xs text-gray-400">不在首页账户列表中显示</div>
              </div>
              <Switch
                checked={formData.isHidden}
                onCheckedChange={(checked) => setFormData((p) => ({ ...p, isHidden: checked }))}
                className="data-[state=checked]:bg-gray-400"
              />
            </div>
          </CardContent>
        </Card>

        {/* 删除按钮 */}
        {isEdit && (
          <Button
            variant="outline"
            className="w-full border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 size={18} className="mr-2" />
            删除账户
          </Button>
        )}
      </div>

      {/* 底部保存 */}
      <div className="fixed bottom-6 left-4 right-4 max-w-md mx-auto">
        <Button
          className="w-full h-12 text-white shadow-lg"
          style={{ backgroundColor: themeConfig.primary }}
          onClick={handleSave}
        >
          <Save size={18} className="mr-2" />
          保存
        </Button>
      </div>

      {/* 删除确认 */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除此账户吗？此操作将同时删除该账户的所有历史记录，且无法恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>取消</Button>
            <Button variant="destructive" onClick={handleDelete}>删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 币种选择弹窗 - 自定义底部弹窗 */}
      {showCurrencyDialog && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShowCurrencyDialog(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full max-w-md bg-white rounded-t-2xl max-h-[70vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
              <span className="font-semibold text-base">选择币种</span>
              <button onClick={() => setShowCurrencyDialog(false)} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                <X size={14} className="text-gray-500" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 pb-28">
              <div className="grid grid-cols-3 gap-3">
                {CURRENCIES.map((c) => {
                  const sel = (formData.currency || 'CNY') === c.code;
                  return (
                    <button
                      key={c.code}
                      onClick={() => {
                        setFormData((p) => ({ ...p, currency: c.code }));
                        setShowCurrencyDialog(false);
                      }}
                      className={`flex flex-col items-center justify-center py-3.5 px-2 rounded-xl border-2 transition-all active:scale-95 ${
                        sel ? 'border-gray-200 bg-white' : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                      style={sel ? { borderColor: themeConfig.primary, backgroundColor: `${themeConfig.primary}15` } : {}}
                    >
                      <span className="text-2xl font-bold" style={sel ? { color: themeConfig.primary } : {}}>
                        {c.symbol}
                      </span>
                      <span className="text-xs font-medium mt-1" style={sel ? { color: themeConfig.primary } : { color: '#374151' }}>
                        {c.code}
                      </span>
                      <span className="text-[10px] text-gray-400 mt-0.5">{c.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
