import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { calculateNetWorth } from '@/lib/calculator';
import { getMonthlyAttribution, getAccountSnapshotsByMonth, formatAmountNoSymbol, getAttributionTagEmoji, getAttributionTagLabel, getAccountsForMonth, getAllAttributionTagOptions, findAttributionTagOption } from '@/lib/storage';
import { Icon } from '@/components/Icon';
import { type ThemeType, THEMES, ATTRIBUTION_CATEGORIES, type TagOption } from '@/types';
import { useState } from 'react';
import { ChevronRight, Check } from 'lucide-react';

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
  const currentAccounts = getAccountsForMonth(year, month).filter(a => !a.isHidden);
  const currentNW = calculateNetWorth(currentAccounts, year, month);
  let lastYear = year, lastMonth = month - 1;
  if (lastMonth === 0) { lastYear--; lastMonth = 12; }
  const lastMonthAccounts = getAccountsForMonth(lastYear, lastMonth).filter(a => !a.isHidden);
  const lastNW = calculateNetWorth(lastMonthAccounts, lastYear, lastMonth);
  const change = currentNW - lastNW;
  const changePercent = lastNW !== 0 ? (change / Math.abs(lastNW)) * 100 : 0;

  const snapshots = getAccountSnapshotsByMonth(year, month);
  const topChanges = snapshots
    .filter(s => s.change !== 0)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 3);

  const themeConfig = THEMES[theme];
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());

  const getTagsByCategory = () => {
    const allTags = getAllAttributionTagOptions();
    const grouped: Record<string, TagOption[]> = {};
    
    ATTRIBUTION_CATEGORIES.forEach(cat => {
      grouped[cat.id] = allTags.filter(t => t.category === cat.id);
    });
    
    const uncategorized = allTags.filter(t => !t.category);
    if (uncategorized.length > 0) {
      grouped['other'] = [...(grouped['other'] || []), ...uncategorized];
    }
    
    return grouped;
  };

  const toggleCategory = (catId: string) => {
    setOpenCategories(prev => {
      const next = new Set(prev);
      if (next.has(catId)) {
        next.delete(catId);
      } else {
        next.add(catId);
      }
      return next;
    });
  };

  const groupedTags = getTagsByCategory();
  const selectedTags = new Set<string>(attribution?.tags || []);

  if (!attribution) {
    return null;
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md overflow-y-auto" style={{ maxHeight: 'min(90dvh, 90vh)' }}>
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
            <div className="flex items-center justify-between mb-4">
              <span className="text-white/80 text-sm">净资产变化</span>
            </div>

            <div className="flex items-center justify-between mb-4">
              <div className="text-center">
                <div className="text-xs text-white/70 mb-1">上月</div>
                <div className="text-lg font-bold">
                  {hideBalance ? '******' : `¥${formatAmountNoSymbol(lastNW)}`}
                </div>
              </div>
              <div className="text-2xl text-white/50">→</div>
              <div className="text-center">
                <div className="text-xs text-white/70 mb-1">本月</div>
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

          {/* 波动等级条 */}
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
                  left: `${Math.min(Math.max(Math.abs(attribution.changePercent), 0), 100)}%`,
                }}
              >
                <div className="w-4 h-4 bg-white border-2 rounded-full shadow-md -mt-0.5" style={{ borderColor: themeConfig.primary }} />
              </div>
            </div>
            <div className="text-center text-xs text-gray-400 mt-3">
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

          {/* 归因信息 */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="text-sm font-medium mb-3">归因信息</div>
            
            {/* 已选标签快捷栏 */}
            {attribution.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {attribution.tags.map(tag => {
                  const tagOption = findAttributionTagOption(tag);
                  return (
                    <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-white border border-gray-200">
                      {tagOption?.emoji || getAttributionTagEmoji(tag as any)} {tagOption?.label || getAttributionTagLabel(tag as any)}
                    </span>
                  );
                })}
              </div>
            )}
            
            {/* 分类折叠选择面板 */}
            <div className="space-y-2">
              {ATTRIBUTION_CATEGORIES.map(cat => {
                const catTags = groupedTags[cat.id] || [];
                if (catTags.length === 0) return null;
                return (
                  <div key={cat.id} className="border border-gray-100 rounded-lg overflow-hidden">
                    <button 
                      onClick={() => toggleCategory(cat.id)}
                      className="w-full flex items-center justify-between p-2.5 bg-white hover:bg-gray-50 transition"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">{cat.emoji}</span>
                        <span className="text-xs font-medium text-gray-700">{cat.label}</span>
                        <span className="text-xs text-gray-400">({catTags.length})</span>
                      </div>
                      <ChevronRight size={14} className={`text-gray-300 transition-transform ${openCategories.has(cat.id) ? 'rotate-90' : ''}`} />
                    </button>
                    {openCategories.has(cat.id) && (
                      <div className="p-2 grid grid-cols-2 gap-1.5 bg-gray-50/50">
                        {catTags.map(tag => (
                          <button
                            key={tag.id}
                            className={`flex items-center gap-1.5 p-2 rounded-lg text-xs transition-all ${
                              selectedTags.has(tag.id)
                                ? 'bg-sky-50 border-2 border-sky-400 text-sky-700'
                                : 'bg-white border-2 border-transparent hover:border-gray-200 text-gray-600'
                            }`}
                          >
                            <span>{tag.emoji}</span>
                            <span>{tag.label}</span>
                            {selectedTags.has(tag.id) && <Check size={12} className="ml-auto text-sky-500" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            {/* 影响金额：有自定义分配时展示明细，否则显示总额 */}
            <div className="mt-3 pt-3 border-t border-gray-100">
              {attribution.tagAmounts && Object.keys(attribution.tagAmounts).length > 0 ? (
                <div>
                  <div className="text-xs text-gray-500 mb-2">归因金额分配明细</div>
                  <div className="space-y-1.5">
                    {attribution.tags.map(tag => {
                      const tagOption = findAttributionTagOption(tag);
                      const amount = attribution.tagAmounts![tag] ?? 0;
                      const isNeg = amount < 0;
                      return (
                        <div key={tag} className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">
                            {tagOption?.emoji || getAttributionTagEmoji(tag as any)}{' '}
                            {tagOption?.label || getAttributionTagLabel(tag as any)}
                          </span>
                          <span className={`text-sm font-medium ${isNeg ? 'text-red-500' : 'text-green-600'}`}>
                            {isNeg ? '' : '+'}{hideBalance ? '¥***' : `¥${formatAmountNoSymbol(Math.abs(amount))}`}
                          </span>
                        </div>
                      );
                    })}
                    <div className="flex items-center justify-between pt-1.5 border-t border-gray-100">
                      <span className="text-xs text-gray-400">合计</span>
                      <span className={`text-sm font-semibold ${attribution.change >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {attribution.change >= 0 ? '+' : ''}
                        {hideBalance ? '¥***' : `¥${formatAmountNoSymbol(attribution.change)}`}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">影响金额：</span>
                  <span className={attribution.change >= 0 ? 'text-green-600' : 'text-red-500'}>
                    {attribution.change >= 0 ? '+' : ''}
                    ¥{hideBalance ? '******' : formatAmountNoSymbol(attribution.change)}
                  </span>
                </div>
              )}
              {attribution.note && (
                <div className="mt-2">
                  <span className="text-gray-500">详细备注：</span>
                  <p className="text-sm mt-1">{attribution.note}</p>
                </div>
              )}
            </div>
          </div>

          {/* 账户余额快照 */}
          {snapshots.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-sm font-medium mb-3">账户余额快照</div>
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