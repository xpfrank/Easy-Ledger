import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { calculateNetWorth } from '@/lib/calculator';
import { getYearlyAttribution, getAllAccounts, getMonthlyRecord, formatAmountNoSymbol } from '@/lib/storage';
import { Icon } from '@/components/Icon';
import { getYearlyAttributionTagLabel, getYearlyAttributionTagEmoji, type ThemeType, THEMES } from '@/types';

interface Props {
  year: number;
  hideBalance: boolean;
  theme?: ThemeType;
  onClose: () => void;
  onEdit: () => void;
}

function formatHiddenAmount(amount: number, hide: boolean): string {
  if (hide) return '******';
  return formatAmountNoSymbol(amount);
}

export default function YearlyAttributionDetail({ year, hideBalance, theme = 'purple', onClose, onEdit }: Props) {
  const attribution = getYearlyAttribution(year);
  const currentNW = calculateNetWorth(year, 12);
  const lastNW = calculateNetWorth(year - 1, 12);
  const change = currentNW - lastNW;
  const changePercent = lastNW !== 0 ? (change / Math.abs(lastNW)) * 100 : 0;

  const themeConfig = THEMES[theme];

  // 账户变动TOP3（年末较年初）
  const accounts = getAllAccounts().filter(a => !a.isHidden);
  const accountChanges = accounts.map(account => {
    const currentRecord = getMonthlyRecord(account.id, year, 12);
    const lastRecord = getMonthlyRecord(account.id, year - 1, 12);
    const currentBalance = currentRecord ? currentRecord.balance : account.balance;
    const lastBalance = lastRecord ? lastRecord.balance : account.balance;
    return {
      accountId: account.id,
      accountName: account.name,
      accountIcon: account.icon,
      change: currentBalance - lastBalance,
    };
  }).filter(a => a.change !== 0).sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 3);

  if (!attribution) return null;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{year}年 年度归因</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          {/* 年末净资产卡片 - 使用主题色 */}
          <div 
            className="rounded-xl p-5 text-white"
            style={{ 
              background: `linear-gradient(135deg, ${themeConfig.gradientFrom} 0%, ${themeConfig.gradientTo} 100%)` 
            }}
          >
            <div className="text-white/80 text-sm mb-2">年末净资产</div>
            <div className="text-3xl font-bold">
              {hideBalance ? '******' : `¥${formatAmountNoSymbol(attribution.netWorth)}`}
            </div>
            <div className="flex items-center gap-4 mt-4">
              <div>
                <div className="text-xs text-white/70">较年初</div>
                <div className="font-bold">
                  {change >= 0 ? '+' : ''}
                  {hideBalance ? '******' : `¥${formatAmountNoSymbol(change)}`}
                </div>
              </div>
              <div>
                <div className="text-xs text-white/70">变化率</div>
                <div className="font-bold">
                  {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          {/* 账户资产变动TOP3 - 添加 hideBalance */}
          {accountChanges.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-sm font-medium mb-3">账户资产变动TOP3</div>
              <div className="space-y-2">
                {accountChanges.map(item => (
                  <div key={item.accountId} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon name={item.accountIcon} size={16} />
                      <span className="text-sm">{item.accountName}</span>
                    </div>
                    <span className={item.change >= 0 ? 'text-green-600' : 'text-red-500'}>
                      {item.change >= 0 ? '+' : ''}
                      ¥{hideBalance ? '******' : formatAmountNoSymbol(Math.abs(item.change))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 归因排行TOP3 */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="text-sm font-medium mb-3">归因排行TOP3</div>
            <div className="space-y-2">
              {attribution.tags.map((tag, index) => (
                <div key={tag} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-gray-200 text-xs flex items-center justify-center">
                      {index + 1}
                    </span>
                    <span>{getYearlyAttributionTagEmoji(tag)} {getYearlyAttributionTagLabel(tag)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 年度总结 */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="text-sm font-medium mb-2">年度总结</div>
            <div className="space-y-2 text-sm">
              {attribution.keyMonths.length > 0 && (
                <div>
                  <span className="text-gray-500">关键月份：</span>
                  {attribution.keyMonths.join('月、')}月
                </div>
              )}
              {attribution.note && (
                <div>
                  <span className="text-gray-500">详细备注：</span>
                  <p className="mt-1">{attribution.note}</p>
                </div>
              )}
            </div>
          </div>

          <Button 
            onClick={onEdit} 
            className="w-full text-white"
            style={{ backgroundColor: themeConfig.primary }}
          >
            编辑年度归因
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}