import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import * as echarts from 'echarts';
import { Button } from '@/components/ui/button';
import {
  getAccountsForMonth,
  getAccountBalanceForMonth,
  getSettings,
  convertToBaseCurrency,
} from '@/lib/storage';
import { THEMES, getCurrencyConfig } from '@/types';
import type { Account, AccountType, PageRoute } from '@/types';

// ─────────────────────────────────────────────
// Types & Constants
// ─────────────────────────────────────────────

interface BalanceSankeyPageProps {
  onPageChange: (page: PageRoute, params?: any) => void;
  onBack?: () => void;
  hideBalance?: boolean;
}

interface SankeyNode {
  name: string;
  depth: number;
  itemStyle: { color: string };
}

interface SankeyLink {
  source: string;
  target: string;
  value: number;
  lineStyle?: { color: string; opacity: number };
}

const TYPE_CONFIG: Record<AccountType, { label: string; color: string; isLiability: boolean }> = {
  cash:       { label: '现金',     color: '#10b981', isLiability: false },
  debit:      { label: '储蓄卡',   color: '#0ea5e9', isLiability: false },
  digital:    { label: '网络支付', color: '#8b5cf6', isLiability: false },
  investment: { label: '投资账户', color: '#f59e0b', isLiability: false },
  loan:       { label: '应收账款', color: '#06b6d4', isLiability: false },
  credit:     { label: '信用卡',   color: '#ef4444', isLiability: true  },
  debt:       { label: '借入',     color: '#f97316', isLiability: true  },
};

