import { useState, useEffect } from 'react';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Icon, PRESET_ICONS } from '@/components/Icon';
import type { Account, PageRoute } from '@/types';
import { 
  addAccount, 
  updateAccount, 
  deleteAccount, 
  getAccountById,
  getMonthlyRecord,
} from '@/lib/storage';
import { ACCOUNT_TYPES } from '@/lib/calculator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

interface AccountEditPageProps {
  onPageChange: (page: PageRoute, params?: any) => void;
  accountId?: string;
}

export function AccountEditPage({ onPageChange, accountId }: AccountEditPageProps) {
  const isEdit = !!accountId;
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
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
  });

  useEffect(() => {
    if (isEdit && accountId) {
      const account = getAccountById(accountId);
      if (account) {
        // 获取当前月份的月度记录余额（优先使用月度记录中的余额）
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        const monthlyRecord = getMonthlyRecord(accountId, currentYear, currentMonth);
        const currentBalance = monthlyRecord ? monthlyRecord.balance : account.balance;
        
        setFormData({
          name: account.name,
          type: account.type,
          icon: account.icon,
          balance: currentBalance,
          includeInTotal: account.includeInTotal,
          isHidden: account.isHidden,
          note: account.note || '',
          billDay: account.billDay || 1,
          repaymentDay: account.repaymentDay || 10,
          graceDays: account.graceDays || 0,
        });
      }
    }
  }, [accountId, isEdit]);

  const handleSave = () => {
    if (!formData.name?.trim()) {
      alert('请输入账户名称');
      return;
    }

    if (isEdit && accountId) {
      updateAccount(accountId, formData);
    } else {
      addAccount(formData as Omit<Account, 'id'>);
    }
    // 保存后返回首页并触发刷新
    onPageChange('home', { refresh: true });
  };

  const handleDelete = () => {
    if (accountId) {
      deleteAccount(accountId);
      onPageChange('accounts');
    }
  };

  const isCredit = formData.type === 'credit';

  return (
    <div className="pb-24 bg-gray-50 min-h-screen">
      {/* 标题栏 */}
      <header className="bg-white px-4 py-3 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => onPageChange('accounts')}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-lg font-semibold">{isEdit ? '编辑账户' : '添加账户'}</h1>
        </div>
        <Button variant="ghost" size="icon" onClick={handleSave}>
          <Save size={20} className="text-sky-600" />
        </Button>
      </header>

      <div className="p-4 space-y-4">
        {/* 账户类型选择 */}
        <Card className="bg-white">
          <CardContent className="p-4">
            <Label className="text-sm font-medium mb-3 block">账户类型</Label>
            <div className="grid grid-cols-3 gap-2">
              {ACCOUNT_TYPES.map((type) => (
                <button
                  key={type.type}
                  onClick={() => setFormData(prev => ({ ...prev, type: type.type }))}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${
                    formData.type === type.type
                      ? 'border-sky-500 bg-sky-50 text-sky-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Icon 
                    name={type.icon} 
                    size={20} 
                    className={formData.type === type.type ? 'text-sky-600' : 'text-gray-400'} 
                  />
                  <span className="text-xs mt-1">{type.label}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 基本信息 */}
        <Card className="bg-white">
          <CardContent className="p-4 space-y-4">
            <div>
              <Label htmlFor="name" className="text-sm font-medium mb-2 block">
                账户名称 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="例如：招商银行储蓄卡"
                className="h-11"
              />
            </div>

            <div>
              <Label className="text-sm font-medium mb-2 block">图标</Label>
              <div className="grid grid-cols-8 gap-2">
                {PRESET_ICONS.map((icon: { name: string; label: string }) => (
                  <button
                    key={icon.name}
                    onClick={() => setFormData(prev => ({ ...prev, icon: icon.name }))}
                    className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                      formData.icon === icon.name
                        ? 'bg-sky-500 text-white'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                    title={icon.label}
                  >
                    <Icon name={icon.name} size={18} />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="balance" className="text-sm font-medium mb-2 block">
                当前余额
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">¥</span>
                <Input
                  id="balance"
                  type="number"
                  step="0.01"
                  value={formData.balance || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, balance: parseFloat(e.target.value) || 0 }))}
                  placeholder="0.00"
                  className="h-11 pl-7"
                />
              </div>
              {isCredit && (
                <p className="text-xs text-gray-400 mt-1">
                  正数 = 欠款，负数 = 溢缴款（多还的钱）
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="note" className="text-sm font-medium mb-2 block">
                备注 <span className="text-gray-400">(可选)</span>
              </Label>
              <Input
                id="note"
                value={formData.note}
                onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                placeholder="添加备注信息"
                className="h-11"
              />
            </div>
          </CardContent>
        </Card>

        {/* 信用卡专属设置 */}
        {isCredit && (
          <Card className="bg-white">
            <CardContent className="p-4 space-y-4">
              <Label className="text-sm font-medium block">信用卡设置</Label>
              
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="billDay" className="text-xs text-gray-500 mb-1 block">
                    账单日
                  </Label>
                  <Input
                    id="billDay"
                    type="number"
                    min={1}
                    max={31}
                    value={formData.billDay}
                    onChange={(e) => setFormData(prev => ({ ...prev, billDay: parseInt(e.target.value) || 1 }))}
                    className="h-10"
                  />
                </div>
                <div>
                  <Label htmlFor="repaymentDay" className="text-xs text-gray-500 mb-1 block">
                    还款日
                  </Label>
                  <Input
                    id="repaymentDay"
                    type="number"
                    min={1}
                    max={31}
                    value={formData.repaymentDay}
                    onChange={(e) => setFormData(prev => ({ ...prev, repaymentDay: parseInt(e.target.value) || 10 }))}
                    className="h-10"
                  />
                </div>
                <div>
                  <Label htmlFor="graceDays" className="text-xs text-gray-500 mb-1 block">
                    顺延天数
                  </Label>
                  <Input
                    id="graceDays"
                    type="number"
                    min={0}
                    max={10}
                    value={formData.graceDays}
                    onChange={(e) => setFormData(prev => ({ ...prev, graceDays: parseInt(e.target.value) || 0 }))}
                    className="h-10"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 设置项 */}
        <Card className="bg-white">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">计入总资产</div>
                <div className="text-xs text-gray-400">该账户余额计入净资产计算</div>
              </div>
              <Switch
                checked={formData.includeInTotal}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, includeInTotal: checked }))}
                className="data-[state=checked]:bg-sky-500"
              />
            </div>
            <div className="border-t border-gray-100 pt-4 flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">隐藏账户</div>
                <div className="text-xs text-gray-400">不在首页账户列表中显示</div>
              </div>
              <Switch
                checked={formData.isHidden}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isHidden: checked }))}
                className="data-[state=checked]:bg-gray-400"
              />
            </div>
          </CardContent>
        </Card>

        {/* 删除按钮（编辑模式） */}
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

      {/* 底部保存按钮 */}
      <div className="fixed bottom-6 left-4 right-4">
        <Button 
          className="w-full bg-sky-500 hover:bg-sky-600 h-12"
          onClick={handleSave}
        >
          <Save size={18} className="mr-2" />
          保存
        </Button>
      </div>

      {/* 删除确认对话框 */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除此账户吗？此操作将同时删除该账户的所有历史记录，且无法恢复。
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
