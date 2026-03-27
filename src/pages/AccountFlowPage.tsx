import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Filter, TrendingUp, TrendingDown, ArrowRightLeft, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/Icon';
import type { PageRoute, RecordLog, ThemeType } from '@/types';
import {
  getRecordLogsByAccount,
  formatAmountNoSymbol,
  formatDate,
  getSettings,
  getAccountById,
} from '@/lib/storage';
import { THEMES } from '@/types';

interface AccountFlowPageProps {
  onPageChange: (page: PageRoute, params?: any) => void;
  accountId: string;
}

// 隐藏金额显示
function formatHiddenAmount(amount: number, hide: boolean): string {
  if (hide) {
    return '******';
  }
  return formatAmountNoSymbol(amount);
}

// 流水筛选类型
type FlowFilter = 'all' | 'increase' | 'decrease' | 'transfer_in' | 'transfer_out';

// 获取筛选标签
function getFilterLabel(filter: FlowFilter): string {
  switch (filter) {
    case 'increase':
      return '余额增加';
    case 'decrease':
      return '余额减少';
    case 'transfer_in':
      return '转入';
    case 'transfer_out':
      return '转出';
    default:
      return '全部';
  }
}

// 判断流水类型
function getFlowType(log: RecordLog): 'increase' | 'decrease' | 'neutral' {
  const change = log.newBalance - log.oldBalance;
  if (change > 0) return 'increase';
  if (change < 0) return 'decrease';
  return 'neutral';
}

