import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Upload, Trash2, Edit3, Eye, EyeOff, Download, FileSpreadsheet, FileJson } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Icon } from '@/components/Icon';
import type { Account, PageRoute } from '@/types';
import type { ExcelImportRow } from '@/lib/storage';
import {
  getAllAccounts,
  deleteAccount,
  updateAccount,
  importData,
  formatAmountNoSymbol,
  getMonthlyRecordsByMonth,
  getSettings,
  parseExcelCSV,
  batchImportFromExcel,
  exportExcelTemplate,
} from '@/lib/storage';
import { ACCOUNT_TYPES } from '@/lib/calculator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

// 隐藏金额显示
function formatHiddenAmount(amount: number, hide: boolean): string {
  if (hide) {
    return '******';
  }
  return formatAmountNoSymbol(amount);
}

interface AccountsPageProps {
  onPageChange: (page: PageRoute, params?: any) => void;
}

export function AccountsPage({ onPageChange }: AccountsPageProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currentBalances, setCurrentBalances] = useState<Record<string, number>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [hideBalance, setHideBalance] = useState(false);
  const [importMode, setImportMode] = useState<'json' | 'excel'>('json');
  const [excelData, setExcelData] = useState<ExcelImportRow[]>([]);
  const [excelError, setExcelError] = useState<string>('');

  useEffect(() => {
    const settings = getSettings();
    setHideBalance(settings.hideBalance || false);
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

  const handleExcelFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const parsed = parseExcelCSV(content);
        if (parsed.length > 0) {
          setExcelData(parsed);
          setExcelError('');
        } else {
          setExcelData([]);
          setExcelError('无法解析 Excel 文件，请确保格式正确');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleExcelImport = () => {
    if (excelData.length === 0) {
      setExcelError('请先选择 Excel 文件');
      return;
    }
    const result = batchImportFromExcel(excelData);
    alert(result.message);
    if (result.success) {
      loadAccounts();
      setImportDialogOpen(false);
      setExcelData([]);
      setImportMode('json');
    }
  };

  const handleDownloadTemplate = () => {
    const template = exportExcelTemplate();
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '资产导入模板.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCloseImportDialog = (open: boolean) => {
    setImportDialogOpen(open);
    if (!open) {
      setExcelData([]);
      setExcelError('');
      setImportMode('json');
    }
  };

  const groupedAccounts = ACCOUNT_TYPES.map(type => ({
    ...type,
    accounts: accounts.filter(a => a.type === type.type),
  })).filter(g => g.accounts.length > 0);

  return (
    <div className="pb-24 bg-gray-50 min-h-screen overflow-x-hidden">
      {/* 标题栏 - 使用 fixed 定位确保始终可见 */}
      <header className="bg-white px-4 py-3 flex justify-between items-center fixed top-0 left-0 right-0 z-50 max-w-md mx-auto shadow-sm">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => onPageChange('home')}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-lg font-semibold">账户管理</h1>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setImportDialogOpen(true)}>
          <Upload size={20} />
        </Button>
      </header>

      {/* 占位元素，防止内容被固定标题栏遮挡 */}
      <div className="h-14"></div>

      <div className="p-4 space-y-4">
        {groupedAccounts.length === 0 ? (
          <Card className="bg-white">
            <CardContent className="p-8 text-center">
              <p className="text-gray-500 mb-4">还没有账户</p>
              <Button 
                className="bg-sky-500 hover:bg-sky-600"
                onClick={() => onPageChange('account-edit')}
              >
                <Plus size={18} className="mr-1" />
                添加账户
              </Button>
            </CardContent>
          </Card>
        ) : (
          groupedAccounts.map((group) => (
            <div key={group.type} className="space-y-2">
              <h2 className="text-sm font-medium text-gray-500 px-1">
                {group.label}
              </h2>
              <Card className="bg-white overflow-hidden">
                <div className="divide-y divide-gray-100">
                  {group.accounts.map((account) => (
                    <div
                      key={account.id}
                      className="p-3 hover:bg-gray-50 cursor-pointer"
                      onClick={() => onPageChange('account-detail', { accountId: account.id })}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                            account.type === 'credit' || account.type === 'debt'
                              ? 'bg-red-50'
                              : 'bg-sky-50'
                          }`}>
                            <Icon
                              name={account.icon}
                              size={18}
                              className={account.type === 'credit' || account.type === 'debt'
                                ? 'text-red-500'
                                : 'text-sky-500'
                              }
                            />
                          </div>
                          <div>
                            <div className="font-medium text-sm">{account.name}</div>
                            <div className="text-xs text-gray-400">
                              余额: ¥{formatHiddenAmount(currentBalances[account.id] ?? account.balance, hideBalance)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              onPageChange('account-edit', { accountId: account.id });
                            }}
                          >
                            <Edit3 size={16} className="text-gray-400" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(account);
                            }}
                          >
                            <Trash2 size={16} className="text-red-400" />
                          </Button>
                        </div>
                      </div>
                      
                      {/* 设置项 */}
                      <div className="flex items-center justify-between pt-2 mt-2 border-t border-gray-50">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Switch 
                              checked={account.includeInTotal}
                              onCheckedChange={() => toggleIncludeInTotal(account)}
                              className="data-[state=checked]:bg-sky-500"
                            />
                            <span className="text-xs text-gray-500">计入总资产</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2"
                              onClick={() => toggleHidden(account)}
                            >
                              {account.isHidden ? (
                                <EyeOff size={14} className="text-gray-400 mr-1" />
                              ) : (
                                <Eye size={14} className="text-sky-500 mr-1" />
                              )}
                              <span className="text-xs">
                                {account.isHidden ? '已隐藏' : '显示'}
                              </span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          ))
        )}
      </div>

      {/* 添加按钮 */}
      <div className="fixed bottom-6 left-4 right-4">
        <Button 
          className="w-full bg-sky-500 hover:bg-sky-600 h-12"
          onClick={() => onPageChange('account-edit')}
        >
          <Plus size={20} className="mr-2" />
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
            <Button variant="destructive" onClick={confirmDelete}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 导入对话框 */}
      <Dialog open={importDialogOpen} onOpenChange={handleCloseImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>导入数据</DialogTitle>
          </DialogHeader>

          {/* 导入模式切换 */}
          <div className="flex gap-2 py-2">
            <Button
              variant={importMode === 'json' ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
              style={importMode === 'json' ? { backgroundColor: '#0ea5e9' } : {}}
              onClick={() => setImportMode('json')}
            >
              <FileJson size={16} className="mr-1" />
              JSON 恢复
            </Button>
            <Button
              variant={importMode === 'excel' ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
              style={importMode === 'excel' ? { backgroundColor: '#0ea5e9' } : {}}
              onClick={() => setImportMode('excel')}
            >
              <FileSpreadsheet size={16} className="mr-1" />
              Excel 批量
            </Button>
          </div>

          {/* JSON 导入模式 */}
          {importMode === 'json' && (
            <>
              <DialogDescription className="text-sm">
                选择之前导出的 JSON 文件进行恢复。导入将覆盖当前所有数据。
              </DialogDescription>
              <div className="py-4">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="w-full"
                />
              </div>
            </>
          )}

          {/* Excel 导入模式 */}
          {importMode === 'excel' && (
            <>
              <DialogDescription className="text-sm">
                上传 Excel/CSV 文件，批量导入月度存款数据。目标账户设为 Excel 余额，其余账户设为 0。
              </DialogDescription>

              <div className="py-3 space-y-3">
                {/* 下载模板按钮 */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={handleDownloadTemplate}
                >
                  <Download size={16} className="mr-1" />
                  下载导入模板
                </Button>

                {/* 文件选择 */}
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleExcelFileChange}
                  className="w-full text-sm"
                />

                {/* Excel 数据预览 */}
                {excelData.length > 0 && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg text-xs">
                    <div className="font-medium mb-2">预览 ({excelData.length} 条数据)</div>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {excelData.slice(0, 5).map((row, index) => (
                        <div key={index} className="flex justify-between text-gray-600">
                          <span>{row.month}</span>
                          <span className="text-gray-400">{row.accountName}</span>
                          <span className="font-medium">¥{row.balance.toFixed(2)}</span>
                        </div>
                      ))}
                      {excelData.length > 5 && (
                        <div className="text-gray-400">...还有 {excelData.length - 5} 条</div>
                      )}
                    </div>
                  </div>
                )}

                {/* 错误提示 */}
                {excelError && (
                  <div className="text-red-500 text-sm">{excelError}</div>
                )}
              </div>

              <DialogFooter>
                <Button
                  onClick={handleExcelImport}
                  disabled={excelData.length === 0}
                  style={{ backgroundColor: '#0ea5e9' }}
                  className="text-white"
                >
                  确认导入
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
