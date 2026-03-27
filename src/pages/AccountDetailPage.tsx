import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Edit3, Trash2, TrendingUp, History, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Icon } from '@/components/Icon';
import type { Account, PageRoute, ThemeType } from '@/types';
import {
  getAccountById,
  getMonthlyRecord,
  formatAmountNoSymbol,
  getSettings,
  updateAccount,
  deleteAccount,
} from '@/lib/storage';
import { getAccountTypeLabel, getAccountHistory } from '@/lib/calculator';
import { THEMES } from '@/types';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AccountDetailPageProps {
  onPageChange: (page: PageRoute, params?: any) => void;
  accountId: string;
}

// 隐藏金额显示
function formatHiddenAmount(amount: number, hide: boolean): string {
  if (hide) {
    return '******';
  }
  return formatAmountNoSymbol(amount);
}

// 获取储蓄卡趋势数据
function getSavingsTrendData(accountId: string, months: number) {
  const records = getAccountHistory(accountId, months);
  return records.map((r) => ({
    month: `${r.year}-${r.month.toString().padStart(2, '0')}`,
    label: `${r.month}月`,
    balance: r.balance,
  }));
}

// 获取信用卡趋势数据
function getCreditTrendData(accountId: string, months: number) {
  const records = getAccountHistory(accountId, months);
  return records.map((r) => ({
    month: `${r.year}-${r.month.toString().padStart(2, '0')}`,
    label: `${r.month}月`,
    debt: r.balance > 0 ? r.balance : 0,
    surplus: r.balance < 0 ? Math.abs(r.balance) : 0,
  }));
}

