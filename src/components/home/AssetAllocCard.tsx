import { useMemo } from 'react';
import { PieChart, Pie, Cell } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { Droplets, Landmark, TrendingUp, Shield, ChevronRight, Shuffle } from 'lucide-react';
import type { Account } from '@/types';

import {
  CATEGORY_KEYS,
  CATEGORY_META,
  getCategoryPercentages,

} from '@/lib/allocation-config';


interface AssetAllocCardProps {
  accounts: Account[];
  categoryAmounts: {
    cash: number;
    stable: number;
    invest: number;
    insure: number;
  };
  currentAllocations?: {
    cash: number;
    stable: number;
    invest: number;
    insure: number;
  };
  primaryColor: string;
  configKey?: number;
  hasClassifiedAccounts?: boolean;
  onClassifyClick?: () => void;
  onReclassifyClick?: () => void;
  hideBalance?: boolean;
}

const CATEGORY_ICONS: Record<string, typeof Droplets> = {
  cash: Droplets,
  stable: Landmark,
  invest: TrendingUp,
  insure: Shield,
};

export function AssetAllocCard({
  accounts,
  categoryAmounts,
  // currentAllocations,
  primaryColor,
  // configKey = 0,
  hasClassifiedAccounts = false,
  onClassifyClick,
  onReclassifyClick,
  hideBalance = false,
}: AssetAllocCardProps) {
    const totalAmount = useMemo(() => {
    return categoryAmounts.cash + categoryAmounts.stable + categoryAmounts.invest + categoryAmounts.insure;
  }, [categoryAmounts]);

  const pieData = useMemo(() => {
    const data: { name: string; value: number; color: string }[] = [];
    CATEGORY_KEYS.forEach((key) => {
      const amount = categoryAmounts[key];
      if (amount > 0) {
        data.push({ name: CATEGORY_META[key].label, value: amount, color: CATEGORY_META[key].color });
      }
    });
    return data;
  }, [categoryAmounts]);

  const categoryPercentages = useMemo(() => {
    const pcts = getCategoryPercentages(categoryAmounts);
    return CATEGORY_KEYS.map((key) => ({
      key,
      ...CATEGORY_META[key],
      amount: categoryAmounts[key],
      percentage: (categoryAmounts[key] / (totalAmount || 1)) * 100,
      displayPct: totalAmount > 0 ? pcts[key] : 0,
    }));
  }, [categoryAmounts, totalAmount]);

  const categoryCounts = useMemo(() => {
    const counts = { cash: 0, stable: 0, invest: 0, insure: 0 };
    accounts.forEach((acc) => {
      if (acc.assetCategory && acc.assetCategory in counts) {
        counts[acc.assetCategory as keyof typeof counts]++;
      }
    });
    return counts;
  }, [accounts]);

  const unclassifiedCount = accounts.filter((a) => !a.assetCategory).length;
  const isEmpty = accounts.length === 0;
  const needsClassify = accounts.length > 0 && !hasClassifiedAccounts;

  const formatAmount = (amount: number) => {
    if (amount >= 10000) return `${(amount / 10000).toFixed(1)}万`;
    return amount.toFixed(0);
  };

  if (isEmpty) return null;

  return (
    <Card className="bg-white overflow-hidden">
      <CardContent className="p-4">
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-[13.5px] font-bold text-[#0f1923]">资产配置结构</span>
            {unclassifiedCount > 0 && (
              <span className="ml-2 text-[11px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                {unclassifiedCount}个未分类
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); (onReclassifyClick || onClassifyClick)?.(); }}
            className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full relative z-10"
            style={{ color: primaryColor, backgroundColor: `${primaryColor}12` }}
          >
            <Shuffle size={12} />
            <span>调整分类</span>
          </button>
        </div>

        {/* 阶段二：未分类引导 */}
        {needsClassify ? (
          <div
            className="flex items-center justify-between px-4 py-4 rounded-xl bg-amber-50/60 border border-amber-200/60 cursor-pointer"
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); onClassifyClick?.(); }}
          >
            <div>
              <div className="text-[13px] font-bold text-amber-800 mb-0.5">
                你有 {accounts.length} 个账户尚未分类
              </div>
              <div className="text-[11px] text-amber-600">
                分类后即可查看资产配置结构
              </div>
            </div>
            <div className="flex items-center gap-1 text-[12px] font-bold text-amber-700 shrink-0">
              去分类
              <ChevronRight size={14} />
            </div>
          </div>
        ) : (
          /* 阶段三：正常显示 */
          <>
            <div className="flex items-center gap-4 mb-3">
              {/* 饼图 */}
              <div className="relative w-[100px] h-[100px] shrink-0">
                <PieChart width={100} height={100} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <Pie
                    data={pieData}
                    cx={50}
                    cy={50}
                    innerRadius={28}
                    outerRadius={44}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
                <div
                  className="absolute pointer-events-none flex flex-col items-center justify-center"
                  style={{ width: 56, height: 56, left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
                >
                  <span className="text-[16px] font-extrabold text-[#0f1923] leading-none tabular-nums">
                    {pieData.length}
                  </span>
                  <span className="text-[9px] text-[#8fa3b8] font-medium mt-0.5">类资产</span>
                </div>
              </div>

              {/* 右侧进度条 */}
              <div className="flex-1 min-w-0 space-y-[7px]">
                {categoryPercentages.map((item) => (
                  <div key={item.key} className="flex items-center gap-1.5">
                    <div className="w-[6px] h-[6px] rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-[10px] text-gray-500 w-14 shrink-0 truncate">{item.label}</span>
                    <div className="flex-1 h-[5px] bg-gray-100 rounded-full overflow-hidden min-w-0">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min(item.displayPct, 100)}%`, backgroundColor: item.color }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-[#0f1923] w-10 text-right shrink-0 tabular-nums">
                      {item.displayPct.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 四类资产卡片 */}
            <div className="grid grid-cols-4 gap-2">
              {categoryPercentages.map((item) => {
                const count = categoryCounts[item.key];
                const IconComp = CATEGORY_ICONS[item.key];
                return (
                  <div
                    key={item.key}
                    className="flex flex-col items-center py-2.5 px-1 rounded-xl"
                    style={{ backgroundColor: `${item.color}08` }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center mb-1"
                      style={{ backgroundColor: `${item.color}15`, color: item.color }}
                    >
                      {IconComp && <IconComp size={16} />}
                    </div>
                    <span className="text-[10px] text-gray-500 font-medium text-center leading-tight mb-1">
                      {item.label}
                    </span>
                    <span className="text-[14px] font-extrabold tabular-nums" style={{ color: item.color }}>
                      {hideBalance ? '******' : `¥${formatAmount(item.amount)}`}
                    </span>
                    <span className="text-[10px] text-gray-500 font-medium mt-0.5">
                      {hideBalance ? '**' : count}个账户
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
