import { useState, useEffect, useRef, useCallback } from 'react';
import { X, TrendingUp, Target, Calendar, TrendingUpIcon } from 'lucide-react';
import { formatAmountNoSymbol } from '@/lib/storage';
import { getMonthlyNetWorthTrend } from '@/lib/health-calculator';
import type { YearlyGoal } from '@/types';

// 色彩语义定义 - 精简，去除彩色底色
const COLORS = {
  growth: '#22c55e',
  target: '#3b82f6',
  warning: '#f59e0b',
  neutral: '#6b7280',
};

interface GoalDetailModalProps {
  goal: YearlyGoal;
  goalProgress: {
    progress: number;
    estimatedMonthsToGoal: number;
    isOnTrack: boolean;
    monthlyGrowthRate: number;
  };
  currentNetWorth: number;
  hideBalance: boolean;
  primaryColor: string;
  baseCurrencySymbol?: string;
  onClose: () => void;
  onEdit?: () => void;
}

export function GoalDetailModal({
  goal,
  goalProgress,
  currentNetWorth,
  hideBalance,
  primaryColor,
  baseCurrencySymbol = '¥',
  onClose,
  onEdit,
}: GoalDetailModalProps) {
  const remaining = goal.targetAmount - currentNetWorth;
  const { progress, estimatedMonthsToGoal, isOnTrack, monthlyGrowthRate } = goalProgress;
  const sym = baseCurrencySymbol;

  const displayProgress = progress.toFixed(1);

  const getStatusChip = () => {
    if (progress >= 100) return { text: '🎉 已达成', color: COLORS.growth };
    if (estimatedMonthsToGoal > 0 && isOnTrack) {
      if (monthlyGrowthRate > 0 && monthlyGrowthRate > Math.abs(goal.targetAmount - currentNetWorth) / (estimatedMonthsToGoal || 1) * 0.8) {
        return { text: '⚡ 增速超前', color: '#8b5cf6' };
      }
      return { text: '📅 稳步推进', color: COLORS.target };
    }
    if (estimatedMonthsToGoal === -1) return { text: '⚠️ 需要加速', color: '#ef4444' };
    return { text: '📊 持续追踪', color: COLORS.warning };
  };
  const chip = getStatusChip();

  const getEstimateInfo = useCallback(() => {
    if (progress >= 100) return { date: '已达成', months: 0, fullDate: '已达成' };
    if (estimatedMonthsToGoal > 0) {
      const now = new Date();
      const tm = now.getMonth() + 1 + estimatedMonthsToGoal;
      const ty = now.getFullYear() + Math.floor((tm - 1) / 12);
      const mm = ((tm - 1) % 12) + 1;
      return { 
        date: `${ty}.${String(mm).padStart(2, '0')}`, 
        months: estimatedMonthsToGoal,
        fullDate: `${ty}年${mm}月`
      };
    }
    if (estimatedMonthsToGoal === 0 && monthlyGrowthRate > 0) return { date: '即将达成', months: 0, fullDate: '即将达成' };
    return { date: '暂无法预测', months: -1, fullDate: '暂无法预测' };
  }, [progress, estimatedMonthsToGoal, monthlyGrowthRate]);

  const estimateInfo = getEstimateInfo();

  const fmtShort = (n: number): string => {
    if (hideBalance) return '****';
    const a = Math.abs(n);
    if (a >= 10000) return `${(n / 10000).toFixed(1)}万`;
    return formatAmountNoSymbol(n);
  };
  
  const fmtWan = (n: number): string => {
    if (hideBalance) return '****';
    const a = Math.abs(n);
    if (a >= 100000) return `${(n / 10000).toFixed(1)}万`;
    return formatAmountNoSymbol(n);
  };

  const [trendData, setTrendData] = useState<Array<{ year: number; month: number; netWorth: number }>>([]);
  useEffect(() => {
    try {
      const raw = getMonthlyNetWorthTrend(6);
      const now = new Date();
      const cm = now.getMonth() + 1;
      const cy = now.getFullYear();
      const enriched = raw.map((d, i) => {
        const monthsAgo = raw.length - 1 - i;
        const m = cm - monthsAgo;
        const y = cy + Math.floor((m - 1) / 12);
        const mm = ((m % 12) + 11) % 12 + 1;
        return { ...d, year: y, month: mm };
      });
      setTrendData(enriched);
    } catch {
      setTrendData([]);
    }
  }, [goal.year]);

  const avgGrowth = (() => {
    if (trendData.length < 2) return 0;
    let t = 0;
    for (let i = 1; i < trendData.length; i++) t += trendData[i].netWorth - trendData[i - 1].netWorth;
    return t / (trendData.length - 1);
  })();

  const isNearGoal = progress >= 80;
  const isFastGrowth = monthlyGrowthRate > 0 && avgGrowth > 0 && monthlyGrowthRate > avgGrowth * 0.8;
  const isOverdue = estimatedMonthsToGoal > 6 && !isOnTrack;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 绘制趋势图 - 精简padding，确保首屏可见
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || trendData.length === 0) return;
    const rAF = requestAnimationFrame(() => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const W = rect.width || 340;
      const H = 160; // 减小高度
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.scale(dpr, dpr);

      const pL = 56, pR = 12, pT = 20, pB = 32;
      const cW = W - pL - pR;
      const cH = H - pT - pB;
      const vals = trendData.map(d => d.netWorth);
      
      const dataMin = Math.min(...vals);
      const dataMax = Math.max(...vals, goal.targetAmount);
      const padding = (dataMax - dataMin) * 0.1;
      const mn = Math.max(0, dataMin - padding);
      const mx = dataMax + padding;
      
      const rng = mx - mn || 1;
      const xS = vals.length > 1 ? cW / (vals.length - 1) : cW / 2;
      const toX = (i: number) => pL + i * xS;
      const toY = (v: number) => pT + cH - ((v - mn) / rng) * cH;

      ctx.clearRect(0, 0, W, H);

      // 网格线
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let i = 0; i <= 4; i++) {
        const y = pT + (cH / 4) * i;
        const val = mx - (rng / 4) * i;
        
        ctx.strokeStyle = i === 0 || i === 4 ? '#e5e7eb' : '#f3f4f6';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pL, y);
        ctx.lineTo(W - pR, y);
        ctx.stroke();
        
        ctx.fillStyle = COLORS.neutral;
        ctx.font = '500 10px system-ui, sans-serif';
        const label = val >= 10000 ? `${(val / 10000).toFixed(1)}万` : Math.round(val).toLocaleString();
        ctx.fillText(`${sym}${label}`, pL - 8, y);
      }

      // 目标线
      const gY = pT + ((mx - goal.targetAmount) / rng) * cH;
      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = `${COLORS.target}80`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pL, gY);
      ctx.lineTo(W - pR, gY);
      ctx.stroke();
      ctx.restore();
      
      ctx.fillStyle = COLORS.target;
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('目标', pL + 4, gY - 6);

      // 填充区域
      ctx.beginPath();
      ctx.moveTo(toX(0), pT + cH);
      vals.forEach((v, i) => ctx.lineTo(toX(i), toY(v)));
      ctx.lineTo(toX(vals.length - 1), pT + cH);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, pT, 0, pT + cH);
      grad.addColorStop(0, `${primaryColor}25`);
      grad.addColorStop(1, `${primaryColor}05`);
      ctx.fillStyle = grad;
      ctx.fill();

      // 折线
      ctx.beginPath();
      vals.forEach((v, i) => {
        i === 0 ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v));
      });
      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      // 数据点
      vals.forEach((v, i) => {
        const x = toX(i);
        const y = toY(v);
        
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        if (i === vals.length - 1) {
          ctx.beginPath();
          ctx.arc(x, y, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = primaryColor;
          ctx.fill();
        }
      });

      // X轴标签
      ctx.fillStyle = COLORS.neutral;
      ctx.font = '500 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      const labelCount = vals.length;
      let step = 1;
      if (labelCount > 6) step = 2;

      trendData.forEach((d, i) => {
        if (i % step === 0 || i === labelCount - 1) {
          const x = toX(i);
          const label = `${d.month}月`;
          ctx.fillText(label, x, H - 26);
        }
      });
    });
    return () => cancelAnimationFrame(rAF);
  }, [trendData, goal.targetAmount, primaryColor, sym]);

  const getInsightText = () => {
    if (isNearGoal && isOnTrack) {
      if (estimateInfo.months > 0) {
        return `当前已达 ${displayProgress}%，按当前增速预计 ${estimateInfo.months} 个月（${estimateInfo.date}）可达成目标！`;
      }
      return `当前已达 ${displayProgress}%，即将达成目标！`;
    }
    if (isFastGrowth) {
      return `本月净增 ${sym}${hideBalance ? '***' : fmtShort(monthlyGrowthRate)}，高于月均 ${sym}${hideBalance ? '***' : fmtShort(avgGrowth)}，继续保持！`;
    }
    if (isOverdue) {
      return `距离目标还差 ${sym}${hideBalance ? '***' : fmtWan(remaining)}，建议审视支出结构，适当加速储蓄。`;
    }
    return '保持稳定增长，持续记录以获得更准确的预测。';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-4 pb-20 px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[92vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* ── 固定顶部 - 缩小padding ── */}
        <div className="shrink-0 px-4 pt-3 pb-2"
          style={{ backgroundColor: `${primaryColor}0c`, borderBottom: `1px solid ${primaryColor}12` }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: `${primaryColor}15` }}>
                <Target size={16} style={{ color: primaryColor }} />
              </div>
              <span className="text-base font-bold text-gray-800" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                {goal.year}年度目标
              </span>
            </div>
            <button onClick={onClose}
              className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors flex-shrink-0 active:scale-95"
              aria-label="关闭">
              <X size={18} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* ── 可滚动内容 - 压缩间距 ── */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-4 space-y-4">

          {/* 状态 + 百分比 */}
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-2"
              style={{ background: `${chip.color}15`, color: chip.color }}>
              {chip.text}
            </span>
            
            <div className="text-[42px] font-bold leading-[1] tracking-[-2px] mb-1" 
              style={{ color: primaryColor, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
              {hideBalance ? '**' : displayProgress}
              <span className="text-[20px] text-gray-400 align-top">%</span>
            </div>
            
            <div className="text-xs text-gray-500">目标完成度</div>
          </div>

          {/* 核心数据卡片 - 统一中性底色，仅文字颜色区分 */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl p-2.5 text-center border border-gray-100 bg-white">
              <div className="text-[10px] text-gray-500 mb-1 font-medium">当前资产</div>
              <div className="text-sm font-bold text-gray-800 leading-tight">{sym}{hideBalance ? '****' : fmtWan(currentNetWorth)}</div>
            </div>
            <div className="rounded-xl p-2.5 text-center border border-gray-100 bg-white">
              <div className="text-[10px] mb-1 font-medium" style={{ color: COLORS.target }}>目标</div>
              <div className="text-sm font-bold leading-tight" style={{ color: COLORS.target }}>{sym}{hideBalance ? '****' : fmtWan(goal.targetAmount)}</div>
            </div>
            <div className="rounded-xl p-2.5 text-center border border-gray-100 bg-white">
              <div className={`text-[10px] mb-1 font-medium ${remaining > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                还需
              </div>
              <div className={`text-sm font-bold leading-tight ${remaining > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                {sym}{hideBalance ? '****' : fmtWan(remaining)}
              </div>
            </div>
          </div>

          {/* 增长指标 - 缩小尺寸，去除底色 */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg p-2.5 text-center border border-gray-100 bg-gray-50/50">
              <div className="flex items-center justify-center gap-1 text-[10px] mb-1 text-gray-500">
                <TrendingUpIcon size={10} />
                本月净增
              </div>
              <div className="text-sm font-bold text-gray-800">
                {hideBalance ? '****' : `${monthlyGrowthRate >= 0 ? '+' : ''}${fmtShort(monthlyGrowthRate || 0)}`}
              </div>
            </div>
            <div className="rounded-lg p-2.5 text-center border border-gray-100 bg-gray-50/50">
              <div className="flex items-center justify-center gap-1 text-[10px] mb-1 text-gray-500">
                <TrendingUpIcon size={10} />
                月均增长
              </div>
              <div className="text-sm font-bold text-gray-800">
                {hideBalance ? '****' : `${monthlyGrowthRate >= 0 ? '+' : ''}${fmtShort(monthlyGrowthRate || 0)}`}
              </div>
            </div>
          </div>

          {/* 预计达成时间 */}
          <div className="flex items-center justify-center gap-2 py-2 rounded-xl border border-gray-100 bg-gray-50/50">
            <Calendar size={14} className="text-gray-400" />
            <span className="text-xs text-gray-600">
              预计达成时间：<span className="font-medium text-gray-800">{estimateInfo.fullDate}</span>
            </span>
          </div>

          {/* ── 走势图区域 - 确保首屏可见 ── */}
          <div className="rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">
            <div className="px-3 py-2 flex items-center justify-between border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: `${primaryColor}15` }}>
                  <TrendingUp size={12} style={{ color: primaryColor }} />
                </div>
                <span className="text-xs font-bold text-gray-600">近 6 个月净资产走势</span>
              </div>
              {(isNearGoal || isFastGrowth) && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isNearGoal ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                }`}>
                  {isNearGoal ? '🔥 接近目标' : '📈 增速良好'}
                </span>
              )}
            </div>

            <div className="p-3">
              {trendData.length > 0 ? (
                <canvas ref={canvasRef} className="w-full block" style={{ height: '160px' }} />
              ) : (
                <div className="py-12 text-center text-gray-400 text-sm">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-2">
                    <TrendingUp size={16} className="text-gray-300" />
                  </div>
                  数据不足，无法绘制趋势图
                </div>
              )}
            </div>
          </div>

          {/* ── 动态洞察卡片 ── */}
          <div className={`rounded-xl p-3 border ${
            isNearGoal || isFastGrowth 
              ? 'bg-blue-50 border-blue-200' 
              : isOverdue 
                ? 'bg-amber-50 border-amber-200' 
                : 'bg-gray-50 border-gray-200'
          }`}>
            <div className={`text-sm font-bold flex items-center gap-2 mb-1.5 ${
              isNearGoal || isFastGrowth ? 'text-blue-700' : isOverdue ? 'text-amber-700' : 'text-gray-700'
            }`}>
              {isOverdue ? '💡' : '📊'}
              <span>{isOverdue ? '建议' : '动态洞察'}</span>
            </div>
            <div className={`text-sm leading-relaxed ${
              isNearGoal || isFastGrowth ? 'text-blue-700' : isOverdue ? 'text-amber-800' : 'text-gray-600'
            }`}>
              {getInsightText()}
            </div>
          </div>

          {/* ── 行动建议 - 精简 ── */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
            <div className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
              💡 提前达成后怎么办？
            </div>
            <div className="space-y-2 text-sm text-gray-600">
              {[
                `上调年度目标至 ${sym}${hideBalance ? '****' : fmtWan(goal.targetAmount * 1.15)}，保持挑战动力`,
                '超额部分转入投资账户，提升长期收益',
                '新建「应急储备提升」子目标',
              ].map((t, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">{i + 1}</div>
                  <span className="leading-relaxed">{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── 固定底部按钮 ── */}
        <div className="shrink-0 pt-3 pb-5 px-4" style={{ borderTop: `1px solid ${primaryColor}12` }}>
          <button
            onClick={onEdit}
            className="w-full py-3 rounded-xl text-sm font-bold text-white transition-colors active:scale-[0.98]"
            style={{ backgroundColor: primaryColor, boxShadow: `0 4px 14px ${primaryColor}30` }}
          >
            编辑年度目标
          </button>
        </div>
      </div>
    </div>
  );
}
