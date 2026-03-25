import { useState, useEffect } from 'react';
import { ArrowLeft, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { PageRoute, RecordLog, RecordMode } from '@/types';
import { getRecordLogs, formatDateTime, formatAmountNoSymbol } from '@/lib/storage';

interface RecordLogsPageProps {
  onPageChange: (page: PageRoute, params?: any) => void;
  year?: number;
  month?: number;
  mode?: RecordMode;
}

export function RecordLogsPage({ onPageChange, year: propYear, month: propMonth, mode: propMode }: RecordLogsPageProps) {
  const [logs, setLogs] = useState<RecordLog[]>([]);
  const [selectedYear, setSelectedYear] = useState(propYear ?? new Date().getFullYear());

  useEffect(() => {
    const yearLogs = getRecordLogs(selectedYear);
    setLogs(yearLogs);
  }, [selectedYear]);

  const years = [];
  for (let y = new Date().getFullYear(); y >= 2020; y--) {
    years.push(y);
  }

  const getOperationLabel = (type: string) => {
    switch (type) {
      case 'balance_change':
        return '余额变更';
      case 'account_create':
        return '创建账户';
      case 'account_edit':
        return '编辑账户';
      case 'account_delete':
        return '删除账户';
      default:
        return type;
    }
  };

  const getChangeDisplay = (log: RecordLog) => {
    if (log.operationType === 'account_create') {
      return `初始余额: ${formatAmountNoSymbol(log.newBalance)}`;
    }
    if (log.operationType === 'account_edit') {
      return '账户信息已修改';
    }
    const change = log.newBalance - log.oldBalance;
    const sign = change >= 0 ? '+' : '';
    return `${sign}${formatAmountNoSymbol(change)}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* 标题栏 */}
      <div className="sticky top-0 z-10 bg-white border-b shadow-sm">
        <div className="flex items-center gap-3 p-4">
          <button onClick={() => onPageChange('record')}>
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">记账记录</h1>
        </div>

        {/* 年份选择 */}
        <div className="px-4 pb-3 flex gap-2 overflow-x-auto">
          {years.map((year) => (
            <Button
              key={year}
              variant={selectedYear === year ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedYear(year)}
            >
              {year}年
            </Button>
          ))}
        </div>
      </div>

      {/* 记录列表 */}
      {logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <Calendar className="w-16 h-16 mb-4" />
          <p>{selectedYear}年还没有记录</p>
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {logs.map((log) => (
            <Card key={log.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{log.accountName}</p>
                    <p className="text-sm text-gray-500">
                      {formatDateTime(log.timestamp)}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {getOperationLabel(log.operationType)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-medium ${
                      log.operationType === 'balance_change'
                        ? (log.newBalance - log.oldBalance >= 0 ? 'text-green-600' : 'text-red-500')
                        : ''
                    }`}>
                      {getChangeDisplay(log)}
                    </p>
                    {log.operationType === 'balance_change' && (
                      <p className="text-xs text-gray-400">
                        {formatAmountNoSymbol(log.oldBalance)} → {formatAmountNoSymbol(log.newBalance)}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
