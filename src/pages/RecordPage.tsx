import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Icon } from '@/components/Icon';
import type { Account, PageRoute, RecordMode, AttributionTag } from '@/types';
import { 
  getAllAccounts, 
  getMonthlyRecord, 
  setMonthlyRecord, 
  formatAmount, 
  saveMonthlyAttribution, 
  getAccountSnapshotsByMonth 
} from '@/lib/storage';
import { calculateTotalAssets, calculateTotalLiabilities } from '@/lib/calculator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

// 标签配置
const ATTRIBUTION_CONFIG: Record<string, { label: string; emoji: string }> = {
  salary: { label: '工资收入', emoji: '💰' },
  bonus: { label: '奖金', emoji: '🎁' },
  year_end_bonus: { label: '年终奖', emoji: '🧧' },
  investment: { label: '投资收益', emoji: '📈' },
  daily: { label: '日常波动', emoji: '🔄' },
  loan_repayment: { label: '借款归还', emoji: '🔄' },
  large_expense: { label: '大额支出', emoji: '🛒' },
  transfer: { label: '转账调整', emoji: '🔀' },
  other: { label: '其他', emoji: '📝' },
};

const NORMAL_TAGS = ['salary', 'investment', 'daily', 'other'];
const ABNORMAL_TAGS = ['salary', 'bonus', 'year_end_bonus', 'investment', 'loan_repayment', 'large_expense', 'transfer', 'other'];

interface RecordPageProps {
  onPageChange: (page: PageRoute, params?: any) => void;
  params?: any;
}

