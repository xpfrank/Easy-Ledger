import { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import type { LifeStage } from '@/types';
import { getLifeStage, applyLifeStageIntervals } from '@/lib/storage';
import { LIFE_STAGE_INTERVALS, CATEGORY_KEYS, CATEGORY_META } from '@/lib/allocation-config';

interface LifeStageSheetProps {
  primaryColor: string;
  onClose: () => void;
  onConfirm?: () => void;
}

const LIFE_STAGES = (Object.entries(LIFE_STAGE_INTERVALS) as [LifeStage, (typeof LIFE_STAGE_INTERVALS)[LifeStage]][]).map(
  ([value, cfg]) => ({
    value,
    label: cfg.label,
    emoji: cfg.emoji,
    desc: cfg.desc,
    bg: value === 'student' ? '#fff8e6' : value === 'growth' ? '#e8faf2' : value === 'family' ? '#fce4ec' : '#e8eaf6',
    allocations: CATEGORY_KEYS.map((key) => ({
      label: CATEGORY_META[key].shortLabel,
      pct: `${cfg.intervals[key].min}–${cfg.intervals[key].max}%`,
      color: CATEGORY_META[key].color,
    })),
  })
);

export function LifeStageSheet({ primaryColor, onClose, onConfirm }: LifeStageSheetProps) {
  const [selectedStage, setSelectedStage] = useState<LifeStage>('growth');

  useEffect(() => {
    setSelectedStage(getLifeStage() as LifeStage);
  }, []);

  const handleSelect = (value: LifeStage) => {
    setSelectedStage(value);
  };

  const handleConfirm = () => {
    applyLifeStageIntervals(selectedStage);
    onConfirm?.();
    onClose();
  };

  const currentStage = LIFE_STAGES.find((s) => s.value === selectedStage);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />

      <div
        className="relative bg-white rounded-t-[26px] shadow-2xl w-full max-w-sm max-h-[85vh] flex flex-col overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-9 h-1 bg-gray-200 rounded-full mx-auto mt-3" />

        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
          <span className="text-[15.5px] font-bold text-gray-800">选择人生阶段</span>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <X size={14} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div
            className="rounded-[14px] p-4 mb-4"
            style={{ background: `linear-gradient(135deg, ${primaryColor}, #0d3b6e)` }}
          >
            <div className="text-[11px] text-white/55 font-semibold mb-1">当前选择</div>
            <div className="text-[17px] font-bold text-white mb-1">
              {currentStage?.emoji} {currentStage?.label}
            </div>
            <div className="text-[11.5px] text-white/55">
              确认后将用你的参考区间替换为该阶段预设（可之后再手动调整）
            </div>
          </div>

          <div className="space-y-2.5">
            {LIFE_STAGES.map((stage) => {
              const isSelected = selectedStage === stage.value;
              return (
                <button
                  key={stage.value}
                  onClick={() => handleSelect(stage.value)}
                  className={`w-full text-left rounded-[14px] border overflow-hidden transition-all ${
                    isSelected ? 'border-[#1d9de2] shadow-sm' : 'border-gray-200 hover:border-gray-300'
                  }`}
                  style={{ backgroundColor: '#f8fbfe' }}
                >
                  <div className="flex items-center gap-3 p-3.5">
                    <div
                      className="w-10 h-10 rounded-[11px] flex items-center justify-center text-[22px]"
                      style={{ backgroundColor: stage.bg }}
                    >
                      {stage.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-bold text-gray-800">{stage.label}</div>
                      <div className="text-[11.5px] text-gray-500">{stage.desc}</div>
                    </div>
                    <div
                      className={`w-[22px] h-[22px] rounded-full flex items-center justify-center shrink-0 transition-all ${
                        isSelected
                          ? 'border-2 border-transparent text-white'
                          : 'border-2 border-gray-300 bg-white'
                      }`}
                      style={isSelected ? { backgroundColor: primaryColor } : undefined}
                    >
                      {isSelected && <Check size={13} strokeWidth={3} />}
                    </div>
                  </div>

                  <div className="flex border-t border-gray-200 bg-[#f8fbfe]">
                    {stage.allocations.map((alloc, i) => (
                      <div
                        key={i}
                        className={`flex-1 text-center py-2 ${i > 0 ? 'border-l border-gray-200' : ''}`}
                      >
                        <div
                          className="w-1.5 h-1.5 rounded-full mx-auto mb-1"
                          style={{ backgroundColor: alloc.color }}
                        />
                        <div className="text-[11.5px] font-bold text-gray-800">{alloc.pct}</div>
                        <div className="text-[9.5px] text-gray-500">{alloc.label}</div>
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          <div
            className="rounded-[10px] p-3 mt-4 text-[12px] leading-relaxed"
            style={{ backgroundColor: '#e8f5ff', color: '#0b6eb5', border: '1px solid #93d5ff' }}
          >
            💡 阶段预设仅初始化你的参考区间；健康分按你设定的区间计算，不代表「标准答案」。
          </div>
        </div>

        <div
          className="shrink-0 border-t border-gray-100 px-5 pt-3 bg-white"
          style={{ paddingBottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
        >
          <div className="text-[11.5px] text-gray-400 text-center mb-2.5">
            已选择：<strong className="text-gray-700">{currentStage?.label}</strong>
          </div>
          <button
            onClick={handleConfirm}
            className="w-full py-3 rounded-xl text-white font-bold text-[14.5px] transition-transform active:scale-[0.98]"
            style={{
              background: `linear-gradient(135deg, ${primaryColor}, #0b6eb5)`,
              boxShadow: `0 4px 14px ${primaryColor}40`,
            }}
          >
            确认并应用参考区间
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up { animation: slide-up 0.3s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
      `}</style>
    </div>
  );
}
