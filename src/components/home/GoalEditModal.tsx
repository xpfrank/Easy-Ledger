import { useState } from 'react';
import { X, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface GoalEditModalProps {
  currentYear: number;
  primaryColor: string;
  onClose: () => void;
  onSave: (targetAmount: number) => void;
}

export function GoalEditModal({
  currentYear,
  primaryColor,
  onClose,
  onSave,
}: GoalEditModalProps) {
  const [amount, setAmount] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Target size={18} style={{ color: primaryColor }} />
            <span className="font-bold">{currentYear} 年度目标</span>
          </div>
          <button onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <input
          type="number"
          placeholder="请输入目标金额"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full border rounded-xl px-4 py-3 mb-4"
        />

        <Button
          className="w-full"
          onClick={() => onSave(Number(amount))}
          disabled={!amount}
        >
          保存目标
        </Button>
      </div>
    </div>
  );
}