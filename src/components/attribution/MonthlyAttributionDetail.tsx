import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { calculateNetWorth } from '@/lib/calculator';
import { getMonthlyAttribution, getAccountSnapshotsByMonth, formatAmountNoSymbol, getAttributionTagEmoji, getAttributionTagLabel } from '@/lib/storage';
import { Icon } from '@/components/Icon';
import { type ThemeType, THEMES } from '@/types';

interface Props {
  year: number;
  month: number;
  hideBalance: boolean;
  theme?: ThemeType;
  onClose: () => void;
  onEdit: () => void;
}

export default function MonthlyAttributionDetail({ year, month, hideBalance, theme = 'blue', onClose, onEdit }: Props) {
  const attribution = getMonthlyAttribution(year, month);
  const currentNW = calculateNetWorth(year, month);
  let lastYear = year, lastMonth = month - 1;
  if (lastMonth === 0) { lastYear--; lastMonth = 12; }
  const lastNW = calculateNetWorth(lastYear, lastMonth);
  const change = currentNW - lastNW;
  const changePercent = lastNW !== 0 ? (change / Math.abs(lastNW)) * 100 : 0;

  const snapshots = getAccountSnapshotsByMonth(year, month);
  const topChanges = snapshots
    .filter(s => s.change !== 0)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 3);

  const themeConfig = THEMES[theme];

  if (!attribution) {
    return null;
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{year}年{month}月 月度归因</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          {/* 净资产变化卡片 - 使用主题色 */}
          <div 
            className="rounded-xl p-5 text-white"
            style={{ 
              background: `linear-gradient(135deg, ${themeConfig.gradientFrom} 0%, ${themeConfig.gradientTo} 100%)` 
            }}
          >
            <div className="text-white/80 text-sm mb-2">净资产变化</div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-white/70">上月</div>
                <div className="text-lg font-bold">
                  {hideBalance ? '******' : `¥${formatAmountNoSymbol(lastNW)}`}
                </div>
              </div>
              <div className="text-2xl">→</div>
              <div>
                <div className="text-xs text-white/70">本月</div>
                <div className="text-lg font-bold">
                  {hideBalance ? '******' : `¥${formatAmountNoSymbol(currentNW)}`}
                </div>
              </div>
            </div>
            <div className="mt-4 text-center">
              <span className="text-2xl font-bold">
                {hideBalance ? '******' : (
                  <>
                    {change >= 0 ? '+' : ''}¥{formatAmountNoSymbol(change)}
                  </>
                )}
              </span>
              <span className="text-sm ml-2 opacity-80">
                ({change >= 0 ? '+' : ''}{changePercent.toFixed(1)}%)
              </span>
            </div>
          </div>

          {/* 波动等级条 */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>正常</span><span>需关注</span><span>异常</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full flex">
              <div className="h-full bg-green-500 w-1/3" />
              <div className="h-full bg-yellow-500 w-1/3" />
              <div className="h-full bg-red-500 w-1/3" />
            </div>
            <div className="text-center text-xs text-gray-400 mt-2">
              当前波动: {Math.abs(attribution.changePercent).toFixed(1)}%
            </div>
          </div>

          {/* 账户资产变动TOP3 - 添加 hideBalance 判断 */}
          {topChanges.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-sm font-medium mb-3">账户资产变动TOP3</div>
              <div className="space-y-2">
                {topChanges.map(item => (
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

          {/* 归因信息 - 添加 hideBalance 判断 */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="text-sm font-medium mb-2">归因信息</div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-gray-500">归因原因：</span>
                <span className="font-medium">
                  {attribution.tags.map(tag => (
                    <span key={tag} className="mr-2">
                      {getAttributionTagEmoji(tag)} {getAttributionTagLabel(tag)}
                    </span>
                  ))}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">影响金额：</span>
                <span className={attribution.change >= 0 ? 'text-green-600' : 'text-red-500'}>
                  {attribution.change >= 0 ? '+' : ''}
                  ¥{hideBalance ? '******' : formatAmountNoSymbol(attribution.change)}
                </span>
              </div>
              {attribution.note && (
                <div>
                  <span className="text-gray-500">详细备注：</span>
                  <p className="text-sm mt-1">{attribution.note}</p>
                </div>
              )}
            </div>
          </div>

          <Button 
            onClick={onEdit} 
            className="w-full text-white"
            style={{ backgroundColor: themeConfig.primary }}
          >
            编辑此月归因
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}