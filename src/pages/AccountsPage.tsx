import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Upload, Trash2, Edit3, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Icon } from '@/components/Icon';
import type { Account, PageRoute } from '@/types';
import {
  getAllAccounts,
  deleteAccount,
  updateAccount,
  importData,
  formatAmountNoSymbol,
  getMonthlyRecordsByMonth,
} from '@/lib/storage';
import { ACCOUNT_TYPES } from '@/lib/calculator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

interface AccountsPageProps {
  onPageChange: (page: PageRoute, params?: any) => void;
}

export function AccountsPage({ onPageChange }: AccountsPageProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currentBalances, setCurrentBalances] = useState<Record<string, number>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = () => {
    const allAccounts = getAllAccounts();
    setAccounts(allAccounts);

    // 获取当前月份的余额（优先显示月度记录中的余额）
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const records = getMonthlyRecordsByMonth(currentYear, currentMonth);

    const balances: Record<string, number> = {};
    for (const account of allAccounts) {
      const record = records.find(r => r.accountId === account.id);
      balances[account.id] = record ? record.balance : account.balance;
    }
    setCurrentBalances(balances);
  };

  const handleDelete = (account: Account) => {
    setAccountToDelete(account);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (accountToDelete) {
      deleteAccount(accountToDelete.id);
      loadAccounts();
      setDeleteDialogOpen(false);
      setAccountToDelete(null);
    }
  };

  const toggleIncludeInTotal = (account: Account) => {
    updateAccount(account.id, { includeInTotal: !account.includeInTotal });
    loadAccounts();
  };

  const toggleHidden = (account: Account) => {
    updateAccount(account.id, { isHidden: !account.isHidden });
    loadAccounts();
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        if (importData(content)) {
          loadAccounts();
          setImportDialogOpen(false);
          alert('数据导入成功');
        } else {
          alert('数据导入失败，请检查文件格式');
        }
      };
      reader.readAsText(file);
    }
  };

  const groupedAccounts = ACCOUNT_TYPES.map(type => ({
    ...type,
    accounts: accounts.filter(a => a.type === type.type),
  })).filter(g => g.accounts.length > 0);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* 固定标题栏 - 使用 sticky 定位 */}
      <div className="sticky top-0 z-10 bg-white border-b shadow-sm">
        <div className="flex items-center gap-3 p-4">
          <button onClick={() => onPageChange('home')}>
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">账户管理</h1>
        </div>
      </div>

      {/* 操作按钮区域 */}
      <div className="p-4 flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setImportDialogOpen(true)}
        >
          <Upload className="w-4 h-4 mr-1" />
          导入
        </Button>
      </div>

      {groupedAccounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <p className="mb-4">还没有账户</p>
          <Button onClick={() => onPageChange('account-edit')}>
            <Plus className="w-4 h-4 mr-1" />
            添加账户
          </Button>
        </div>
      ) : (
        <div className="px-4 space-y-4">
          {groupedAccounts.map((group) => (
            <div key={group.type}>
              {/* 分组标题 */}
              <div className="text-sm text-gray-500 font-medium mb-2">
                {group.label}
              </div>

              {/* 账户卡片列表 */}
              {group.accounts.map((account) => (
                <Card key={account.id} className="mb-3">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icon name={getAccountTypeIcon(account.type)} className="w-6 h-6 text-gray-600" />
                        <div>
                          <p className="font-medium">{account.name}</p>
                          <p className="text-sm text-gray-500">
                            余额: {formatAmountNoSymbol(currentBalances[account.id] ?? account.balance)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onPageChange('account-edit', { accountId: account.id })}
                        >
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(account)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>

                    {/* 设置项 */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={account.includeInTotal}
                          onCheckedChange={() => toggleIncludeInTotal(account)}
                          className="data-[state=checked]:bg-sky-500"
                        />
                        <span className="text-sm">计入总资产</span>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleHidden(account)}
                      >
                        {account.isHidden ? (
                          <>
                            <Eye className="w-4 h-4 mr-1" />
                            显示
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-4 h-4 mr-1" />
                            隐藏
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* 添加按钮 */}
      <div className="fixed bottom-20 left-0 right-0 p-4 flex justify-center">
        <Button onClick={() => onPageChange('account-edit')}>
          <Plus className="w-4 h-4 mr-1" />
          添加账户
        </Button>
      </div>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除账户 "{accountToDelete?.name}" 吗？此操作将同时删除该账户的所有历史记录，且无法恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={confirmDelete} className="bg-red-500 hover:bg-red-600">
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 导入对话框 */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>导入数据</DialogTitle>
            <DialogDescription>
              选择之前导出的 JSON 文件进行恢复。导入将覆盖当前所有数据。
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
              取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getAccountTypeIcon(type: string): string {
  const iconMap: Record<string, string> = {
    'cash': 'Banknote',
    'debit': 'CreditCard',
    'credit': 'CreditCard',
    'digital': 'Wallet',
    'investment': 'TrendingUp',
    'loan': 'Handshake',
    'debt': 'ClipboardList',
  };
  return iconMap[type] || 'Circle';
}
