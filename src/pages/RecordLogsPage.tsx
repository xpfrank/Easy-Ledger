import { useState, useEffect } from 'react';
import { ArrowLeft, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/Icon';
import type { PageRoute, RecordLog, RecordMode } from '@/types';
import { 
  getRecordLogs, 
  formatAmountNoSymbol, 
  formatDate, 
  getAllAccounts, 
} from '@/lib/storage';
import { calculateNetWorth } from '@/lib/calculator';

interface RecordLogsPageProps {
  onPageChange: (page: PageRoute, params?: any) => void;
  year: number;
  month?: number;
  mode: RecordMode;
}

interface GroupedLogs {
  key: string;
  label: string;
  logs: RecordLog[];
  totalNetWorth?: number;
  lastOperationDate?: number;
  year?: number;
  month?: number;
}

export function RecordLogsPage({ onPageChange, year, month, mode }: RecordLogsPageProps) {
  const [groupedLogs, setGroupedLogs] = useState<GroupedLogs[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const accounts = getAllAccounts();

  useEffect(() => {
    loadLogs();
  }, [year, month, selectedAccount, mode]);

  const loadLogs = () => {
    let allLogs: RecordLog[] = [];
    
    if (mode === 'monthly' && month !== undefined) {
      allLogs = getRecordLogs(year, month);
    } else {
      allLogs = getRecordLogs(year);
    }

    if (selectedAccount !== 'all') {
      allLogs = allLogs.filter(l => l.accountId === selectedAccount);
    }

    if (mode === 'yearly') {
      // 年度模式：按月份分组，显示净资产和最后操作日期
      const monthMap = new Map<string, { logs: RecordLog[]; lastDate: number }>();
      
      // 收集所有有记录的月份
      for (let m = 1; m <= 12; m++) {
        const monthLogs = allLogs.filter(l => l.month === m);
        if (monthLogs.length > 0) {
          const key = `${year}-${m.toString().padStart(2, '0')}`;
          const sortedLogs = monthLogs.sort((a, b) => b.timestamp - a.timestamp);
          monthMap.set(key, {
            logs: sortedLogs,
            lastDate: sortedLogs[0]?.timestamp || Date.now(),
          });
        }
      }

      const grouped: GroupedLogs[] = Array.from(monthMap.entries()).map(([key, data]) => {
        const [, m] = key.split('-').map(Number);
        const netWorth = calculateNetWorth(year, m);
        
        return {
          key,
          label: `${year}年${m.toString().padStart(2, '0')}月`,
          logs: data.logs,
          totalNetWorth: netWorth,
          lastOperationDate: data.lastDate,
          year: year,
          month: m,
        };
      }).sort((a, b) => b.key.localeCompare(a.key));

      setGroupedLogs(grouped);
      if (grouped.length > 0) {
        setExpandedGroups(new Set([grouped[0].key]));
      }
    } else {
      // 月度模式：按日期分组
      const dateMap = new Map<string, RecordLog[]>();
      
      allLogs.forEach(log => {
        const date = new Date(log.timestamp);
        const dateKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
        if (!dateMap.has(dateKey)) {
          dateMap.set(dateKey, []);
        }
        dateMap.get(dateKey)!.push(log);
      });

      const grouped: GroupedLogs[] = Array.from(dateMap.entries()).map(([key, logItems]) => {
        const [, m, d] = key.split('-').map(Number);
        return {
          key,
          label: `${m}月${d}日`,
          logs: logItems.sort((a, b) => b.timestamp - a.timestamp),
        };
      }).sort((a, b) => b.key.localeCompare(a.key));

      setGroupedLogs(grouped);
      setExpandedGroups(new Set(grouped.map(g => g.key)));
    }
  };

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  // 获取操作类型标签
  const getOperationTypeLabel = (type?: string) => {
    switch (type) {
      case 'account_create': return '新增账户';
      case 'account_edit': return '编辑账户';
      case 'balance_change':
      default: return '余额修改';
    }
  };

  return (
    <div className="pb-6 bg-gray-50 min-h-screen">
      <header className="bg-white px-4 py-3 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => onPageChange('record')}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-lg font-semibold">
            {mode === 'monthly' && month !== undefined ? `${year}年${month}月` : `${year}年`}记账记录
          </h1>
        </div>
      </header>

      <div className="p-4 space-y-4">
        {/* 账户筛选 */}
        <Card className="bg-white">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-gray-400" />
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none"
              >
                <option value="all">全部账户</option>
                {accounts.map(account => (
                  <option key={account.id} value={account.id}>{account.name}</option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {groupedLogs.length === 0 ? (
          <Card className="bg-white">
            <CardContent className="p-8 text-center">
              <p className="text-gray-500">暂无记账记录</p>
              <p className="text-sm text-gray-400 mt-1">修改账户余额后会自动生成记录</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {groupedLogs.map((group) => (
              <Card key={group.key} className="bg-white overflow-hidden">
                {/* 分组标题 - 年度模式显示净资产和最后操作日期 */}
                <div 
                  className="flex items-center justify-between p-3 bg-gray-50 cursor-pointer"
                  onClick={() => toggleGroup(group.key)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{group.label}</span>
                      {mode === 'yearly' && group.totalNetWorth !== undefined && (
                        <span className={`text-sm font-semibold ${group.totalNetWorth >= 0 ? 'text-gray-800' : 'text-red-500'}`}>
                          ¥{formatAmountNoSymbol(group.totalNetWorth)}
                        </span>
                      )}
                    </div>
                    {mode === 'yearly' && group.lastOperationDate && (
                      <div className="text-xs text-gray-400">
                        最后记录：{formatDate(group.lastOperationDate)}
                      </div>
                    )}
                    {mode === 'monthly' && (
                      <span className="text-xs text-gray-400">({group.logs.length}条记录)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {expandedGroups.has(group.key) ? (
                      <ChevronUp size={20} className="text-gray-400" />
                    ) : (
                      <ChevronDown size={20} className="text-gray-400" />
                    )}
                  </div>
                </div>

                {/* 日志列表 */}
                {expandedGroups.has(group.key) && (
                  <div className="divide-y divide-gray-100">
                    {group.logs.map((log) => {
                      const change = log.newBalance - log.oldBalance;
                      const isIncrease = change > 0;
                      // 金额变化显示：¥旧余额 → ¥新余额
                      const changeDisplay = `¥${formatAmountNoSymbol(log.oldBalance)} → ¥${formatAmountNoSymbol(log.newBalance)}`;

                      return (
                        <div key={log.id} className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                isIncrease ? 'bg-green-50' : 'bg-red-50'
                              }`}>
                                <Icon 
                                  name={isIncrease ? 'trending-up' : 'trending-down'} 
                                  size={16} 
                                  className={isIncrease ? 'text-green-500' : 'text-red-500'} 
                                />
                              </div>
                              <div>
                                <div className="font-medium text-sm">{log.accountName}</div>
                                <div className="text-xs text-gray-400">
                                  {getOperationTypeLabel(log.operationType)}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`text-sm font-medium ${isIncrease ? 'text-green-600' : 'text-red-500'}`}>
                                {changeDisplay}
                              </div>
                              <div className="text-xs text-gray-400">
                                {formatDate(log.timestamp)}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
