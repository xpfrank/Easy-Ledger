import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { calculateNetWorth } from '@/lib/calculator';
import { getMonthlyAttribution, getAccountSnapshotsByMonth, formatAmountNoSymbol, getSettings, convertToBaseCurrency, getAttributionTagEmoji, getAttributionTagLabel, getAccountsForMonth, getAllAttributionTagOptions, findAttributionTagOption } from '@/lib/storage';
import { Icon } from '@/components/Icon';
import { type ThemeType, THEMES, ATTRIBUTION_CATEGORIES, type TagOption, getCurrencyConfig } from '@/types';
import { useState, useRef } from 'react';
import { Check, X } from 'lucide-react';

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
  const baseCurrencyCode = getSettings().baseCurrency || 'CNY';
  const baseCurrencySymbol = getCurrencyConfig(baseCurrencyCode).symbol;

  // Tab 选中分类，默认选第一个有数据的分类
  const [activeCategory, setActiveCategory] = useState<string>('income');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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

  const groupedTags = getTagsByCategory();
  const selectedTags = new Set<string>(attribution?.tags || []);

  if (!attribution) {
    return null;
  }

  // 当前 Tab 有内容的分类
  const availableCategories = ATTRIBUTION_CATEGORIES.filter(cat => (groupedTags[cat.id] || []).length > 0);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="!fixed !left-1/2 !top-1/2 !-translate-x-1/2 !-translate-y-1/2 !w-[92vw] !max-w-sm flex flex-col overflow-hidden p-0 [&>button]:hidden" style={{ maxHeight: 'calc(min(85dvh, 85vh))' }}>
        <DialogHeader className="flex-shrink-0 bg-white px-4 pt-3 pb-2.5 border-b border-gray-100">
          <div className="relative flex items-center justify-center">
            <DialogTitle className="text-lg font-bold text-center w-full">{year}年{month}月 月度归因</DialogTitle>
            <button
              onClick={onClose}
              className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1.5 -mr-1 rounded-full hover:bg-gray-100 transition-colors"
              aria-label="关闭"
            >
              <X size={20} />
            </button>
          </div>
        </DialogHeader>
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 pt-3 pb-4 space-y-4">
          {/* 净资产变化卡片 */}
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
                  {hideBalance ? '******' : `${baseCurrencySymbol}${formatAmountNoSymbol(lastNW)}`}
                </div>
              </div>
              <div className="text-2xl text-white/50">→</div>
              <div className="text-center">
                <div className="text-xs text-white/70 mb-1">本月</div>
                <div className="text-lg font-bold">
                  {hideBalance ? '******' : `${baseCurrencySymbol}${formatAmountNoSymbol(currentNW)}`}
                </div>
              </div>
            </div>

            <div className="text-center pt-3 border-t border-white/20">
              <span className="text-2xl font-bold">
                {hideBalance ? '******' : (
                  <>
                    {change >= 0 ? '+' : ''}{baseCurrencySymbol}{formatAmountNoSymbol(change)}
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

          {/* 账户资产变动TOP3 */}
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
                      {baseCurrencySymbol}{hideBalance ? '******' : formatAmountNoSymbol(Math.abs(convertToBaseCurrency(item.change, item.currency || 'CNY', year, month)))}
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
                    <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-white border border-gray-200 shadow-sm">
                      {tagOption?.emoji || getAttributionTagEmoji(tag as any)} {tagOption?.label || getAttributionTagLabel(tag as any)}
                    </span>
                  );
                })}
              </div>
            )}
            
            {/* ── 优化后：横向 Tab 分类 + 流式标签 ── */}
            <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
              {/* Tab 栏 */}
              <div className="flex border-b border-gray-100 overflow-x-auto scrollbar-none">
                {availableCategories.map(cat => {
                  const isActive = activeCategory === cat.id;
                  const selectedCount = (groupedTags[cat.id] || []).filter(t => selectedTags.has(t.id)).length;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id)}
                      className={`flex-shrink-0 flex items-center gap-1 px-3 py-2 text-xs font-medium transition-colors relative whitespace-nowrap ${
                        isActive
                          ? 'text-gray-800 bg-gray-50'
                          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50/50'
                      }`}
                    >
                      <span>{cat.emoji}</span>
                      <span>{cat.label}</span>
                      {selectedCount > 0 && (
                        <span
                          className="ml-0.5 w-4 h-4 rounded-full text-white text-[10px] flex items-center justify-center font-bold"
                          style={{ backgroundColor: themeConfig.primary }}
                        >
                          {selectedCount}
                        </span>
                      )}
                      {/* 激活下划线 */}
                      {isActive && (
                        <span
                          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t"
                          style={{ backgroundColor: themeConfig.primary }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* 当前 Tab 的标签内容 */}
              <div className="p-2.5">
                {(groupedTags[activeCategory] || []).length === 0 ? (
                  <div className="text-center text-xs text-gray-300 py-3">暂无标签</div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {(groupedTags[activeCategory] || []).map(tag => {
                      const isSelected = selectedTags.has(tag.id);
                      return (
                        <span
                          key={tag.id}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs transition-all ${
                            isSelected
                              ? 'text-white shadow-sm'
                              : 'bg-gray-50 text-gray-500 border border-gray-100'
                          }`}
                          style={isSelected ? { backgroundColor: themeConfig.primary } : {}}
                        >
                          <span>{tag.emoji}</span>
                          <span>{tag.label}</span>
                          {isSelected && <Check size={10} className="ml-0.5 opacity-80" />}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            
            {/* 影响金额 */}
            <div className="mt-3 pt-3 border-t border-gray-100">
              {attribution.tagAmounts && Object.keys(attribution.tagAmounts).length > 0 ? (
                <div>
                  <div className="text-xs text-gray-500 mb-2">归因金额分配明细</div>
                  <div className="space-y-1.5">
                     {attribution.tags.map(tag => {
                       const tagOption = findAttributionTagOption(tag);
                       const rawAmount = attribution.tagAmounts![tag] ?? 0;
                       const amount = convertToBaseCurrency(rawAmount, attribution.currency || 'CNY', year, month);
                       const isNeg = amount < 0;
                       return (
                         <div key={tag} className="flex items-center justify-between">
                           <span className="text-sm text-gray-600">
                             {tagOption?.emoji || getAttributionTagEmoji(tag as any)}{' '}
                             {tagOption?.label || getAttributionTagLabel(tag as any)}
                           </span>
                           <span className={`text-sm font-medium ${isNeg ? 'text-red-500' : 'text-green-600'}`}>
                             {isNeg ? '' : '+'}{hideBalance ? `${baseCurrencySymbol}***` : `${baseCurrencySymbol}${formatAmountNoSymbol(Math.abs(amount))}`}
                           </span>
                         </div>
                       );
                     })}
                     <div className="flex items-center justify-between pt-1.5 border-t border-gray-100">
                       <span className="text-xs text-gray-400">合计</span>
                       <span className={`text-sm font-semibold ${attribution.change >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                         {(() => {
                           const displayChange = convertToBaseCurrency(attribution.change, attribution.currency || 'CNY', year, month);
                           return `${displayChange >= 0 ? '+' : ''}${hideBalance ? `${baseCurrencySymbol}***` : `${baseCurrencySymbol}${formatAmountNoSymbol(Math.abs(displayChange))}`}`;
                         })()}
                       </span>
                     </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">影响金额：</span>
                  <span className={attribution.change >= 0 ? 'text-green-600' : 'text-red-500'}>
                    {attribution.change >= 0 ? '+' : ''}
                    {baseCurrencySymbol}{hideBalance ? '******' : formatAmountNoSymbol(attribution.change)}
                  </span>
                </div>
              )}

              {/* ── 备注框：onFocus 时自动滚到可视区 ── */}
              {attribution.note && (
                <div className="mt-2">
                  <span className="text-gray-500 text-sm">详细备注：</span>
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
                      {baseCurrencySymbol}{hideBalance ? '******' : formatAmountNoSymbol(convertToBaseCurrency(snapshot.balance, snapshot.currency || 'CNY', year, month))}
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

          {/* 键盘弹出时的底部 padding，防止按钮被遮挡 */}
          <div className="h-safe-area-inset-bottom" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
