import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { calculateNetWorth, getLastRecordedMonth } from '@/lib/calculator';
import { getYearlyAttribution, getAllAccounts, getMonthlyRecord, formatAmountNoSymbol, getAccountSnapshotsByMonth, getMonthlyAttributionsByYear, getAttributionTagLabel, getAttributionTagEmoji, getAccountsForMonth } from '@/lib/storage';
import { Icon } from '@/components/Icon';
import { type ThemeType, THEMES } from '@/types';

interface Props {
  year: number;
  hideBalance: boolean;
  theme?: ThemeType;
  onClose: () => void;
  onEdit: () => void;
}

export default function YearlyAttributionDetail({ year, hideBalance, theme = 'purple', onClose, onEdit }: Props) {
  const attribution = getYearlyAttribution(year);
  const lastMonth = getLastRecordedMonth(year) || 12;
  const currentAccounts = getAccountsForMonth(year, lastMonth).filter(a => !a.isHidden);
  const lastYearAccounts = getAccountsForMonth(year - 1, 12).filter(a => !a.isHidden);
  const currentNW = calculateNetWorth(currentAccounts, year, lastMonth);
  const lastNW = calculateNetWorth(lastYearAccounts, year - 1, 12);
  const change = currentNW - lastNW;
  const changePercent = lastNW !== 0 ? (change / Math.abs(lastNW)) * 100 : 0;

  const themeConfig = THEMES[theme];

  // 账户变动TOP3（年末较年初）- 按累计变动金额排序
  const accounts = getAllAccounts().filter(a => !a.isHidden);
  const accountChanges = accounts.map(account => {
    const currentRecord = getMonthlyRecord(account.id, year, lastMonth);
    const lastRecord = getMonthlyRecord(account.id, year - 1, 12);
    const currentBalance = currentRecord ? currentRecord.balance : account.balance;
    const lastBalance = lastRecord ? lastRecord.balance : account.balance;
    return {
      accountId: account.id,
      accountName: account.name,
      accountIcon: account.icon,
      change: currentBalance - lastBalance,
    };
  }).filter(a => a.change !== 0).sort((a, b) => b.change - a.change).slice(0, 3);

  // 归因排行TOP3 - 按年度累计影响金额排序，100%同步月度归因的中文名称
  const monthlyAttributions = getMonthlyAttributionsByYear(year);
  const tagStats: Record<string, { totalChange: number; months: string[]; label: string; emoji: string }> = {};
  monthlyAttributions.forEach(attr => {
    attr.tags.forEach(tag => {
      if (!tagStats[tag]) {
        tagStats[tag] = { totalChange: 0, months: [], label: getAttributionTagLabel(tag), emoji: getAttributionTagEmoji(tag) };
      }
      tagStats[tag].totalChange += attr.change;
      if (!tagStats[tag].months.includes(`${attr.month}月`)) {
        tagStats[tag].months.push(`${attr.month}月`);
      }
    });
  });
  const sortedTagStats = Object.entries(tagStats)
    .sort((a, b) => b[1].totalChange - a[1].totalChange)
    .slice(0, 3);

  // 账户余额快照
  const snapshots = getAccountSnapshotsByMonth(year, lastMonth);

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
            <div className="flex items-center justify-between mb-4">
              <span className="text-white/80 text-sm">净资产变化</span>
            </div>

            <div className="flex items-center justify-between mb-4">
              <div className="text-center">
                <div className="text-xs text-white/70 mb-1">年初</div>
                <div className="text-lg font-bold">
                  {hideBalance ? '******' : `¥${formatAmountNoSymbol(lastNW)}`}
                </div>
              </div>
              <div className="text-2xl text-white/50">→</div>
              <div className="text-center">
                <div className="text-xs text-white/70 mb-1">年末</div>
                <div className="text-lg font-bold">
                  {hideBalance ? '******' : `¥${formatAmountNoSymbol(currentNW)}`}
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

          {/* 归因排行TOP3 - 按年度累计金额排序，使用月度归因的中文名称 */}
          {sortedTagStats.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-sm font-medium mb-3">归因排行TOP3</div>
              <div className="space-y-2">
                {sortedTagStats.map(([tag, stats], index) => (
                  <div key={tag} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-gray-200 text-xs flex items-center justify-center font-medium">
                        {index + 1}
                      </span>
                      <span>{stats.emoji} {stats.label}</span>
                      <span className="text-xs text-gray-400">{stats.months.length}个月</span>
                    </div>
                    <span className={stats.totalChange >= 0 ? 'text-green-600' : 'text-red-500'}>
                      {stats.totalChange >= 0 ? '+' : ''}
                      ¥{hideBalance ? '******' : formatAmountNoSymbol(Math.abs(stats.totalChange))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 账户余额快照 */}
          {snapshots.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-sm font-medium mb-3">年末账户余额快照</div>
              <div className="space-y-2">
                {snapshots.map(snapshot => (
                  <div key={snapshot.accountId} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon name={snapshot.accountIcon} size={16} />
                      <span className="text-sm">{snapshot.accountName}</span>
                    </div>
                    <span className={snapshot.accountType === 'credit' || snapshot.accountType === 'debt' ? 'text-red-500' : ''}>
                      ¥{hideBalance ? '******' : formatAmountNoSymbol(snapshot.balance)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

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