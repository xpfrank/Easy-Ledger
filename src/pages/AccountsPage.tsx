import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Plus, Upload, GitBranch, Trash2, Edit3, Eye, EyeOff, Download, FileSpreadsheet, FileJson, ChevronDown, ChevronUp, ArrowUp, ArrowDown, GripVertical, CheckSquare, X, Square, MoreHorizontal, Layers, SortAsc, ListChecks, FolderPlus, ArrowUpToLine } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Icon } from '@/components/Icon';
import type { Account, PageRoute } from '@/types';
import { getCurrencyConfig } from '@/types';
import type { ExcelImportRow } from '@/lib/storage';
import {
  getCustomAccountTypes,
  deleteAccountFromMonth,
  deleteAccountGlobally,
  updateAccount,
  importData,
  getMonthlyRecordsByMonth,
  getSettings,
  parseExcelCSV,
  batchImportFromExcel,
  exportExcelTemplate,
  convertToBaseCurrency,
  formatAmountNoSymbol,
  getExpandedGroups,
  saveExpandedGroups,
  getAllAccounts,
  reorderAccountInGroup,
  dragReorderAccountInGroup,
  moveAccountToTopInGroup,
  batchDeleteAccountsFromMonth,
  getGroupOrderConfig,
  saveGroupOrderConfig,
  addCustomAccountType,
} from '@/lib/storage';
import { ACCOUNT_TYPES } from '@/lib/calculator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// Select removed - using grid-based chip selector instead
import { THEMES } from '@/types';
import type { ThemeType } from '@/types';

// 隐藏金额显示
function formatHiddenAmount(amount: number, hide: boolean, currencyCode: string = 'CNY'): string {
  if (hide) {
    return '******';
  }
  const config = getCurrencyConfig(currencyCode);
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: config.decimals,
    maximumFractionDigits: config.decimals,
  }).format(amount);
}

interface AccountsPageProps {
  onPageChange: (page: PageRoute, params?: any) => void;
  onBack?: () => void;
}