export function RecordPage({ onPageChange, params }: RecordPageProps) {
  const [year, setYear] = useState(params?.year || new Date().getFullYear());
  const [month, setMonth] = useState(params?.month || new Date().getMonth() + 1);
  const [mode, setMode] = useState<RecordMode>(params?.mode || 'monthly');
  
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [records, setRecords] = useState<Record<string, number>>({});
  
  // 核心拦截状态
  const [hasChanged, setHasChanged] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [attribution, setAttribution] = useState<{ tags: string[], note: string }>({ tags: [], note: '' });

  // 初始化数据
  useEffect(() => {
    const data = getAllAccounts();
    setAccounts(data);
    const initialRecords: Record<string, number> = {};
    data.forEach(acc => {
      const rec = getMonthlyRecord(acc.id, year, month);
      initialRecords[acc.id] = rec ? rec.balance : acc.balance;
    });
    setRecords(initialRecords);
  }, [year, month]);

  // 计算波动数据
  const previewData = useMemo(() => {
    // 当前输入的总资产
    let currentAssets = 0;
    let currentLiabilities = 0;
    accounts.forEach(acc => {
      const bal = records[acc.id] || 0;
      if (acc.type === 'credit' || acc.type === 'debt') currentLiabilities += Math.abs(bal);
      else currentAssets += bal;
    });
    const currentNetWorth = currentAssets - currentLiabilities;

    // 上月总资产
    let lastYear = year;
    let lastMonth = month - 1;
    if (lastMonth === 0) { lastYear--; lastMonth = 12; }
    const lastAssets = calculateTotalAssets(lastYear, lastMonth);
    const lastLiabilities = calculateTotalLiabilities(lastYear, lastMonth);
    const lastNetWorth = lastAssets - lastLiabilities;

    const change = currentNetWorth - lastNetWorth;
    const percent = lastNetWorth === 0 ? 0 : (change / Math.abs(lastNetWorth)) * 100;
    
    return { currentNetWorth, lastNetWorth, change, percent, isAnomaly: Math.abs(percent) > 30 };
  }, [records, accounts, year, month]);

  const handleInputChange = (id: string, value: string) => {
    setRecords({ ...records, [id]: Number(value) });
    setHasChanged(true); // 触发修改状态
  };

  const handleSave = () => {
    // 保存记录
    Object.entries(records).forEach(([id, bal]) => setMonthlyRecord(id, year, month, bal));
    
    // 如果选择了标签，保存归因
    if (attribution.tags.length > 0 || attribution.note) {
      saveMonthlyAttribution(
        year, month,
        previewData.change,
        previewData.percent,
        attribution.tags as AttributionTag[],
        attribution.note
      );
    }
    
    setHasChanged(false);
    setShowPreview(false);
    onPageChange('home');
  };

  const toggleTag = (tag: string) => {
    if (previewData.isAnomaly) {
      // 异常强制单选
      setAttribution({ ...attribution, tags: [tag] });
    } else {
      // 正常允许多选
      const newTags = attribution.tags.includes(tag) 
        ? attribution.tags.filter(t => t !== tag)
        : [...attribution.tags, tag];
      setAttribution({ ...attribution, tags: newTags });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* 头部导航 */}
      <header className="bg-white px-4 py-3 flex justify-between items-center fixed top-0 left-0 right-0 z-50 shadow-sm">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => onPageChange('home')}><ArrowLeft size={20} /></Button>
          <h1 className="text-lg font-semibold">{year}年{month}月 记账</h1>
        </div>
      </header>
      <div className="h-16"></div>

      {/* 账户列表录入区 */}
      <div className="p-4 space-y-3">
        {accounts.map(acc => (
          <Card key={acc.id} className="overflow-hidden bg-white">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Icon name={acc.icon} size={24} className={acc.type === 'credit' ? 'text-red-400' : 'text-blue-400'} />
                <div className="font-medium text-sm">{acc.name}</div>
              </div>
              <Input 
                type="number" 
                className="w-32 text-right font-medium" 
                value={records[acc.id] === 0 ? '' : records[acc.id]} 
                placeholder="0.00"
                onChange={(e) => handleInputChange(acc.id, e.target.value)}
              />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 需求 4.1：预览按钮 */}
      {hasChanged && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] z-40">
          <Button className="w-full h-12 text-base shadow-md" onClick={() => setShowPreview(true)}>
            预览本月记账
          </Button>
        </div>
      )}

      {/* 需求 4.2：归因预览弹窗 */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-[90vw] rounded-2xl p-5 bg-white">
          <DialogHeader>
            <DialogTitle>资产变动确认</DialogTitle>
            {previewData.isAnomaly && (
              <div className="text-orange-500 text-xs flex items-center gap-1 mt-1 bg-orange-50 p-2 rounded-lg">
                <AlertTriangle size={14} /> 本月变化幅度较大，建议记录原因
              </div>
            )}
          </DialogHeader>
          
          <div className="space-y-5 my-2">
            {/* 变化对比 */}
            <div className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-100">
              <div>
                <div className="text-xs text-gray-500 mb-1">上月 → 本月</div>
                <div className="text-lg font-bold text-gray-800">{formatAmount(previewData.currentNetWorth)}</div>
              </div>
              <div className="text-right">
                <div className={`text-sm font-bold ${previewData.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {previewData.change >= 0 ? '↑' : '↓'} {previewData.percent.toFixed(1)}%
                </div>
                <div className={`text-xs ${previewData.change >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {previewData.change >= 0 ? '+' : ''}{formatAmount(previewData.change)}
                </div>
              </div>
            </div>

            {/* 归因标签 */}
            <div>
              <div className="text-sm font-medium mb-3 text-gray-700">变化原因 {previewData.isAnomaly ? '(必选)' : '(可选)'}</div>
              <div className="grid grid-cols-4 gap-2">
                {(previewData.isAnomaly ? ABNORMAL_TAGS : NORMAL_TAGS).map(tag => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`flex flex-col items-center justify-center py-2 rounded-xl border transition-all ${
                      attribution.tags.includes(tag) ? 'bg-blue-50 border-blue-500 text-blue-600 shadow-sm' : 'bg-white border-gray-100 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <div className="text-xl mb-1">{ATTRIBUTION_CONFIG[tag]?.emoji}</div>
                    <div className="text-[10px] whitespace-nowrap">{ATTRIBUTION_CONFIG[tag]?.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 备注 */}
            <textarea 
              placeholder="记录本月发生的大事记..."
              className="w-full p-3 bg-gray-50 rounded-xl text-sm border-none focus:ring-1 focus:ring-blue-500 outline-none"
              rows={3}
              value={attribution.note}
              onChange={(e) => setAttribution({...attribution, note: e.target.value})}
            />
          </div>

          <DialogFooter>
            <Button 
              className="w-full h-11 text-base rounded-xl"
              disabled={previewData.isAnomaly && attribution.tags.length === 0}
              onClick={handleSave}
            >
              确认保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}