function fmtAmt(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}亿`;
  if (abs >= 10_000)      return `${(v / 10_000).toFixed(1)}万`;
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtFull(v: number): string {
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─────────────────────────────────────────────
// Data builder
// ─────────────────────────────────────────────

interface SankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
}

function buildSankeyData(year: number, month: number, themeColor: string): SankeyData {
  const accounts = getAccountsForMonth(year, month).filter(
    (a) => !a.isHidden && a.includeInTotal !== false,
  );

  const balMap = new Map<string, number>();
  let totalAssets = 0;
  let totalLiabilities = 0;

  for (const acc of accounts) {
    const rawBal = getAccountBalanceForMonth(acc.id, year, month);
    const bal = convertToBaseCurrency(rawBal, acc.currency || 'CNY', year, month);
    balMap.set(acc.id, bal);
    if (TYPE_CONFIG[acc.type].isLiability) {
      totalLiabilities += Math.abs(bal);
    } else {
      totalAssets += acc.type === 'credit' && bal < 0 ? Math.abs(bal) : Math.max(0, bal);
    }
  }
  const netWorth = totalAssets - totalLiabilities;

  const typeGroups = new Map<AccountType, Account[]>();
  const typeGroupTotals = new Map<AccountType, number>();

  for (const acc of accounts) {
    const bal = Math.abs(balMap.get(acc.id) ?? 0);
    if (bal < 0.01) continue;
    if (!typeGroups.has(acc.type)) typeGroups.set(acc.type, []);
    typeGroups.get(acc.type)!.push(acc);
    typeGroupTotals.set(acc.type, (typeGroupTotals.get(acc.type) ?? 0) + bal);
  }

  const nodes: SankeyNode[] = [];
  const links: SankeyLink[] = [];
  const ROOT = '净资产';

  nodes.push({ name: ROOT, depth: 0, itemStyle: { color: themeColor } });

  // Group accounts: standard by type, custom by customTypeLabel
  const groups = new Map<string, { color: string; accs: { name: string; id: string; bal: number }[] }>();

  for (const acc of accounts) {
    const bal = Math.abs(balMap.get(acc.id) ?? 0);
    if (bal < 0.01) continue;

    const key = acc.customTypeLabel || TYPE_CONFIG[acc.type]?.label || acc.type;
    const color = TYPE_CONFIG[acc.type]?.color || '#6b7280';

    if (!groups.has(key)) groups.set(key, { color, accs: [] });
    groups.get(key)!.accs.push({ name: acc.name, id: acc.id, bal });
  }

  for (const [label, { color, accs }] of groups) {
    const groupTotal = accs.reduce((s, a) => s + a.bal, 0);
    if (groupTotal < 0.01) continue;

    if (!nodes.find((n) => n.name === label)) {
      nodes.push({ name: label, depth: 1, itemStyle: { color } });
    }
    links.push({ source: ROOT, target: label, value: groupTotal });

    for (const acc of accs) {
      const accKey = `${acc.name}__${acc.id}`;
      if (!nodes.find((n) => n.name === accKey)) {
        nodes.push({ name: accKey, depth: 2, itemStyle: { color: color + 'bb' } });
      }
      links.push({ source: label, target: accKey, value: acc.bal });
    }
  }

  return { nodes, links, totalAssets, totalLiabilities, netWorth };
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function BalanceSankeyPage({ onPageChange, hideBalance = false, onBack }: BalanceSankeyPageProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const zoomWrapperRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const transformRef = useRef({ scale: 1, x: 0, y: 0 });
  const touchStateRef = useRef<{
    isPinching: boolean;
    lastDist: number;
    lastX: number;
    lastY: number;
  } | null>(null);
  const lastRenderScaleRef = useRef(1);
  const [theme, setTheme] = useState<string>('blue');
  const [refreshKey, setRefreshKey] = useState(0);
  const [currencySymbol, setCurrencySymbol] = useState('¥');
  const sankeyDataRef = useRef<SankeyData | null>(null);
  const [displayStats, setDisplayStats] = useState({
    totalAssets: 0,
    totalLiabilities: 0,
    netWorth: 0,
  });

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const validTheme = THEMES[theme as keyof typeof THEMES]
    ? theme
    : 'blue';
  const themeConfig = THEMES[validTheme as keyof typeof THEMES];

  useEffect(() => {
    const settings = getSettings();
    const themeKey = settings.theme ?? 'blue';
    setTheme(themeKey);
    const baseCode = settings.baseCurrency || 'CNY';
    setCurrencySymbol(getCurrencyConfig(baseCode).symbol);
  }, []);

  // ── Build & render chart ─────────────────────────────────────
  const renderChart = useCallback((zoomScale = 1) => {
    if (!chartContainerRef.current) return;

    let data: SankeyData;
    try {
      data = buildSankeyData(year, month, themeConfig.primary);
    } catch (e) {
      console.error('buildSankeyData failed:', e);
      return;
    }
    sankeyDataRef.current = data;
    setDisplayStats({
      totalAssets: data.totalAssets,
      totalLiabilities: data.totalLiabilities,
      netWorth: data.netWorth,
    });
    const { nodes, links, netWorth, totalAssets, totalLiabilities } = data;

    if (!chartInstance.current || chartInstance.current.isDisposed()) {
      chartInstance.current = echarts.init(chartContainerRef.current, undefined, {
        renderer: 'canvas',
        devicePixelRatio: window.devicePixelRatio,
      });
    }

    const chart = chartInstance.current;

    const s = Math.max(0.5, zoomScale);
    const fs0 = Math.max(10, Math.round(12 / s));
    const fs1 = Math.max(9, Math.round(11 / s));
    const fs2 = Math.max(7, Math.round(10 / s));
    const fs2Amount = Math.max(6, Math.round(9 / s));

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',

      tooltip: {
        trigger: 'item',
        confine: true,
        appendToBody: true,
        formatter: (params: any) => {
          if (hideBalance) {
            const name = (params.name as string).split('__')[0];
            return `<div style="padding:8px 12px;min-width:100px">
              <div style="font-size:12px;font-weight:600;color:#374151">${name}</div>
              <div style="font-size:13px;color:#9ca3af;margin-top:2px">****</div>
            </div>`;
          }
          if (params.dataType === 'edge') {
            const totalFlow = totalAssets + totalLiabilities;
            const pct = totalFlow > 0 ? ((params.value / totalFlow) * 100).toFixed(1) : '0.0';
            const src = params.data.source.split('__')[0];
            const tgt = params.data.target.split('__')[0];
            return `<div style="padding:8px 12px;min-width:160px">
              <div style="font-size:12px;font-weight:600;color:#374151;margin-bottom:4px">${src} → ${tgt}</div>
              <div style="font-size:13px;color:#111827;font-weight:700">${currencySymbol}${fmtFull(params.value)}</div>
              <div style="font-size:11px;color:#9ca3af;margin-top:2px">占全部流量 ${pct}%</div>
            </div>`;
          }
          const displayName = (params.name as string).split('__')[0];
          const val = params.value ?? 0;
          const extra = displayName === '净资产'
            ? `<div style="font-size:11px;color:#9ca3af;margin-top:2px">总资产 ${currencySymbol}${fmtFull(totalAssets)} | 总负债 ${currencySymbol}${fmtFull(totalLiabilities)}</div>`
            : '';
          return `<div style="padding:8px 12px;min-width:140px">
            <div style="font-size:12px;font-weight:600;color:#374151;margin-bottom:4px">${displayName}</div>
            <div style="font-size:13px;color:#111827;font-weight:700">${currencySymbol}${fmtFull(displayName === '净资产' ? netWorth : val)}</div>
            ${extra}
          </div>`;
        },
        backgroundColor: '#ffffff',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        borderRadius: 12,
        extraCssText: 'box-shadow:0 8px 24px rgba(0,0,0,0.12);padding:0',
        padding: 0,
      },

      series: [
        {
          type: 'sankey',
          orient: 'horizontal',
          nodeAlign: 'right',
          nodeWidth: 16,
          nodeGap: 20,
          layoutIterations: 64,
          left: '1%',
          right: '18%',
          top: 16,
          bottom: 16,
          draggable: true,
          emphasis: { focus: 'adjacency' },
          blur: {
            lineStyle: { opacity: 0.06 },
            itemStyle: { opacity: 0.15 },
          },

          levels: [
            {
              depth: 0,
              label: {
                position: 'left',
                distance: 8,
                color: '#ffffff',
                fontSize: fs0,
                fontWeight: 'bold',
                formatter: () => hideBalance ? '净资产' : `净资产\n${currencySymbol}${fmtAmt(netWorth)}`,
              },
              itemStyle: { color: themeConfig.primary, borderWidth: 0 },
            },
            {
              depth: 1,
              label: {
                position: 'right',
                distance: 10,
                backgroundColor: '#ffffff',
                borderColor: '#e5e7eb',
                borderWidth: 1,
                borderRadius: 12,
                padding: [6, 12],
                shadowBlur: 6,
                shadowColor: 'rgba(0,0,0,0.06)',
                shadowOffsetY: 2,
                fontWeight: 'bold',
                fontSize: fs1,
              },
              itemStyle: { borderWidth: 0 },
            },
            {
              depth: 2,
              label: {
                position: 'right',
                distance: 6,
                fontSize: fs2,
                color: '#6b7280',
              },
              itemStyle: { borderWidth: 0 },
            },
          ],

          label: {
            show: true,
            fontSize: fs1,
            color: '#374151',
            formatter: (params: any) => {
              const displayName = (params.name as string).split('__')[0];
              const val: number = params.value ?? 0;
              if (hideBalance) return `{n|${displayName}}`;
              return `{n|${displayName}}\n{a|${currencySymbol}${fmtAmt(val)}}`;
            },
            rich: {
              n: { fontSize: fs1, fontWeight: 'bold', color: '#1f2937', lineHeight: Math.round(fs1 * 1.5) },
              a: { fontSize: fs2Amount, color: '#6b7280', lineHeight: Math.round(fs2Amount * 1.5) },
            },
          },

          lineStyle: {
            color: 'source',
            opacity: 0.28,
            curveness: 0.5,
          },

          labelLayout: { hideOverlap: true },

          data: nodes,
          links,
        },
      ],
    };

    chart.setOption(option, { notMerge: true });

    chart.off('click');
    chart.on('click', (params: any) => {
      if (params.dataType !== 'node') return;
      const parts = (params.name as string).split('__');
      if (parts.length === 2) {
        onPageChange('account-detail', { accountId: parts[1] });
      }
    });
  }, [year, month, hideBalance, themeConfig.primary, onPageChange, currencySymbol]);

  const applyTransform = useCallback(() => {
    if (!zoomWrapperRef.current) return;
    const { scale, x, y } = transformRef.current;
    zoomWrapperRef.current.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchStateRef.current = {
        isPinching: true,
        lastDist: Math.hypot(dx, dy),
        lastX: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        lastY: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
    } else if (e.touches.length === 1) {
      touchStateRef.current = {
        isPinching: false,
        lastDist: 0,
        lastX: e.touches[0].clientX,
        lastY: e.touches[0].clientY,
      };
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStateRef.current) return;
    const t = transformRef.current;

    if (e.touches.length === 2 && touchStateRef.current.isPinching) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / (touchStateRef.current.lastDist || dist);
      const newScale = Math.min(5, Math.max(0.4, t.scale * ratio));

      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;

      transformRef.current = {
        scale: newScale,
        x: t.x + (cx - touchStateRef.current.lastX),
        y: t.y + (cy - touchStateRef.current.lastY),
      };
      touchStateRef.current.lastDist = dist;
      touchStateRef.current.lastX = cx;
      touchStateRef.current.lastY = cy;
      applyTransform();
    } else if (e.touches.length === 1 && !touchStateRef.current.isPinching) {
      const dx = e.touches[0].clientX - touchStateRef.current.lastX;
      const dy = e.touches[0].clientY - touchStateRef.current.lastY;
      transformRef.current = { ...t, x: t.x + dx, y: t.y + dy };
      touchStateRef.current.lastX = e.touches[0].clientX;
      touchStateRef.current.lastY = e.touches[0].clientY;
      applyTransform();
    }
  }, [applyTransform]);

  const handleTouchEnd = useCallback(() => {
    touchStateRef.current = null;
    const newScale = transformRef.current.scale;
    if (Math.abs(newScale - lastRenderScaleRef.current) > 0.25) {
      lastRenderScaleRef.current = newScale;
      renderChart(newScale);
    }
  }, [renderChart]);

  const handleDoubleTap = useCallback(() => {
    transformRef.current = { scale: 1, x: 0, y: 0 };
    applyTransform();
    lastRenderScaleRef.current = 1;
    renderChart(1);
  }, [applyTransform, renderChart]);

  useEffect(() => {
    renderChart();
    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, [renderChart, refreshKey]);

  const zoomWrapperStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    transformOrigin: 'center center',
    willChange: 'transform',
    cursor: 'grab',
    touchAction: 'none',
  };

  const { totalAssets, totalLiabilities, netWorth } = displayStats;

  // Legend: types present in data, including custom types
  const legendTypes = (Object.entries(TYPE_CONFIG) as [AccountType, typeof TYPE_CONFIG[AccountType]][])
    .filter(([type]) => {
      const accs = getAccountsForMonth(year, month).filter(a => !a.isHidden && a.includeInTotal !== false);
      return accs.some((a) => a.type === type && !a.customTypeLabel);
    });

  // Custom type legend entries
  const accsForLegend = getAccountsForMonth(year, month).filter(a => !a.isHidden && a.includeInTotal !== false);
  const customTypeMap = new Map<string, { color: string }>();
  for (const acc of accsForLegend) {
    if (acc.customTypeLabel && !customTypeMap.has(acc.customTypeLabel)) {
      customTypeMap.set(acc.customTypeLabel, { color: TYPE_CONFIG[acc.type]?.color || '#6b7280' });
    }
  }

  const chartHeight = (() => {
    const accs = getAccountsForMonth(year, month).filter(a => !a.isHidden && a.includeInTotal !== false);
    const uniqueTypes = new Set(accs.map(a => a.customTypeLabel || a.type)).size;
    const baseHeight = Math.max(360, (typeof window !== 'undefined' ? window.innerHeight : 700) - 56 - 36 - 40 - 32);
    const extraHeight = Math.max(0, (uniqueTypes - 6) * 32);
    return baseHeight + extraHeight;
  })();

  return (
    <div className="min-h-screen flex flex-col overflow-hidden" style={{ backgroundColor: themeConfig.bgLight }}>
      {/* Header - 与 RecordPage/TrendPage 风格一致 */}
      <header className="px-4 pt-safe pb-3 flex justify-between items-center fixed top-0 left-0 right-0 max-w-md mx-auto z-50 shadow-sm rounded-b-2xl" style={{ backgroundColor: themeConfig.primary }}>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="text-white" onClick={() => onBack ? onBack() : onPageChange('home')}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-base font-semibold text-white">余额桑基图</h1>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 text-white bg-white/20 hover:bg-white/30 rounded-full px-3 py-1.5 transition-colors font-bold text-sm">
            {year}年{month}月
          </button>
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 h-9 w-9" onClick={() => setRefreshKey((k) => k + 1)}>
            <RefreshCw size={17} />
          </Button>
        </div>
      </header>

      {/* 占位元素，避免内容被 fixed header 遮挡 */}
      <div className="h-safe-top"></div>

      {/* Stats bar — one line */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 text-xs bg-white/95 backdrop-blur-sm" style={{
        borderBottom: `1px solid ${themeConfig.primary}20`,
      }}>
        <span className="flex items-center gap-1">
          <TrendingUp size={12} className="text-emerald-500" />
          总资产 <b className="text-gray-800">{hideBalance ? '****' : `${currencySymbol}${fmtAmt(totalAssets)}`}</b>
        </span>
        <span className="flex items-center gap-1">
          <Minus size={12} style={{ color: themeConfig.primary }} />
          净资产 <b style={{ color: themeConfig.primary }}>{hideBalance ? '****' : `${currencySymbol}${fmtAmt(netWorth)}`}</b>
        </span>
        <span className="flex items-center gap-1">
          <TrendingDown size={12} className="text-red-400" />
          总负债 <b className="text-red-500">{hideBalance ? '****' : (totalLiabilities > 0 ? `${currencySymbol}${fmtAmt(totalLiabilities)}` : '—')}</b>
        </span>
      </div>

      {/* Chart */}
      <div className="flex-1 relative overflow-hidden bg-white">
        <div className="absolute top-2 left-0 right-0 flex justify-center z-10 pointer-events-none">
          <span className="text-xs text-gray-400 bg-white/80 px-2 py-0.5 rounded-full">双指缩放 · 拖拽移动 · 双击复位 · 点击查看详情</span>
        </div>
        <div
          ref={zoomWrapperRef}
          style={zoomWrapperStyle}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onDoubleClick={handleDoubleTap}
        >
          <div ref={chartContainerRef} style={{ width: '100%', height: chartHeight }} />
        </div>
      </div>

      {/* Legend */}
      <div className="flex-shrink-0 px-4 py-2 overflow-x-auto" style={{ borderTop: `1px solid ${themeConfig.primary}15` }}>
        <div className="flex gap-3 min-w-max">
          {legendTypes.map(([type, cfg]) => (
            <div key={type} className="flex items-center gap-1.5 flex-shrink-0">
              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: cfg.color }} />
              <span className="text-xs text-gray-500">{cfg.label}</span>
            </div>
          ))}
          {Array.from(customTypeMap.entries()).map(([label, { color }]) => (
            <div key={`custom_${label}`} className="flex items-center gap-1.5 flex-shrink-0">
              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
              <span className="text-xs text-gray-500">{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: themeConfig.primary }} />
            <span className="text-xs text-gray-500">净资产</span>
          </div>
        </div>
      </div>
    </div>
  );
}