export function AccountDetailPage({ onPageChange, accountId }: AccountDetailPageProps) {
  const [account, setAccount] = useState<Account | null>(null);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [hideBalance, setHideBalance] = useState(false);
  const [theme, setTheme] = useState<ThemeType>('blue');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [trendRange, setTrendRange] = useState<'6' | '12' | 'all'>('6');
  const themeConfig = THEMES[theme];

  useEffect(() => {
    const settings = getSettings();
    setHideBalance(settings.hideBalance || false);
    setTheme(settings.theme || 'blue');
    loadAccountData();
  }, [accountId]);

  const loadAccountData = () => {
    const acc = getAccountById(accountId);
    if (acc) {
      setAccount(acc);
      // 获取当前月份余额
      const now = new Date();
      const record = getMonthlyRecord(accountId, now.getFullYear(), now.getMonth() + 1);
      setCurrentBalance(record ? record.balance : acc.balance);
    }
  };

  const handleToggleIncludeInTotal = () => {
    if (account) {
      updateAccount(account.id, { includeInTotal: !account.includeInTotal });
      loadAccountData();
    }
  };

  const handleToggleHidden = () => {
    if (account) {
      updateAccount(account.id, { isHidden: !account.isHidden });
      loadAccountData();
    }
  };

  const handleDelete = () => {
    if (account) {
      deleteAccount(account.id);
      onPageChange('accounts');
    }
  };

  // 计算趋势图数据
  const trendData = useMemo(() => {
    if (!account) return [];
    const months = trendRange === 'all' ? 0 : parseInt(trendRange);
    if (account.type === 'credit') {
      return getCreditTrendData(account.id, months);
    }
    return getSavingsTrendData(account.id, months);
  }, [account, trendRange]);

  // 计算统计数据
  const stats = useMemo(() => {
    if (!account || trendData.length === 0) return null;

    if (account.type === 'credit') {
      const debts = trendData.map((d: any) => d.debt).filter((d: number) => d > 0);
      const maxDebt = debts.length > 0 ? Math.max(...debts) : 0;
      const avgDebt = debts.length > 0 ? debts.reduce((a: number, b: number) => a + b, 0) / debts.length : 0;
      return { maxDebt, avgDebt };
    } else {
      const balances = trendData.map((d: any) => d.balance);
      const maxBalance = Math.max(...balances);
      const minBalance = Math.min(...balances);
      const avgBalance = balances.reduce((a: number, b: number) => a + b, 0) / balances.length;
      return { maxBalance, minBalance, avgBalance };
    }
  }, [account, trendData]);

  if (!account) {
    return (
      <div className="pb-24 bg-gray-50 min-h-screen">
        <header className="bg-white px-4 py-3 flex items-center fixed top-0 left-0 right-0 z-50 max-w-md mx-auto shadow-sm">
          <Button variant="ghost" size="icon" onClick={() => onPageChange('accounts')}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-lg font-semibold ml-2">账户详情</h1>
        </header>
        <div className="h-14"></div>
        <div className="p-4 text-center text-gray-500">账户不存在</div>
      </div>
    );
  }

  const isCredit = account.type === 'credit';
  const isDebt = account.type === 'debt';

  return (
    <div className="pb-24 bg-gray-50 min-h-screen overflow-x-hidden">
      {/* 顶部栏 */}
      <header
        className="px-4 py-3 flex justify-between items-center fixed top-0 left-0 right-0 z-50 max-w-md mx-auto shadow-sm"
        style={{ backgroundColor: themeConfig.primary }}
      >
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => onPageChange('accounts')}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-lg font-semibold text-white">{account.name}</h1>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={() => onPageChange('account-edit', { accountId: account.id })}
          >
            <Edit3 size={18} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 size={18} />
          </Button>
        </div>
      </header>

      {/* 占位元素 */}
      <div className="h-14"></div>

      <div className="p-4 space-y-4">
        {/* 核心信息卡片 */}
        <Card
          className="text-white border-0 shadow-lg overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${themeConfig.gradientFrom} 0%, ${themeConfig.gradientTo} 100%)`,
          }}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                  <Icon name={account.icon} size={24} className="text-white" />
                </div>
                <div>
                  <div className="text-white/80 text-sm">{getAccountTypeLabel(account.type)}</div>
                  <div className="text-lg font-semibold">{account.name}</div>
                </div>
              </div>
            </div>

            {/* 余额显示 */}
            <div className="mb-4">
              <div className="text-white/70 text-sm mb-1">
                {isCredit ? '剩余欠款' : isDebt ? '借入金额' : '当前余额'}
              </div>
              <div className="text-3xl font-bold">
                ¥{formatHiddenAmount(isDebt || isCredit ? Math.abs(currentBalance) : currentBalance, hideBalance)}
              </div>
              {isCredit && currentBalance < 0 && (
                <div className="text-sm text-green-200 mt-1">溢缴款 ¥{formatHiddenAmount(Math.abs(currentBalance), hideBalance)}</div>
              )}
            </div>

            {/* 信用卡专属信息 */}
            {isCredit && (
              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/20">
                <div>
                  <div className="text-white/60 text-xs">账单日</div>
                  <div className="font-medium">{account.billDay || 1}日</div>
                </div>
                <div>
                  <div className="text-white/60 text-xs">还款日</div>
                  <div className="font-medium">{account.repaymentDay || 10}日</div>
                </div>
                <div>
                  <div className="text-white/60 text-xs">顺延天数</div>
                  <div className="font-medium">{account.graceDays || 0}天</div>
                </div>
              </div>
            )}

            {/* 备注 */}
            {account.note && (
              <div className="mt-4 pt-4 border-t border-white/20">
                <div className="text-white/60 text-xs mb-1">备注</div>
                <div className="text-sm">{account.note}</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 配置开关 */}
        <Card className="bg-white">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">计入总资产</div>
                <div className="text-xs text-gray-400">该账户余额计入净资产计算</div>
              </div>
              <Switch
                checked={account.includeInTotal}
                onCheckedChange={handleToggleIncludeInTotal}
                style={{ backgroundColor: account.includeInTotal ? themeConfig.primary : undefined }}
              />
            </div>
            <div className="border-t border-gray-100 pt-4 flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">隐藏账户</div>
                <div className="text-xs text-gray-400">不在首页账户列表中显示</div>
              </div>
              <Switch
                checked={account.isHidden}
                onCheckedChange={handleToggleHidden}
              />
            </div>
          </CardContent>
        </Card>

        {/* 资产变化入口 */}
        <Card
          className="bg-white cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => onPageChange('account-flow', { accountId: account.id })}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${themeConfig.primary}15` }}
                >
                  <History size={20} style={{ color: themeConfig.primary }} />
                </div>
                <div>
                  <div className="font-medium text-sm">资产变化</div>
                  <div className="text-xs text-gray-400">查看该账户的收支记录</div>
                </div>
              </div>
              <ChevronRight size={20} className="text-gray-400" />
            </div>
          </CardContent>
        </Card>

        {/* 余额趋势图 */}
        <Card className="bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp size={18} style={{ color: themeConfig.primary }} />
                <span className="font-medium text-sm">余额趋势</span>
              </div>
              <Select value={trendRange} onValueChange={(v: '6' | '12' | 'all') => setTrendRange(v)}>
                <SelectTrigger className="w-28 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">近6个月</SelectItem>
                  <SelectItem value="12">近1年</SelectItem>
                  <SelectItem value="all">全部</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {trendData.length > 0 ? (
              <>
                <div className="h-48 mb-4">
                  <ResponsiveContainer width="100%" height="100%">
                    {isCredit ? (
                      <AreaChart data={trendData}>
                        <defs>
                          <linearGradient id="debtGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                          formatter={(v: number) => [`¥${formatAmountNoSymbol(v)}`, '欠款']}
                          labelFormatter={(l) => `${l}`}
                        />
                        <Area
                          type="monotone"
                          dataKey="debt"
                          stroke="#ef4444"
                          fill="url(#debtGradient)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    ) : (
                      <AreaChart data={trendData}>
                        <defs>
                          <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={themeConfig.primary} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={themeConfig.primary} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                          formatter={(v: number) => [`¥${formatAmountNoSymbol(v)}`, '余额']}
                          labelFormatter={(l) => `${l}`}
                        />
                        <Area
                          type="monotone"
                          dataKey="balance"
                          stroke={themeConfig.primary}
                          fill="url(#balanceGradient)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    )}
                  </ResponsiveContainer>
                </div>

                {/* 统计数据 */}
                {stats && (
                  <div className="grid grid-cols-3 gap-2 pt-4 border-t border-gray-100">
                    {isCredit ? (
                      <>
                        <div className="text-center">
                          <div className="text-xs text-gray-400">最高欠款</div>
                          <div className="text-sm font-medium text-red-500">
                            ¥{formatHiddenAmount((stats as any).maxDebt, hideBalance)}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-400">平均欠款</div>
                          <div className="text-sm font-medium">
                            ¥{formatHiddenAmount((stats as any).avgDebt, hideBalance)}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-400">当前欠款</div>
                          <div className="text-sm font-medium">
                            ¥{formatHiddenAmount(Math.abs(currentBalance), hideBalance)}
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-center">
                          <div className="text-xs text-gray-400">最高余额</div>
                          <div className="text-sm font-medium text-green-600">
                            ¥{formatHiddenAmount((stats as any).maxBalance, hideBalance)}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-400">最低余额</div>
                          <div className="text-sm font-medium">
                            ¥{formatHiddenAmount((stats as any).minBalance, hideBalance)}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-400">平均余额</div>
                          <div className="text-sm font-medium">
                            ¥{formatHiddenAmount((stats as any).avgBalance, hideBalance)}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="h-32 flex items-center justify-center text-gray-400 text-sm">
                暂无历史数据
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 删除确认对话框 */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除账户 "{account.name}" 吗？此操作将同时删除该账户的所有历史记录，且无法恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