export function AccountFlowPage({ onPageChange, accountId }: AccountFlowPageProps) {
  const [logs, setLogs] = useState<RecordLog[]>([]);
  const [filter, setFilter] = useState<FlowFilter>('all');
  const [hideBalance, setHideBalance] = useState(false);
  const [theme, setTheme] = useState<ThemeType>('blue');
  const [accountName, setAccountName] = useState('');
  const themeConfig = THEMES[theme];

  useEffect(() => {
    const settings = getSettings();
    setHideBalance(settings.hideBalance || false);
    setTheme(settings.theme || 'blue');
    loadFlowData();
  }, [accountId]);

  const loadFlowData = () => {
    const account = getAccountById(accountId);
    if (account) {
      setAccountName(account.name);
    }
    const allLogs = getRecordLogsByAccount(accountId);
    setLogs(allLogs);
  };

  // 筛选流水
  const filteredLogs = useMemo(() => {
    if (filter === 'all') return logs;

    return logs.filter((log) => {
      const change = log.newBalance - log.oldBalance;
      switch (filter) {
        case 'increase':
          return change > 0;
        case 'decrease':
          return change < 0;
        case 'transfer_in':
          // 转入：从其他账户转入（这里简化为余额增加且操作类型不是创建）
          return change > 0 && log.operationType !== 'account_create';
        case 'transfer_out':
          // 转出：转出到其他账户（简化为余额减少）
          return change < 0;
        default:
          return true;
      }
    });
  }, [logs, filter]);

  // 按日期分组
  const groupedLogs = useMemo(() => {
    const groups: { date: string; logs: RecordLog[] }[] = [];
    const dateMap = new Map<string, RecordLog[]>();

    filteredLogs.forEach((log) => {
      const date = formatDate(log.timestamp);
      if (!dateMap.has(date)) {
        dateMap.set(date, []);
      }
      dateMap.get(date)!.push(log);
    });

    dateMap.forEach((logs, date) => {
      groups.push({ date, logs: logs.sort((a, b) => b.timestamp - a.timestamp) });
    });

    return groups.sort((a, b) => {
      // 按日期降序排列
      const dateA = new Date(a.logs[0].timestamp);
      const dateB = new Date(b.logs[0].timestamp);
      return dateB.getTime() - dateA.getTime();
    });
  }, [filteredLogs]);

  // 计算统计数据
  const stats = useMemo(() => {
    let totalIncrease = 0;
    let totalDecrease = 0;
    let increaseCount = 0;
    let decreaseCount = 0;

    logs.forEach((log) => {
      const change = log.newBalance - log.oldBalance;
      if (change > 0) {
        totalIncrease += change;
        increaseCount++;
      } else if (change < 0) {
        totalDecrease += Math.abs(change);
        decreaseCount++;
      }
    });

    return { totalIncrease, totalDecrease, increaseCount, decreaseCount };
  }, [logs]);

  return (
    <div className="pb-24 bg-gray-50 min-h-screen overflow-x-hidden">
      {/* 顶部栏 */}
      <header
        className="px-4 py-3 flex items-center fixed top-0 left-0 right-0 z-50 max-w-md mx-auto shadow-sm"
        style={{ backgroundColor: themeConfig.primary }}
      >
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => onPageChange('account-detail', { accountId })}>
          <ArrowLeft size={20} />
        </Button>
        <h1 className="text-lg font-semibold text-white ml-2">资产变化</h1>
      </header>

      {/* 占位元素 */}
      <div className="h-14"></div>

      {/* 统计卡片 */}
      <div className="px-4 pt-4">
        <Card
          className="text-white border-0 shadow-lg overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${themeConfig.gradientFrom} 0%, ${themeConfig.gradientTo} 100%)`,
          }}
        >
          <CardContent className="p-4">
            <div className="text-white/80 text-sm mb-3">{accountName} - 收支统计</div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-1 text-white/70 text-xs mb-1">
                  <TrendingUp size={12} />
                  累计增加
                </div>
                <div className="text-lg font-semibold">
                  +¥{formatHiddenAmount(stats.totalIncrease, hideBalance)}
                </div>
                <div className="text-xs text-white/60">{stats.increaseCount}笔</div>
              </div>
              <div>
                <div className="flex items-center gap-1 text-white/70 text-xs mb-1">
                  <TrendingDown size={12} />
                  累计减少
                </div>
                <div className="text-lg font-semibold">
                  -¥{formatHiddenAmount(stats.totalDecrease, hideBalance)}
                </div>
                <div className="text-xs text-white/60">{stats.decreaseCount}笔</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 筛选器 */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <Filter size={16} className="text-gray-400 flex-shrink-0" />
          {(['all', 'increase', 'decrease', 'transfer_in', 'transfer_out'] as FlowFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors ${
                filter === f
                  ? 'text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              style={{ backgroundColor: filter === f ? themeConfig.primary : undefined }}
            >
              {getFilterLabel(f)}
            </button>
          ))}
        </div>
      </div>

      {/* 流水列表 */}
      <div className="px-4 pb-6 space-y-3">
        {groupedLogs.length === 0 ? (
          <Card className="bg-white">
            <CardContent className="p-8 text-center">
              <p className="text-gray-500">暂无流水记录</p>
              <p className="text-sm text-gray-400 mt-1">修改账户余额后会自动生成记录</p>
            </CardContent>
          </Card>
        ) : (
          groupedLogs.map((group) => (
            <Card key={group.date} className="bg-white overflow-hidden">
              {/* 日期标题 */}
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-600">{group.date}</span>
              </div>

              {/* 流水项 */}
              <div className="divide-y divide-gray-100">
                {group.logs.map((log) => {
                  const change = log.newBalance - log.oldBalance;
                  const flowType = getFlowType(log);
                  const isIncrease = flowType === 'increase';
                  const isDecrease = flowType === 'decrease';

                  // 获取操作类型标签
                  const getOperationLabel = () => {
                    switch (log.operationType) {
                      case 'account_create':
                        return '新增账户';
                      case 'account_edit':
                        return '编辑账户';
                      default:
                        return isIncrease ? '余额增加' : isDecrease ? '余额减少' : '余额调整';
                    }
                  };

                  return (
                    <div key={log.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                              isIncrease
                                ? 'bg-green-50'
                                : isDecrease
                                ? 'bg-red-50'
                                : 'bg-gray-50'
                            }`}
                          >
                            {isIncrease ? (
                              <ArrowUpRight size={18} className="text-green-500" />
                            ) : isDecrease ? (
                              <ArrowDownRight size={18} className="text-red-500" />
                            ) : (
                              <ArrowRightLeft size={18} className="text-gray-400" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-sm">{getOperationLabel()}</div>
                            <div className="text-xs text-gray-400">
                              {new Date(log.timestamp).toLocaleTimeString('zh-CN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div
                            className={`text-sm font-medium ${
                              isIncrease ? 'text-green-600' : isDecrease ? 'text-red-500' : 'text-gray-600'
                            }`}
                          >
                            {isIncrease ? '+' : isDecrease ? '-' : ''}¥
                            {formatHiddenAmount(Math.abs(change), hideBalance)}
                          </div>
                          <div className="text-xs text-gray-400">
                            ¥{formatHiddenAmount(log.oldBalance, hideBalance)} → ¥
                            {formatHiddenAmount(log.newBalance, hideBalance)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
