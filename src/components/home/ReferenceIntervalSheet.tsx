import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { ReferenceIntervals, IntervalSource, LifeStage } from '@/types';
import {
  CATEGORY_KEYS,
  CATEGORY_META,
  INTERVAL_TEMPLATES,
  LIFE_STAGE_INTERVALS,
  SYSTEM_DEFAULT_INTERVALS,
  normalizeIntervals,
  type AssetCategoryKey,
} from '@/lib/allocation-config';
import {
  getReferenceIntervals,
  saveReferenceIntervals,
  getIntervalSource,
  getLifeStage,
} from '@/lib/storage';

interface ReferenceIntervalSheetProps {
  primaryColor: string;
  onClose: () => void;
  onSaved?: () => void;
  /** 仅编辑单类时传入 */
  focusCategory?: AssetCategoryKey;
}

export function ReferenceIntervalSheet({
  primaryColor,
  onClose,
  onSaved,
  focusCategory,
}: ReferenceIntervalSheetProps) {
  const [draft, setDraft] = useState<ReferenceIntervals>(getReferenceIntervals());
  const [previewTemplate, setPreviewTemplate] = useState<string | null>(null);
  const lifeStage = getLifeStage() as LifeStage;
  const source = getIntervalSource();

  useEffect(() => {
    setDraft(getReferenceIntervals());
  }, []);

  const displayIntervals = previewTemplate
    ? INTERVAL_TEMPLATES[previewTemplate].intervals
    : draft;

  const keysToShow = focusCategory ? [focusCategory] : CATEGORY_KEYS;

  const updateBound = (key: AssetCategoryKey, field: 'min' | 'max', value: number) => {
    setPreviewTemplate(null);
    setDraft((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: Math.max(0, Math.min(100, value)) },
    }));
  };

  const handleApplyTemplate = () => {
    if (!previewTemplate) return;
    setDraft({ ...INTERVAL_TEMPLATES[previewTemplate].intervals });
    setPreviewTemplate(null);
  };

  const handleRestoreLifeStage = () => {
    setPreviewTemplate(null);
    setDraft({ ...LIFE_STAGE_INTERVALS[lifeStage].intervals });
  };

  const handleRestoreSystem = () => {
    setPreviewTemplate(null);
    setDraft({ ...SYSTEM_DEFAULT_INTERVALS });
  };

  const handleSave = () => {
    const normalized = normalizeIntervals(draft);
    saveReferenceIntervals(normalized, 'custom');
    onSaved?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />

      <div
        className="relative bg-white rounded-t-[26px] shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-9 h-1 bg-gray-200 rounded-full mx-auto mt-3" />

        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
          <span className="text-[15.5px] font-bold text-gray-800">
            {focusCategory ? `调整${CATEGORY_META[focusCategory].shortLabel}参考区间` : '参考区间设置'}
          </span>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"
          >
            <X size={14} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-[12px] text-gray-500 leading-relaxed mb-3">
            参考区间是你的个人舒适范围，仅用于辅助对比现状，不强制要求必须达到。
          </p>

          {!focusCategory && (
            <div className="mb-4">
              <div className="text-[11px] font-bold text-gray-500 mb-2">快速模板（点击预览，需点「应用模板」生效）</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(INTERVAL_TEMPLATES).map(([id, t]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPreviewTemplate(previewTemplate === id ? null : id)}
                    className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${
                      previewTemplate === id
                        ? 'border-current text-white'
                        : 'border-gray-200 text-gray-600 bg-gray-50'
                    }`}
                    style={
                      previewTemplate === id
                        ? { backgroundColor: primaryColor, borderColor: primaryColor }
                        : undefined
                    }
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {previewTemplate && (
                <button
                  type="button"
                  onClick={handleApplyTemplate}
                  className="mt-2 text-[11px] font-bold"
                  style={{ color: primaryColor }}
                >
                  应用「{INTERVAL_TEMPLATES[previewTemplate].label}」模板
                </button>
              )}
            </div>
          )}

          <div className="space-y-4">
            {keysToShow.map((key) => {
              const meta = CATEGORY_META[key];
              const interval = displayIntervals[key];
              return (
                <div key={key} className="rounded-xl border border-gray-100 p-3 bg-gray-50/50">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.color }} />
                    <span className="text-[13px] font-bold text-gray-800">{meta.label}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-1">下限 %</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={interval.min}
                        disabled={!!previewTemplate}
                        onChange={(e) => updateBound(key, 'min', Number(e.target.value))}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-[13px] font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-1">上限 %</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={interval.max}
                        disabled={!!previewTemplate}
                        onChange={(e) => updateBound(key, 'max', Number(e.target.value))}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-[13px] font-semibold"
                      />
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={interval.min}
                    disabled={!!previewTemplate}
                    onChange={(e) => updateBound(key, 'min', Number(e.target.value))}
                    className="w-full mt-2 accent-current"
                    style={{ accentColor: meta.color }}
                  />
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={interval.max}
                    disabled={!!previewTemplate}
                    onChange={(e) => updateBound(key, 'max', Number(e.target.value))}
                    className="w-full mt-1 accent-current"
                    style={{ accentColor: meta.color }}
                  />
                  <div className="text-[10px] text-gray-400 mt-1 text-center">
                    你的区间 {interval.min}% – {interval.max}%
                  </div>
                </div>
              );
            })}
          </div>

          {!focusCategory && (
            <div className="flex flex-col gap-2 mt-4">
              <button
                type="button"
                onClick={handleRestoreLifeStage}
                className="text-[12px] py-2 rounded-lg border border-gray-200 text-gray-600 font-medium"
              >
                恢复当前人生阶段默认（{LIFE_STAGE_INTERVALS[lifeStage].emoji}{' '}
                {LIFE_STAGE_INTERVALS[lifeStage].label}）
              </button>
              <button
                type="button"
                onClick={handleRestoreSystem}
                className="text-[12px] py-2 rounded-lg border border-gray-200 text-gray-600 font-medium"
              >
                恢复系统默认（平衡型）
              </button>
              {source === 'custom' && (
                <p className="text-[10px] text-gray-400 text-center">当前为自定义模式</p>
              )}
            </div>
          )}
        </div>

        <div
          className="shrink-0 border-t border-gray-100 px-5 pt-3 bg-white"
          style={{ paddingBottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
        >
          <button
            onClick={handleSave}
            className="w-full py-3 rounded-xl text-white font-bold text-[14.5px]"
            style={{
              background: `linear-gradient(135deg, ${primaryColor}, #0b6eb5)`,
            }}
          >
            保存参考区间
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