export function AccountsPage({ onPageChange, onBack }: AccountsPageProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currentBalances, setCurrentBalances] = useState<Record<string, number>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [hideBalance, setHideBalance] = useState(false);
  const [baseCurrency, setBaseCurrency] = useState<string>('CNY');
  const [importMode, setImportMode] = useState<'json' | 'excel'>('json');
  const [excelData, setExcelData] = useState<ExcelImportRow[]>([]);
  const [excelError, setExcelError] = useState<string>('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [theme, setTheme] = useState<ThemeType>('blue');
  const [isSortMode, setIsSortMode] = useState(false);
  // 账户拖拽相关状态
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragRef = useRef<{ startY: number; accountId: string; groupType: string; itemHeight: number; startIndex: number } | null>(null);
  const dragOverIndexRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 自动滚动配置
  const accountsListRef = useRef<HTMLDivElement>(null);
  const AUTO_SCROLL_MARGIN = 80;
  const AUTO_SCROLL_SPEED = 6;
  // 自动滚动：独立 RAF loop，与位置检测分离
  const autoScrollRafRef = useRef<number>(0);
  const dragClientYRef = useRef<number>(0); // 拖拽过程中手指/鼠标当前Y坐标（实时更新）
  // 分组拖拽状态
  const [draggingGroupType, setDraggingGroupType] = useState<string | null>(null);
  const [dragOverGroupIndex, setDragOverGroupIndex] = useState<number | null>(null);
  const groupDragRef = useRef<{ startY: number; groupType: string; groupHeight: number; startIndex: number } | null>(null);
  const groupDragOverIndexRef = useRef<number | null>(null);
  // 幽灵卡片 ref（直接 DOM 操作，避免 setState 触发重渲染）
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const ghostTextRef = useRef<HTMLSpanElement | null>(null);
  const rafRef = useRef<number>(0);
  // groupLongPressRef removed - not needed

  // 批量操作状态
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [batchActionDialog, setBatchActionDialog] = useState<"type" | "delete" | null>(null);
  const [newCustomType, setNewCustomType] = useState("");
  const [selectedCustomType, setSelectedCustomType] = useState("");
  
  // 分组排序状态
  const [isGroupSortMode, setIsGroupSortMode] = useState(false);
  const [groupOrder, setGroupOrder] = useState<Record<string, number>>({});
  const [createTypeDialogOpen, setCreateTypeDialogOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");

  // 顶栏更多菜单
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const themeConfig = THEMES[theme] || THEMES.blue;

  useEffect(() => {
    const settings = getSettings();
    const validThemes: ThemeType[] = ['blue', 'green', 'orange', 'dark', 'purple'];
    const themeValue = validThemes.includes(settings.theme as ThemeType) ? settings.theme : 'blue';
    setTheme(themeValue as ThemeType);
    setHideBalance(settings.hideBalance || false);
    setBaseCurrency(settings.baseCurrency || 'CNY');
    loadAccounts();
    // 初始化分组展开状态
    const saved = getExpandedGroups();
    setExpandedGroups(saved);
    // 加载分组排序配置
    setGroupOrder(getGroupOrderConfig());
    setExpandedGroups(saved);
  }, []);

  // ── 非 passive 触摸事件注册 ──────────────────────────────────────────────
  // React 合成事件在现代 WebView 里默认是 passive，preventDefault() 会被忽略。
  // 必须用原生 addEventListener({ passive: false }) 才能阻止拖拽时页面滚动。
  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      const grip = (e.target as HTMLElement).closest('[data-grip]');
      if (!grip) return;
      // 阻止默认行为（防止触发页面滚动）并标记拖拽正在进行
      // 具体的状态更新逻辑仍由 React onTouchStart 处理，这里只负责 passive 阻断
      e.preventDefault();
    };
    const onTouchMove = (e: TouchEvent) => {
      // 只要有任何拖拽在进行，就阻止页面滚动
      if (dragRef.current || groupDragRef.current) {
        e.preventDefault();
      }
    };
    document.addEventListener('touchstart', onTouchStart, { passive: false });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
    };
  }, []);

  const loadAccounts = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const allAccounts = getAllAccounts();
    setAccounts(allAccounts);
    
    const records = getMonthlyRecordsByMonth(currentYear, currentMonth);
    
    const balances: Record<string, number> = {};
    for (const account of allAccounts) {
      const record = records.find(r => r.accountId === account.id);
      balances[account.id] = record ? record.balance : account.balance;
    }
    setCurrentBalances(balances);
  };

  // 计算分组总金额（按主货币折算）
  const getGroupTotal = (groupType: string): number => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const groupAccounts = groupType.startsWith('custom_')
      ? accounts.filter(a => a.customTypeLabel === groupType.replace('custom_', ''))
      : accounts.filter(a => a.type === groupType && !a.customTypeLabel); // BUG FIX: exclude custom-typed accounts
    let total = 0;
    for (const account of groupAccounts) {
      const rawBal = currentBalances[account.id] ?? account.balance;
      total += convertToBaseCurrency(rawBal, account.currency || 'CNY', year, month);
    }
    return total;
  };

  const toggleGroup = (type: string) => {
    const newExpanded = { ...expandedGroups, [type]: !expandedGroups[type] };
    setExpandedGroups(newExpanded);
    saveExpandedGroups(newExpanded);
  };

  // 获取账户类型图标
  function getAccountTypeIcon(type: string): string {
    if (type.startsWith('custom_')) {
      const label = type.replace('custom_', '');
      const saved = getCustomAccountTypes().find(ct => ct.label === label);
      return saved?.icon || 'circle';
    }
    const iconMap: Record<string, string> = {
      'cash': 'banknote',
      'debit': 'credit-card',
      'credit': 'credit-card',
      'digital': 'wallet',
      'investment': 'trending-up',
      'loan': 'handshake',
      'debt': 'clipboard',
    };
    return iconMap[type] || 'circle';
  }

  const handleDelete = (account: Account) => {
    setAccountToDelete(account);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = (deleteType: 'currentMonth' | 'global') => {
    if (accountToDelete) {
      if (deleteType === 'currentMonth') {
        const now = new Date();
        deleteAccountFromMonth(accountToDelete.id, now.getFullYear(), now.getMonth() + 1);
      } else {
        deleteAccountGlobally(accountToDelete.id);
      }
      loadAccounts();
      setDeleteDialogOpen(false);
      setAccountToDelete(null);
    }
  };

  const toggleIncludeInTotal = (account: Account) => {
    updateAccount(account.id, { includeInTotal: !account.includeInTotal });
    loadAccounts();
  };

  const toggleHidden = (account: Account) => {
    updateAccount(account.id, { isHidden: !account.isHidden });
    loadAccounts();
  };

  const handleReorder = (accountId: string, direction: 'up' | 'down' | 'top') => {
    if (direction === 'top') {
      moveAccountToTopInGroup(accountId);
    } else {
      reorderAccountInGroup(accountId, direction);
    }
    loadAccounts();
  };

  // ── 拖拽自动滚动辅助 ──────────────────────────────────────────────────────
  // 启动独立的自动滚动 RAF loop（与位置检测 RAF 完全分离）
  // 依赖 dragClientYRef 实时获取手指/鼠标当前位置
  const startAutoScroll = () => {
    if (autoScrollRafRef.current) return; // 已在运行
    const loop = () => {
      // 账户或分组任一拖拽活跃时继续
      if (!dragRef.current && !groupDragRef.current) { autoScrollRafRef.current = 0; return; }
      const y = dragClientYRef.current;
      const vh = window.innerHeight;
      if (y < AUTO_SCROLL_MARGIN) {
        // 靠近顶部：向上滚动，越靠近边缘速度越快
        const intensity = 1 - y / AUTO_SCROLL_MARGIN;
        window.scrollBy(0, -(AUTO_SCROLL_SPEED + AUTO_SCROLL_SPEED * intensity * 2));
      } else if (y > vh - AUTO_SCROLL_MARGIN) {
        const intensity = 1 - (vh - y) / AUTO_SCROLL_MARGIN;
        window.scrollBy(0, AUTO_SCROLL_SPEED + AUTO_SCROLL_SPEED * intensity * 2);
      }
      autoScrollRafRef.current = requestAnimationFrame(loop);
    };
    autoScrollRafRef.current = requestAnimationFrame(loop);
  };

  const stopAutoScroll = () => {
    if (autoScrollRafRef.current) {
      cancelAnimationFrame(autoScrollRafRef.current);
      autoScrollRafRef.current = 0;
    }
  };

  // 根据手指/鼠标当前Y坐标（相对于视口）计算目标 index
  // 不依赖 elementFromPoint，完全基于列表容器位置和行高计算
  const calcDragOverIndex = (clientY: number, groupAccountCount: number): number => {
    const rows = document.querySelectorAll('[data-account-index]');
    if (rows.length === 0) return dragOverIndexRef.current ?? 0;
    // 找到最近的行（按中心点距离）
    let bestIdx = dragOverIndexRef.current ?? 0;
    let bestDist = Infinity;
    rows.forEach((row) => {
      const rect = row.getBoundingClientRect();
      const centerY = rect.top + rect.height / 2;
      const dist = Math.abs(clientY - centerY);
      if (dist < bestDist) {
        bestDist = dist;
        const idx = parseInt(row.getAttribute('data-account-index') || '-1', 10);
        if (idx >= 0) bestIdx = idx;
      }
    });
    // 即使行在视口外，也用边界推断
    const firstRow = rows[0].getBoundingClientRect();
    const lastRow = rows[rows.length - 1].getBoundingClientRect();
    if (clientY < firstRow.top) {
      bestIdx = 0;
    } else if (clientY > lastRow.bottom) {
      bestIdx = groupAccountCount - 1;
    }
    return Math.max(0, Math.min(groupAccountCount - 1, bestIdx));
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        if (importData(content)) {
          loadAccounts();
          setImportDialogOpen(false);
          alert('数据导入成功');
        } else {
          alert('数据导入失败，请检查文件格式');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleExcelFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const parsed = parseExcelCSV(content);
        if (parsed.length > 0) {
          setExcelData(parsed);
          setExcelError('');
        } else {
          setExcelData([]);
          setExcelError('无法解析 Excel 文件，请确保格式正确');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleExcelImport = () => {
    if (excelData.length === 0) {
      setExcelError('请先选择 Excel 文件');
      return;
    }
    const result = batchImportFromExcel(excelData);
    alert(result.message);
    if (result.success) {
      loadAccounts();
      setImportDialogOpen(false);
      setExcelData([]);
      setImportMode('json');
    }
  };

  const handleDownloadTemplate = () => {
    const template = exportExcelTemplate();
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '资产导入模板.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCloseImportDialog = (open: boolean) => {
    setImportDialogOpen(open);
    if (!open) {
      setExcelData([]);
      setExcelError('');
      setImportMode('json');
    }
  };

  // Standard type groups (exclude accounts with customTypeLabel)
  const standardGroups = ACCOUNT_TYPES.map(type => ({
    type: type.type,
    label: type.label,
    icon: type.icon,
    accounts: accounts.filter(a => a.type === type.type && !a.customTypeLabel),
  })).filter(g => g.accounts.length > 0);

  // Custom type groups — include ALL saved custom types, even empty ones
  const customTypeMap = new Map<string, typeof accounts>();
  for (const acc of accounts) {
    if (acc.customTypeLabel) {
      if (!customTypeMap.has(acc.customTypeLabel)) customTypeMap.set(acc.customTypeLabel, []);
      customTypeMap.get(acc.customTypeLabel)!.push(acc);
    }
  }
  const savedCustomTypes = getCustomAccountTypes();
  // Merge: types that have accounts + types that are saved but empty
  const allCustomLabels = new Set([
    ...Array.from(customTypeMap.keys()),
    ...savedCustomTypes.map(ct => ct.label),
  ]);
  const customGroups = Array.from(allCustomLabels).map((label) => {
    const saved = savedCustomTypes.find(ct => ct.label === label);
    return {
      type: `custom_${label}`,
      label,
      icon: saved?.icon || 'circle',
      accounts: customTypeMap.get(label) || [],
    };
  });




  // ========== 批量操作功能 ==========
  const toggleAccountSelection = (accountId: string) => {
    const newSelected = new Set(selectedAccounts);
    if (newSelected.has(accountId)) {
      newSelected.delete(accountId);
    } else {
      newSelected.add(accountId);
    }
    setSelectedAccounts(newSelected);
  };

  const selectAllInGroup = (groupAccounts: Account[]) => {
    const newSelected = new Set(selectedAccounts);
    const allSelected = groupAccounts.every(a => newSelected.has(a.id));
    
    if (allSelected) {
      groupAccounts.forEach(a => newSelected.delete(a.id));
    } else {
      groupAccounts.forEach(a => newSelected.add(a.id));
    }
    setSelectedAccounts(newSelected);
  };

  const handleBatchTypeChange = () => {
    if (selectedAccounts.size === 0) return;
    
    const accountIds = Array.from(selectedAccounts);
    let customTypeLabel: string | undefined = undefined;
    let builtinType: string | undefined = undefined;
    
    if (selectedCustomType === "_none_") {
      customTypeLabel = undefined;
    } else if (selectedCustomType === "_new_") {
      if (!newCustomType.trim()) {
        alert("请输入新分类名称");
        return;
      }
      customTypeLabel = newCustomType;
    } else if (selectedCustomType.startsWith("_builtin_")) {
      // 处理内置类型选择
      builtinType = selectedCustomType.replace("_builtin_", "");
      customTypeLabel = undefined;
    } else {
      customTypeLabel = selectedCustomType;
    }
    
    // 批量更新账户
    for (const accountId of accountIds) {
      const account = accounts.find(a => a.id === accountId);
      if (account) {
        if (builtinType) {
          // 切换到内置类型，清除自定义标签
          updateAccount(accountId, { type: builtinType as any, customTypeLabel: undefined });
        } else {
          // 设置自定义类型标签
          updateAccount(accountId, { customTypeLabel });
        }
      }
    }
    
    if (selectedCustomType === "_new_" && newCustomType.trim()) {
      addCustomAccountType({
        label: newCustomType,
        icon: "folder",
        behavior: "asset",
      });
    }
    
    loadAccounts();
    setBatchActionDialog(null);
    setSelectedAccounts(new Set());
    setIsBatchMode(false);
    setNewCustomType("");
    setSelectedCustomType("");
  };

  const handleBatchDelete = () => {
    if (selectedAccounts.size === 0) return;
    
    const now = new Date();
    const accountIds = Array.from(selectedAccounts);
    batchDeleteAccountsFromMonth(accountIds, now.getFullYear(), now.getMonth() + 1);
    
    loadAccounts();
    setBatchActionDialog(null);
    setSelectedAccounts(new Set());
    setIsBatchMode(false);
  };

  // ========== 分组排序功能 ==========
  const handleGroupReorderToIndex = (groupType: string, toIndex: number) => {
    const sortedGroups = getSortedGroups();
    const currentIndex = sortedGroups.findIndex(g => g.type === groupType);
    if (currentIndex === -1 || toIndex === currentIndex) return;
    
    // 重新排序分组
    const newGroups = [...sortedGroups];
    const [moved] = newGroups.splice(currentIndex, 1);
    newGroups.splice(toIndex, 0, moved);
    
    // 更新排序权重
    const newOrder: Record<string, number> = {};
    newGroups.forEach((g, i) => {
      newOrder[g.type] = i * 10;
    });
    
    setGroupOrder(newOrder);
    saveGroupOrderConfig(newOrder);
  };

  const handleGroupReorder = (groupType: string, direction: "up" | "down") => {
    const sortedGroups = getSortedGroups();
    const currentIndex = sortedGroups.findIndex(g => g.type === groupType);
    if (currentIndex === -1) return;
    const swapIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (swapIndex < 0 || swapIndex >= sortedGroups.length) return;
    const currentOrder = groupOrder[groupType] ?? currentIndex * 10;
    const swapOrder = groupOrder[sortedGroups[swapIndex].type] ?? swapIndex * 10;
    const newOrder = { ...groupOrder };
    newOrder[groupType] = swapOrder;
    newOrder[sortedGroups[swapIndex].type] = currentOrder;
    setGroupOrder(newOrder);
    saveGroupOrderConfig(newOrder);
  };

  const handleCreateCustomType = () => {
    if (!newTypeName.trim()) {
      alert("请输入分类名称");
      return;
    }
    
    addCustomAccountType({
      label: newTypeName,
      icon: "folder",
      behavior: "asset",
    });
    
    setCreateTypeDialogOpen(false);
    setNewTypeName("");
    loadAccounts();
  };

  // 按排序配置排序分组
  const getSortedGroups = () => {
    const allGroups = [...standardGroups, ...customGroups];
    return allGroups.sort((a, b) => {
      const orderA = groupOrder[a.type] ?? (ACCOUNT_TYPES.findIndex(t => t.type === a.type) * 10);
      const orderB = groupOrder[b.type] ?? (ACCOUNT_TYPES.findIndex(t => t.type === b.type) * 10);
      return orderA - orderB;
    });
  };
  const groupedAccounts = getSortedGroups(); // Fix: use sorted groups for rendering

  // 退出所有编辑模式
  const exitEditMode = () => {
    setIsBatchMode(false);
    setIsSortMode(false);
    setIsGroupSortMode(false);
    setSelectedAccounts(new Set());
  };

  const isAnyEditMode = isBatchMode || isSortMode || isGroupSortMode;

  return (
    <div className={`${isAnyEditMode ? 'pb-32' : 'pb-24'} bg-gray-50 min-h-screen overflow-x-hidden`}>
      {/* 标题栏 - 精简为2个操作按钮 */}
      <header className="px-4 py-3 flex justify-between items-center fixed top-0 left-0 right-0 z-50 max-w-md mx-auto shadow-sm rounded-b-2xl" style={{ backgroundColor: themeConfig.primary }}>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="text-white" onClick={() => onBack ? onBack() : onPageChange('home')}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-lg font-semibold text-white">账户管理</h1>
        </div>
        <div className="flex items-center gap-1">
          {/* 资产流向 - 高频入口常驻 */}
          <Button
            variant="ghost"
            size="sm"
            className="text-white rounded-full px-3 py-1 text-xs font-medium bg-white/15"
            onClick={() => onPageChange('balance-sankey')}
          >
            <GitBranch size={16} className="mr-1" />
            资产流向
          </Button>
          {/* ··· 更多菜单 */}
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="text-white"
              onClick={() => setShowMoreMenu(v => !v)}
            >
              <MoreHorizontal size={20} />
            </Button>
            {showMoreMenu && (
              <>
                {/* 点击遮罩关闭菜单 */}
                <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
                <div className="absolute right-0 top-10 z-50 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden w-44">
                  <button
                    className="flex items-center gap-3 w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100"
                    onClick={() => {
                      setShowMoreMenu(false);
                      setIsGroupSortMode(true);
                      setIsSortMode(false);
                      setIsBatchMode(false);
                    }}
                  >
                    <Layers size={16} className="text-gray-400" />
                    分类排序
                  </button>
                  <button
                    className="flex items-center gap-3 w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100"
                    onClick={() => {
                      setShowMoreMenu(false);
                      setIsSortMode(true);
                      setIsGroupSortMode(false);
                      setIsBatchMode(false);
                    }}
                  >
                    <SortAsc size={16} className="text-gray-400" />
                    账户排序
                  </button>
                  <button
                    className="flex items-center gap-3 w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100"
                    onClick={() => {
                      setShowMoreMenu(false);
                      setIsBatchMode(true);
                      setIsSortMode(false);
                      setIsGroupSortMode(false);
                    }}
                  >
                    <ListChecks size={16} className="text-gray-400" />
                    批量操作
                  </button>
                  <div className="border-t border-gray-100" />
                  <button
                    className="flex items-center gap-3 w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100"
                    onClick={() => {
                      setShowMoreMenu(false);
                      setImportDialogOpen(true);
                    }}
                  >
                    <Upload size={16} className="text-gray-400" />
                    导入数据
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 占位元素，防止内容被固定标题栏遮挡 */}
      <div className="h-14"></div>

      <div className="p-4 space-y-3">
        {groupedAccounts.length === 0 ? (
          <Card className="bg-white">
            <CardContent className="p-8 text-center">
              <p className="text-gray-500 mb-4">还没有账户</p>
              <Button 
                className="text-white"
                style={{ backgroundColor: themeConfig.primary }}
                onClick={() => onPageChange('account-edit')}
              >
                <Plus size={18} className="mr-1" />
                添加账户
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {(isSortMode || isGroupSortMode) && (
              <div className="px-4 py-2.5 bg-blue-50/80 border border-blue-100 rounded-xl flex items-center gap-2 text-xs text-blue-600">
                <GripVertical size={14} className="text-blue-400 flex-shrink-0" />
                <span>长按 <span className="font-medium">⠿</span> 图标可拖拽排序，点击箭头可快速置顶/置底</span>
              </div>
            )}
            {groupedAccounts.map((group, groupIndex) => {
            const isExpanded = expandedGroups[group.type] !== undefined ? expandedGroups[group.type] : true;
            const groupAccounts = group.accounts;
            const selectedCount = groupAccounts.filter(a => selectedAccounts.has(a.id)).length;
            const isAllSelected = groupAccounts.length > 0 && selectedCount === groupAccounts.length;
            
            return (
            <div key={group.type} data-group-index={groupIndex} className={`transition-all duration-200 ${
              draggingGroupType === group.type
                ? 'scale-[1.02] shadow-xl rounded-2xl z-10 relative ring-2 ring-blue-200/60'
                : draggingGroupType
                  ? 'opacity-50'
                  : ''
            } ${draggingGroupType && draggingGroupType !== group.type && dragOverGroupIndex === groupIndex
              ? 'border-l-[4px] border-l-blue-500 bg-blue-50/30 ml-1'
              : ''
            }`}>
              <Card className={`bg-white overflow-hidden transition-all duration-200 ${
                draggingGroupType === group.type ? 'border-blue-300 border' : ''
              }`}>
                {/* 分组标题栏 - 可点击展开/收起 */}
                <div
                  className="flex items-center justify-between px-3 py-2.5 bg-white cursor-pointer select-none border-b border-gray-100 hover:bg-gray-50"
                  onClick={() => !isBatchMode && toggleGroup(group.type)}
                >
                  <div className="flex items-center gap-2.5">
                    {isBatchMode && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          selectAllInGroup(groupAccounts);
                        }}
                        className="p-1"
                      >
                        {isAllSelected ? (
                          <CheckSquare size={18} className="text-blue-600" />
                        ) : selectedCount > 0 ? (
                          <div className="w-[18px] h-[18px] rounded bg-blue-600 flex items-center justify-center">
                            <div className="w-2 h-0.5 bg-white"></div>
                          </div>
                        ) : (
                          <Square size={18} className="text-gray-400" />
                        )}
                      </button>
                    )}
                    <div 
                      className="w-7 h-7 rounded-lg flex items-center justify-center bg-white shadow-sm"
                      style={{ 
                        color: group.type === 'credit' || group.type === 'debt' ? '#ef4444' : themeConfig.primary 
                      }}
                    >
                      <Icon 
                        name={getAccountTypeIcon(group.type)} 
                        size={16} 
                      />
                    </div>
                    <span className="font-semibold text-sm text-gray-800">{group.label}</span>
                    <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded-full shadow-sm">{group.accounts.length}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isGroupSortMode ? (
                      <div className="flex items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={groupIndex === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleGroupReorder(group.type, 'up');
                          }}
                        >
                          <ArrowUp size={14} className={groupIndex === 0 ? 'text-gray-200' : 'text-gray-400'} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={groupIndex === groupedAccounts.length - 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleGroupReorder(group.type, 'down');
                          }}
                        >
                          <ArrowDown size={14} className={groupIndex === groupedAccounts.length - 1 ? 'text-gray-200' : 'text-gray-400'} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={groupIndex === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleGroupReorderToIndex(group.type, 0);
                          }}
                          title="置顶"
                        >
                          <ArrowUpToLine size={14} className={groupIndex === 0 ? 'text-gray-200' : 'text-blue-500'} />
                        </Button>
                        <div
                          data-grip="group"
                          className={`touch-none select-none cursor-grab active:cursor-grabbing p-1.5 rounded-md transition-colors ${
                            draggingGroupType === group.type ? 'bg-blue-50' : 'hover:bg-gray-100'
                          }`}
                          onTouchStart={(e) => {
                            e.stopPropagation();
                            groupDragRef.current = { startY: e.touches[0].clientY, groupType: group.type, groupHeight: 60, startIndex: groupIndex };
                            dragClientYRef.current = e.touches[0].clientY;
                            setDraggingGroupType(group.type);
                            setDragOverGroupIndex(groupIndex);
                            groupDragOverIndexRef.current = groupIndex;
                            if (ghostRef.current) { ghostRef.current.style.top = (e.touches[0].clientY - 30) + 'px'; ghostRef.current.style.display = 'block'; if (ghostTextRef.current) ghostTextRef.current.textContent = group.label; }
                            if (navigator.vibrate) navigator.vibrate([10, 20, 30]);
                            startAutoScroll();
                          }}
                          onTouchMove={(e) => {
                            if (!groupDragRef.current) return;
                            // preventDefault 由原生 listener 处理（passive: false）
                            const touch = e.touches[0];
                            if (ghostRef.current) ghostRef.current.style.top = (touch.clientY - 30) + 'px';
                            dragClientYRef.current = touch.clientY;
                            if (rafRef.current) return;
                            rafRef.current = requestAnimationFrame(() => {
                              rafRef.current = 0;
                              // 按最近中心点找目标分组
                              const rows = document.querySelectorAll('[data-group-index]');
                              let bestIdx = groupDragOverIndexRef.current ?? 0;
                              let bestDist = Infinity;
                              rows.forEach((row) => {
                                const rect = row.getBoundingClientRect();
                                const dist = Math.abs(touch.clientY - (rect.top + rect.height / 2));
                                if (dist < bestDist) { bestDist = dist; const i = parseInt(row.getAttribute('data-group-index') || '-1', 10); if (i >= 0) bestIdx = i; }
                              });
                              if (bestIdx !== groupDragOverIndexRef.current) { groupDragOverIndexRef.current = bestIdx; setDragOverGroupIndex(bestIdx); }
                            });
                          }}
                          onTouchEnd={(e) => {
                            e.stopPropagation();
                            stopAutoScroll();
                            if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0; }
                            if (groupDragRef.current && groupDragOverIndexRef.current !== null && groupDragOverIndexRef.current !== groupDragRef.current.startIndex) {
                              handleGroupReorderToIndex(groupDragRef.current.groupType, groupDragOverIndexRef.current);
                            }
                            if (ghostRef.current) ghostRef.current.style.display = 'none';
                            setDraggingGroupType(null);
                            setDragOverGroupIndex(null);
                            groupDragOverIndexRef.current = null;
                            groupDragRef.current = null;
                          }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            groupDragRef.current = { startY: e.clientY, groupType: group.type, groupHeight: 60, startIndex: groupIndex };
                            dragClientYRef.current = e.clientY;
                            setDraggingGroupType(group.type);
                            setDragOverGroupIndex(groupIndex);
                            groupDragOverIndexRef.current = groupIndex;
                            if (ghostRef.current) { ghostRef.current.style.top = (e.clientY - 30) + 'px'; ghostRef.current.style.display = 'block'; if (ghostTextRef.current) ghostTextRef.current.textContent = group.label; }
                            if (navigator.vibrate) navigator.vibrate([10, 20, 30]);
                            startAutoScroll();
                            const handleMove = (me: MouseEvent) => {
                              if (!groupDragRef.current) return;
                              dragClientYRef.current = me.clientY;
                              if (ghostRef.current) ghostRef.current.style.top = (me.clientY - 30) + 'px';
                              if (rafRef.current) return;
                              rafRef.current = requestAnimationFrame(() => {
                                rafRef.current = 0;
                                const rows = document.querySelectorAll('[data-group-index]');
                                let bestIdx = groupDragOverIndexRef.current ?? 0;
                                let bestDist = Infinity;
                                rows.forEach((row) => {
                                  const rect = row.getBoundingClientRect();
                                  const dist = Math.abs(me.clientY - (rect.top + rect.height / 2));
                                  if (dist < bestDist) { bestDist = dist; const i = parseInt(row.getAttribute('data-group-index') || '-1', 10); if (i >= 0) bestIdx = i; }
                                });
                                if (bestIdx !== groupDragOverIndexRef.current) { groupDragOverIndexRef.current = bestIdx; setDragOverGroupIndex(bestIdx); }
                              });
                            };
                            const handleUp = () => {
                              stopAutoScroll();
                              if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0; }
                              if (groupDragRef.current && groupDragOverIndexRef.current !== null && groupDragOverIndexRef.current !== groupDragRef.current.startIndex) {
                                handleGroupReorderToIndex(groupDragRef.current.groupType, groupDragOverIndexRef.current);
                              }
                              if (ghostRef.current) ghostRef.current.style.display = 'none';
                              setDraggingGroupType(null);
                              setDragOverGroupIndex(null);
                              groupDragOverIndexRef.current = null;
                              groupDragRef.current = null;
                              document.removeEventListener('mousemove', handleMove);
                              document.removeEventListener('mouseup', handleUp);
                            };
                            document.addEventListener('mousemove', handleMove);
                            document.addEventListener('mouseup', handleUp);
                          }}
                        >
                          <GripVertical
                            size={16}
                            className={draggingGroupType === group.type ? 'text-blue-500' : 'text-gray-300'}
                          />
                        </div>
                      </div>
                    ) : (
                      <>
                        <span className={`text-sm font-medium ${
                          group.type === 'credit' && getGroupTotal(group.type) < 0 ? 'text-green-600' : 
                          group.type === 'credit' || group.type === 'debt' ? 'text-red-500' : ''
                        }`}>
                          {group.type === 'credit' ? (getGroupTotal(group.type) > 0 ? '欠款' : '溢缴') : ''}
  {getCurrencyConfig(baseCurrency).symbol}{formatHiddenAmount(group.type === 'credit' || group.type === 'debt' ? Math.abs(getGroupTotal(group.type)) : getGroupTotal(group.type), hideBalance)}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleGroup(group.type);
                          }}
                          className="p-1.5 rounded-full bg-white hover:bg-gray-100 transition-colors text-gray-500 shadow-sm"
                        >
                          {isExpanded ? (
                            <ChevronUp size={16} />
                          ) : (
                            <ChevronDown size={16} />
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>
                
                {/* 账户列表 */}
                {isExpanded && (
                <div className="divide-y divide-gray-100" ref={accountsListRef}>
                  {group.accounts.map((account) => {
                    const isDragging = draggingId === account.id;
                    const isDropTarget = isSortMode && dragOverIndex !== null && draggingId &&
                      draggingId !== account.id &&
                      group.accounts.indexOf(account) === dragOverIndex;
                    const anyDragging = !!draggingId;

                    return (
                    <div
                      key={account.id}
                      data-account-index={group.accounts.indexOf(account)}
                      className={`px-3 py-2 cursor-pointer transition-all duration-200 ${
                        isDragging
                          ? 'relative z-10 scale-[1.04] shadow-2xl bg-white border border-blue-300 rounded-xl -mx-0.5 ring-2 ring-blue-200/60'
                          : anyDragging
                            ? 'opacity-50'
                            : 'hover:bg-gray-50'
                      } ${isDropTarget ? 'border-l-[4px] border-l-blue-500 bg-blue-50/60 pl-[11px]' : ''}`}
                      onClick={() => {
                        if (isBatchMode) {
                          toggleAccountSelection(account.id);
                        } else if (!isSortMode) {
                          onPageChange('account-detail', { accountId: account.id });
                        }
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          {isBatchMode && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleAccountSelection(account.id);
                              }}
                              className="p-1"
                            >
                              {selectedAccounts.has(account.id) ? (
                                <CheckSquare size={18} className="text-blue-600" />
                              ) : (
                                <Square size={18} className="text-gray-400" />
                              )}
                            </button>
                          )}
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                            account.type === 'credit' || account.type === 'debt'
                              ? 'bg-red-50'
                              : ''
                          }`}>
                          <Icon
                            name={account.icon}
                            size={18}
                            color={account.type === 'credit' || account.type === 'debt' ? '#ef4444' : themeConfig.primary}
                          />
                          </div>
                          <div>
                            <div className="font-medium text-sm">{account.name}</div>
                            <div className="text-xs text-gray-400">
                              余额: {getCurrencyConfig(account.currency || 'CNY').symbol}{formatHiddenAmount(currentBalances[account.id] ?? account.balance, hideBalance, account.currency || 'CNY')}
                              {account.currency && account.currency !== baseCurrency && !hideBalance && (
                                <span className="ml-1 text-gray-300">
                                  ≈{getCurrencyConfig(baseCurrency).symbol}{formatAmountNoSymbol(convertToBaseCurrency(currentBalances[account.id] ?? account.balance, account.currency))}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
<div className="flex items-center gap-0.5">
                          {isSortMode ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                disabled={group.accounts.indexOf(account) === 0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReorder(account.id, 'up');
                                }}
                              >
                                <ArrowUp size={15} className={
                                  group.accounts.indexOf(account) === 0 ? 'text-gray-200' : 'text-gray-400'
                                } />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                disabled={group.accounts.indexOf(account) === group.accounts.length - 1}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReorder(account.id, 'down');
                                }}
                              >
                                <ArrowDown size={15} className={
                                  group.accounts.indexOf(account) === group.accounts.length - 1
                                    ? 'text-gray-200'
                                    : 'text-gray-400'
                                } />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                disabled={group.accounts.indexOf(account) === 0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReorder(account.id, 'top');
                                }}
                                title="置顶"
                              >
                                <ArrowUpToLine size={15} className={
                                  group.accounts.indexOf(account) === 0 ? 'text-gray-200' : 'text-blue-500'
                                } />
                              </Button>
                              <div
                                data-grip="account"
                                className={`touch-none select-none cursor-grab active:cursor-grabbing p-1.5 rounded-md transition-colors ${
                                  draggingId === account.id ? 'bg-blue-50' : 'hover:bg-gray-100'
                                }`}
                                onTouchStart={(e) => {
                                  e.stopPropagation();
                                  const idx = group.accounts.indexOf(account);
                                  dragRef.current = { startY: e.touches[0].clientY, accountId: account.id, groupType: group.type, itemHeight: 72, startIndex: idx };
                                  dragClientYRef.current = e.touches[0].clientY;
                                  setDraggingId(account.id);
                                  setDragOverIndex(idx);
                                  dragOverIndexRef.current = idx;
                                  if (ghostRef.current) { ghostRef.current.style.top = (e.touches[0].clientY - 30) + 'px'; ghostRef.current.style.display = 'block'; if (ghostTextRef.current) ghostTextRef.current.textContent = account.name; }
                                  if (navigator.vibrate) navigator.vibrate([10, 20, 30]);
                                  longPressTimerRef.current = setTimeout(() => {}, 300);
                                  startAutoScroll();
                                }}
                                onTouchMove={(e) => {
                                  if (!dragRef.current) return;
                                  // preventDefault 由原生 listener 处理（passive: false）
                                  const touch = e.touches[0];
                                  dragClientYRef.current = touch.clientY;
                                  if (ghostRef.current) ghostRef.current.style.top = (touch.clientY - 30) + 'px';
                                  // 位置检测：坐标计算，不依赖 elementFromPoint
                                  if (rafRef.current) return;
                                  rafRef.current = requestAnimationFrame(() => {
                                    rafRef.current = 0;
                                    const idx = calcDragOverIndex(touch.clientY, group.accounts.length);
                                    if (idx !== dragOverIndexRef.current) { dragOverIndexRef.current = idx; setDragOverIndex(idx); }
                                  });
                                }}
                                onTouchEnd={(e) => {
                                  e.stopPropagation();
                                  stopAutoScroll();
                                  if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0; }
                                  if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
                                  if (dragRef.current && dragOverIndexRef.current !== null && dragOverIndexRef.current !== dragRef.current.startIndex) {
                                    dragReorderAccountInGroup(dragRef.current.accountId, dragOverIndexRef.current);
                                    loadAccounts();
                                  }
                                  if (ghostRef.current) ghostRef.current.style.display = 'none';
                                  setDraggingId(null);
                                  setDragOverIndex(null);
                                  dragOverIndexRef.current = null;
                                  dragRef.current = null;
                                }}
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  const idx = group.accounts.indexOf(account);
                                  dragRef.current = { startY: e.clientY, accountId: account.id, groupType: group.type, itemHeight: 72, startIndex: idx };
                                  dragClientYRef.current = e.clientY;
                                  setDraggingId(account.id);
                                  setDragOverIndex(idx);
                                  dragOverIndexRef.current = idx;
                                  if (ghostRef.current) { ghostRef.current.style.top = (e.clientY - 30) + 'px'; ghostRef.current.style.display = 'block'; if (ghostTextRef.current) ghostTextRef.current.textContent = account.name; }
                                  if (navigator.vibrate) navigator.vibrate([10, 20, 30]);
                                  startAutoScroll();
                                  const handleMove = (me: MouseEvent) => {
                                    if (!dragRef.current) return;
                                    dragClientYRef.current = me.clientY;
                                    if (ghostRef.current) ghostRef.current.style.top = (me.clientY - 30) + 'px';
                                    if (rafRef.current) return;
                                    rafRef.current = requestAnimationFrame(() => {
                                      rafRef.current = 0;
                                      const idx2 = calcDragOverIndex(me.clientY, group.accounts.length);
                                      if (idx2 !== dragOverIndexRef.current) { dragOverIndexRef.current = idx2; setDragOverIndex(idx2); }
                                    });
                                  };
                                  const handleUp = () => {
                                    stopAutoScroll();
                                    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0; }
                                    if (dragRef.current && dragOverIndexRef.current !== null && dragOverIndexRef.current !== dragRef.current.startIndex) {
                                      dragReorderAccountInGroup(dragRef.current.accountId, dragOverIndexRef.current);
                                      loadAccounts();
                                    }
                                    if (ghostRef.current) ghostRef.current.style.display = 'none';
                                    setDraggingId(null);
                                    setDragOverIndex(null);
                                    dragOverIndexRef.current = null;
                                    dragRef.current = null;
                                    document.removeEventListener('mousemove', handleMove);
                                    document.removeEventListener('mouseup', handleUp);
                                  };
                                  document.addEventListener('mousemove', handleMove);
                                  document.addEventListener('mouseup', handleUp);
                                }}
                              >
                                <GripVertical
                                  size={16}
                                  className={draggingId === account.id ? 'text-blue-500' : 'text-gray-300'}
                                />
                              </div>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onPageChange('account-edit', { accountId: account.id });
                                }}
                              >
                                <Edit3 size={16} className="text-gray-400" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(account);
                                }}
                              >
                                <Trash2 size={16} className="text-red-400" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                      
                      {/* 设置项 */}
                      <div className="flex items-center justify-between pt-2 mt-2 border-t border-gray-50">
                        <div className="flex items-center gap-4">
                          <div
                            className="flex items-center gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Switch
                              checked={account.includeInTotal}
                              onCheckedChange={() => toggleIncludeInTotal(account)}
                              style={
                                account.includeInTotal
                                  ? ({
                                      '--switch-checked-bg': themeConfig.primary,
                                    } as React.CSSProperties)
                                  : undefined
                              }
                              className="data-[state=checked]:bg-[var(--switch-checked-bg)]"
                            />
                            <span className="text-xs text-gray-500">计入总资产</span>
                          </div>
                          <div
                            className="flex items-center gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2"
                              onClick={() => toggleHidden(account)}
                            >
                              {account.isHidden ? (
                                <EyeOff size={14} className="text-gray-400 mr-1" />
                              ) : (
                                <Eye size={14} style={{ color: themeConfig.primary }} className="mr-1" />
                              )}
                              <span className="text-xs">
                                {account.isHidden ? '已隐藏' : '显示'}
                              </span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                  })}
                </div>
                )}
              </Card>
            </div>
            );
          })}
          </>
        )}
      </div>

      {/* 底部操作区 */}
      {isAnyEditMode ? (
        /* 编辑模式底部操作栏 */
        <div className="fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto bg-white border-t border-gray-200 shadow-lg">
          {/* 批量模式：已选操作 */}
          {isBatchMode && selectedAccounts.size > 0 && (
            <div className="flex items-center justify-between px-4 py-2 bg-blue-50 border-b border-blue-100">
              <span className="text-sm text-blue-700 font-medium">
                已选 {selectedAccounts.size} 个账户
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setBatchActionDialog('type')}>
                  调整分类
                </Button>
                <Button size="sm" variant="destructive" className="text-xs h-7" onClick={() => setBatchActionDialog('delete')}>
                  删除
                </Button>
              </div>
            </div>
          )}
          {/* 分类排序模式：新建分类 */}
          {isGroupSortMode && (
            <div className="px-4 py-2 bg-amber-50 border-b border-amber-100">
              <Button
                variant="outline"
                size="sm"
                className="w-full h-8 text-xs border-amber-200 text-amber-700 hover:bg-amber-50"
                onClick={() => setCreateTypeDialogOpen(true)}
              >
                <FolderPlus size={14} className="mr-1.5" />
                新建空分类
              </Button>
            </div>
          )}
          {/* 模式切换标签 + 完成按钮 */}
          <div className="flex items-center px-2 py-2 gap-1">
            <button
              className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-xs transition-colors ${
                isGroupSortMode ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50'
              }`}
              onClick={() => { setIsGroupSortMode(true); setIsSortMode(false); setIsBatchMode(false); setSelectedAccounts(new Set()); }}
            >
              <Layers size={16} />
              分类排序
            </button>
            <button
              className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-xs transition-colors ${
                isSortMode ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50'
              }`}
              onClick={() => { setIsSortMode(true); setIsGroupSortMode(false); setIsBatchMode(false); setSelectedAccounts(new Set()); }}
            >
              <SortAsc size={16} />
              账户排序
            </button>
            <button
              className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-xs transition-colors ${
                isBatchMode ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50'
              }`}
              onClick={() => { setIsBatchMode(true); setIsSortMode(false); setIsGroupSortMode(false); }}
            >
              <ListChecks size={16} />
              批量操作
            </button>
            <button
              className="flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-lg text-xs font-medium text-white"
              style={{ backgroundColor: themeConfig.primary }}
              onClick={exitEditMode}
            >
              <X size={16} />
              完成
            </button>
          </div>
        </div>
      ) : (
        /* 普通模式：添加账户按钮 */
        <div className="fixed bottom-6 left-4 right-4">
          <Button
            className="w-full h-12 text-white"
            style={{ backgroundColor: themeConfig.primary }}
            onClick={() => onPageChange('account-edit')}
          >
            <Plus size={20} className="mr-2" />
            添加账户
          </Button>
        </div>
      )}

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除账户</DialogTitle>
            <DialogDescription>
              请选择删除方式
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 py-2">
            <div 
              className="border rounded-lg p-4 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => confirmDelete('currentMonth')}
            >
              <div className="font-medium text-sm">仅删除本月记录</div>
              <div className="text-xs text-gray-400 mt-1">
                不影响其他月份，历史数据完整保留
              </div>
            </div>
            
            <div 
              className="border border-red-200 rounded-lg p-4 cursor-pointer hover:bg-red-50 transition-colors"
              onClick={() => confirmDelete('global')}
            >
              <div className="font-medium text-sm text-red-600">完全删除（含所有历史）</div>
              <div className="text-xs text-gray-400 mt-1">
                删除此账户的全部月份数据，不可恢复
              </div>
            </div>
          </div>
          
          <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} className="w-full mt-2">
            取消
          </Button>
        </DialogContent>
      </Dialog>

      {/* 批量操作对话框 - 调整分类 */}
      <Dialog open={batchActionDialog === 'type'} onOpenChange={() => setBatchActionDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>批量调整分类</DialogTitle>
            <DialogDescription>
              将选中的 {selectedAccounts.size} 个账户移动到指定分类
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            {/* 内置类型网格 */}
            <div>
              <Label className="text-xs text-gray-500 mb-2 block">内置类型</Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setSelectedCustomType('_none_')}
                  className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-xl border-2 transition-all active:scale-95 ${
                    selectedCustomType === '_none_' 
                      ? 'border-blue-500 bg-blue-50 text-blue-600' 
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <X size={16} className="mb-0.5" />
                  <span className="text-[11px] font-medium">移出分类</span>
                </button>
                {ACCOUNT_TYPES.map(at => (
                  <button
                    key={at.type}
                    onClick={() => setSelectedCustomType(`_builtin_${at.type}`)}
                    className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-xl border-2 transition-all active:scale-95 ${
                      selectedCustomType === `_builtin_${at.type}`
                        ? 'border-blue-500 bg-blue-50 text-blue-600'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <Icon name={at.icon} size={16} className="mb-0.5" />
                    <span className="text-[11px] font-medium">{at.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 自定义类型网格 */}
            {getCustomAccountTypes().length > 0 && (
              <div>
                <Label className="text-xs text-gray-500 mb-2 block">自定义类型</Label>
                <div className="grid grid-cols-3 gap-2">
                  {getCustomAccountTypes().map(ct => (
                    <button
                      key={ct.id}
                      onClick={() => setSelectedCustomType(ct.label)}
                      className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-xl border-2 transition-all active:scale-95 ${
                        selectedCustomType === ct.label
                          ? 'border-blue-500 bg-blue-50 text-blue-600'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <Icon name={ct.icon || 'folder'} size={16} className="mb-0.5" />
                      <span className="text-[11px] font-medium truncate max-w-full px-0.5">{ct.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 新建自定义分类 */}
            <div>
              <button
                onClick={() => setSelectedCustomType(selectedCustomType === '_new_' ? '' : '_new_')}
                className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border-2 border-dashed transition-all active:scale-95 ${
                  selectedCustomType === '_new_'
                    ? 'border-blue-500 bg-blue-50 text-blue-600'
                    : 'border-gray-300 bg-white text-gray-500 hover:border-gray-400'
                }`}
              >
                <Plus size={16} />
                <span className="text-sm font-medium">新建自定义分类</span>
              </button>
              
              {selectedCustomType === '_new_' && (
                <div className="mt-2 space-y-2">
                  <Input
                    value={newCustomType}
                    onChange={(e) => setNewCustomType(e.target.value)}
                    placeholder="输入新分类名称"
                    className="h-10"
                    autoFocus
                  />
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchActionDialog(null)}>
              取消
            </Button>
            <Button 
              onClick={handleBatchTypeChange}
              disabled={!selectedCustomType || (selectedCustomType === '_new_' && !newCustomType.trim())}
              style={{ backgroundColor: themeConfig.primary }}
              className="text-white"
            >
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 批量操作对话框 - 删除确认 */}
      <Dialog open={batchActionDialog === 'delete'} onOpenChange={() => setBatchActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认批量删除</DialogTitle>
            <DialogDescription>
              确定要删除选中的 {selectedAccounts.size} 个账户的本月记录吗？
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <p className="text-sm text-gray-500">
              此操作只会删除这些账户在当前月份的记录，不会影响历史数据。
            </p>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchActionDialog(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleBatchDelete}>
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 创建空分类对话框 */}
      <Dialog open={createTypeDialogOpen} onOpenChange={setCreateTypeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建空分类</DialogTitle>
            <DialogDescription>
              创建一个空的自定义分类，稍后可以将账户归入此分类
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>分类名称</Label>
              <Input
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                placeholder="例如：投资账户、家庭公用"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateTypeDialogOpen(false)}>
              取消
            </Button>
            <Button 
              onClick={handleCreateCustomType}
              style={{ backgroundColor: themeConfig.primary }}
              className="text-white"
            >
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 导入对话框 */}
      <Dialog open={importDialogOpen} onOpenChange={handleCloseImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>导入数据</DialogTitle>
          </DialogHeader>

          {/* 导入模式切换 */}
          <div className="flex gap-2 py-2">
            <Button
              variant={importMode === 'json' ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
              style={importMode === 'json' ? { backgroundColor: '#0ea5e9' } : {}}
              onClick={() => setImportMode('json')}
            >
              <FileJson size={16} className="mr-1" />
              JSON 恢复
            </Button>
            <Button
              variant={importMode === 'excel' ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
              style={importMode === 'excel' ? { backgroundColor: '#0ea5e9' } : {}}
              onClick={() => setImportMode('excel')}
            >
              <FileSpreadsheet size={16} className="mr-1" />
              Excel 批量
            </Button>
          </div>

          {/* JSON 导入模式 */}
          {importMode === 'json' && (
            <>
              <DialogDescription className="text-sm">
                选择之前导出的 JSON 文件进行恢复。导入将覆盖当前所有数据。
              </DialogDescription>
              <div className="py-4">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="w-full"
                />
              </div>
            </>
          )}

          {/* Excel 导入模式 */}
          {importMode === 'excel' && (
            <>
              <DialogDescription className="text-sm">
                上传 Excel/CSV 文件，批量导入月度存款数据。目标账户设为 Excel 余额，其余账户设为 0。
              </DialogDescription>

              <div className="py-3 space-y-3">
                {/* 下载模板按钮 */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={handleDownloadTemplate}
                >
                  <Download size={16} className="mr-1" />
                  下载导入模板
                </Button>

                {/* 文件选择 */}
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleExcelFileChange}
                  className="w-full text-sm"
                />

                {/* Excel 数据预览 */}
                {excelData.length > 0 && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg text-xs">
                    <div className="font-medium mb-2">预览 ({excelData.length} 条数据)</div>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {excelData.slice(0, 5).map((row, index) => (
                        <div key={index} className="flex justify-between text-gray-600">
                          <span>{row.month}</span>
                          <span className="text-gray-400">{row.accountName}</span>
                          <span className="font-medium">{row.balance.toFixed(2)}</span>
                        </div>
                      ))}
                      {excelData.length > 5 && (
                        <div className="text-gray-400">...还有 {excelData.length - 5} 条</div>
                      )}
                    </div>
                  </div>
                )}

                {/* 错误提示 */}
                {excelError && (
                  <div className="text-red-500 text-sm">{excelError}</div>
                )}
              </div>

              <DialogFooter>
                <Button
                  onClick={handleExcelImport}
                  disabled={excelData.length === 0}
                  style={{ backgroundColor: '#0ea5e9' }}
                  className="text-white"
                >
                  确认导入
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* 拖拽排序动画样式 */}
      <style>{`
        @keyframes drag-ghost-in {
          from { opacity: 0; transform: translateX(-50%) scale(0.85); }
          to { opacity: 1; transform: translateX(-50%) scale(1); }
        }
        @keyframes drop-indicator-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>

      {/* 拖拽幽灵卡片 — ref 驱动，不触发 React 重渲染 */}
      <div
        ref={ghostRef}
        className="fixed left-1/2 -translate-x-1/2 z-[100] pointer-events-none"
        style={{ display: 'none', animation: 'drag-ghost-in 0.15s ease-out' }}
      >
        <div className="bg-white/95 backdrop-blur-sm shadow-[0_12px_40px_rgba(0,0,0,0.18)] rounded-xl px-4 py-3 border border-blue-200/60 flex items-center gap-3 min-w-[200px]">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
            <GripVertical size={16} className="text-blue-500" />
          </div>
          <span ref={ghostTextRef} className="font-medium text-sm text-gray-800"></span>
        </div>
      </div>
    </div>
  );
}
