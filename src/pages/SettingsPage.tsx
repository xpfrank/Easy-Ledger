import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Download, Upload, Trash2, Info, FileText, Palette, Check, Copy, FileSpreadsheet, FileJson, ChevronRight, Tag, Wrench } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { PageRoute, ThemeType, CustomAttributionTag } from '@/types';
import type { ExcelImportRow } from '@/lib/storage';
import { exportDataByRange, importData, clearAllData, getSettings, updateSettings, parseExcelCSV, batchImportFromExcel, exportExcelTemplate, hasGarbledText, exportToCSV, exportMonthlyAttributionCSV, exportYearlyAttributionCSV, importMonthlyAttributionCSV, importYearlyAttributionCSV, validateData, dedupeRecords, getCustomAttributionTags, saveCustomAttributionTag, deleteCustomAttributionTag, getAllAttributionTagOptions } from '@/lib/storage';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { THEMES } from '@/types';

interface SettingsPageProps {
  onPageChange: (page: PageRoute, params?: any) => void;
}

const CollapsibleSection = ({
  icon,
  iconBg,
  title,
  children,
  defaultOpen = false,
}: {
  icon: string;
  iconBg: string;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`mb-2 rounded-2xl overflow-hidden border border-gray-100 ${open ? 'open' : ''}`}>
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-3 px-4 py-3.5 transition-colors ${
          open ? 'bg-sky-50' : 'bg-gray-50 hover:bg-gray-100'
        }`}
      >
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0"
          style={{ background: iconBg }}
        >
          {icon}
        </div>
        <span className="flex-1 text-left text-sm font-semibold text-gray-700">{title}</span>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: open ? '600px' : '0px',
          padding: open ? '0 16px 16px' : '0 16px',
          opacity: open ? 1 : 0,
        }}
      >
        <div className="pt-3">{children}</div>
      </div>
    </div>
  );
};

const FeatureItem = ({ emoji, title, desc }: { emoji: string; title: string; desc: string }) => (
  <div className="flex items-start gap-3 p-2.5 bg-gray-50 rounded-xl">
    <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-sm flex-shrink-0 shadow-sm">
      {emoji}
    </div>
    <div>
      <h4 className="text-[13px] font-semibold text-gray-800 mb-0.5">{title}</h4>
      <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
    </div>
  </div>
);

const FlowStep = ({ num, children, isLast }: { num: number; children: React.ReactNode; isLast?: boolean }) => (
  <div className="flex gap-3 relative pl-2" style={{ paddingBottom: isLast ? 0 : 16 }}>
    {!isLast && (
      <div className="absolute left-[19px] top-6 w-0.5 h-[calc(100%-16px)] bg-gray-200" />
    )}
    <div className="w-6 h-6 rounded-full bg-sky-500 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0 z-10">
      {num}
    </div>
    <div className="pt-0.5 text-[13px] text-gray-600 leading-relaxed">{children}</div>
  </div>
);

const DataCard = ({ icon, title, desc }: { icon: string; title: string; desc: string }) => (
  <div className="p-3 bg-gray-50 rounded-xl text-center">
    <div className="text-xl mb-1.5">{icon}</div>
    <div className="text-xs font-semibold text-gray-700 mb-0.5">{title}</div>
    <div className="text-[11px] text-gray-500 leading-snug">{desc}</div>
  </div>
);

export function SettingsPage({ onPageChange }: SettingsPageProps) {
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showAboutDialog, setShowAboutDialog] = useState(false);
  const [showThemeDialog, setShowThemeDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showTagDialog, setShowTagDialog] = useState(false);
  const [importError, setImportError] = useState('');
  const [theme, setTheme] = useState<ThemeType>('blue');

  // Excel 导入相关状态
  const [importMode, setImportMode] = useState<'json' | 'excel'>('json');
  const [excelData, setExcelData] = useState<ExcelImportRow[]>([]);
  const [excelError, setExcelError] = useState('');

  // 导出设置
  const [exportStartYear, setExportStartYear] = useState(new Date().getFullYear());
  const [exportStartMonth, setExportStartMonth] = useState(new Date().getMonth() + 1);
  const [exportEndYear, setExportEndYear] = useState(new Date().getFullYear());
  const [exportEndMonth, setExportEndMonth] = useState(new Date().getMonth() + 1);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
  const [exportContent, setExportContent] = useState<{
    balance: boolean;
    monthlyAttribution: boolean;
    yearlyAttribution: boolean;
  }>({ balance: true, monthlyAttribution: true, yearlyAttribution: true });

  // 导入设置
  const [importTargetYear, setImportTargetYear] = useState(new Date().getFullYear());
  const [importTargetMonth, setImportTargetMonth] = useState(new Date().getMonth() + 1);
  const [importJsonMergeMode, setImportJsonMergeMode] = useState<'overwrite' | 'merge'>('merge');
  const [importExcelMergeMode, setImportExcelMergeMode] = useState<'overwrite' | 'merge'>('merge');
  const [importType, setImportType] = useState<'balance' | 'monthlyAttribution' | 'yearlyAttribution'>('balance');
  const [importAttributionMergeMode, setImportAttributionMergeMode] = useState<'overwrite' | 'merge' | 'skip'>('merge');

  // 自定义标签相关状态
  const [customTags, setCustomTags] = useState<CustomAttributionTag[]>([]);
  const [newTagLabel, setNewTagLabel] = useState('');
  const [newTagEmoji, setNewTagEmoji] = useState('🏷️');
  const [tagAddError, setTagAddError] = useState('');

  const handleAddTag = () => {
    if (!newTagLabel.trim()) { setTagAddError('请输入标签名称'); return; }
    if (newTagLabel.trim().length > 8) { setTagAddError('标签名称最多8个字'); return; }
    const tag = saveCustomAttributionTag({ label: newTagLabel.trim(), emoji: newTagEmoji });
    setCustomTags(prev => [...prev, tag]);
    setNewTagLabel('');
    setNewTagEmoji('🏷️');
    setTagAddError('');
    setShowTagDialog(false);
  };

  const handleDeleteTag = (id: string) => {
    deleteCustomAttributionTag(id);
    setCustomTags(prev => prev.filter(t => t.id !== id));
  };

  const currentYear = new Date().getFullYear();
  const yearRange = Array.from({ length: 21 }, (_, i) => currentYear - 10 + i);

  useEffect(() => {
    setCustomTags(getCustomAttributionTags());
    const settings = getSettings();
    setTheme(settings.theme || 'blue');
  }, []);

  const handleThemeChange = (newTheme: ThemeType) => {
    setTheme(newTheme);
    updateSettings({ theme: newTheme });
    setShowThemeDialog(false);
    window.location.reload();
  };

  const [showExportSuccess, setShowExportSuccess] = useState(false);
  const [exportedData, setExportedData] = useState('');
  const [copied, setCopied] = useState(false);
  const exportTextareaRef = useRef<HTMLTextAreaElement>(null);

  // 检测是否在 Capacitor Android 环境中
  const isCapacitorAndroid = () => {
    return typeof (window as any).Capacitor !== 'undefined' && 
           (window as any).Capacitor.getPlatform() === 'android';
  };

  const handleExport = async () => {
    const isCSV = exportFormat === 'csv';
    let data = '';
    let ext = '';
    let mimeType = '';

    const fileNameBase = `记账数据_${exportStartYear}${exportStartMonth.toString().padStart(2, '0')}-${exportEndYear}${exportEndMonth.toString().padStart(2, '0')}`;

    if (!exportContent.balance && !exportContent.monthlyAttribution && !exportContent.yearlyAttribution) {
      setImportError('请至少选择一项导出内容');
      return;
    }

    if (isCSV) {
      const parts: string[] = [];
      if (exportContent.balance) {
        parts.push(exportToCSV(exportStartYear, exportStartMonth, exportEndYear, exportEndMonth));
      }
      if (exportContent.monthlyAttribution) {
        parts.push('\n--- 月度归因 ---\n');
        parts.push(exportMonthlyAttributionCSV(exportStartYear, exportStartMonth, exportEndYear, exportEndMonth));
      }
      if (exportContent.yearlyAttribution) {
        parts.push('\n--- 年度归因 ---\n');
        parts.push(exportYearlyAttributionCSV(exportStartYear, exportEndYear));
      }
      data = parts.join('\n');
      ext = 'csv';
      mimeType = 'text/csv;charset=utf-8';
    } else {
      data = exportDataByRange(exportStartYear, exportStartMonth, exportEndYear, exportEndMonth);
      ext = 'json';
      mimeType = 'application/json';
    }

    const fileName = `${fileNameBase}.${ext}`;
    
    // 尝试使用 Web Share API（在 Android Chrome 中可用）
    if (navigator.share && navigator.canShare && isCapacitorAndroid()) {
      try {
        const blob = new Blob([data], { type: mimeType });
        const file = new File([blob], fileName, { type: mimeType });
        
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: '记账数据导出',
            text: `记账数据 (${exportStartYear}年${exportStartMonth}月 - ${exportEndYear}年${exportEndMonth}月)`
          });
          setShowExportDialog(false);
          return;
        }
      } catch (error) {
        // 用户取消分享或分享失败，继续尝试其他方式
        console.log('Share API failed:', error);
      }
    }
    
    // 标准浏览器下载方式
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    
    // 对于 Android WebView，尝试使用 intent 方式
    if (isCapacitorAndroid()) {
      // 显示数据复制对话框作为备选方案
      setExportedData(data);
      setShowExportSuccess(true);
      setShowExportDialog(false);
    } else {
      // 标准浏览器
      a.click();
      URL.revokeObjectURL(url);
      setShowExportDialog(false);
    }
  };

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(exportedData);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // 如果 clipboard API 失败，使用传统的选择复制方式
      if (exportTextareaRef.current) {
        exportTextareaRef.current.select();
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setImportError('');

    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        if (importData(content, importTargetYear, importTargetMonth, importJsonMergeMode)) {
          setShowImportDialog(false);
          alert('数据导入成功');
          window.location.reload();
        } else {
          setImportError('数据导入失败，请检查文件格式是否正确');
        }
      };
      reader.onerror = () => {
        setImportError('文件读取失败');
      };
      reader.readAsText(file);
    }
  };

  const handleExcelFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setExcelError('');

    if (file) {
      // 检查文件扩展名
      const fileName = file.name.toLowerCase();
      if (!fileName.endsWith('.csv')) {
        setExcelError('仅支持 .csv 格式文件，请将 Excel 文件另存为 CSV 格式');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;

        // 检测乱码
        if (hasGarbledText(content)) {
          setExcelError('检测到文件编码问题，请将 CSV 文件另存为 UTF-8 编码后重新导入');
          return;
        }

        const parsed = parseExcelCSV(content);
        if (parsed.length > 0) {
          setExcelData(parsed);
          setExcelError('');
        } else {
          setExcelData([]);
          setExcelError('无法解析 CSV 文件，请确保格式正确（月份,账户名称,余额）');
        }
      };
      reader.onerror = () => {
        setExcelError('文件读取失败，请尝试重新下载模板');
      };
      reader.readAsText(file);
    }
  };

  const handleExcelImport = () => {
    if (excelData.length === 0) {
      setExcelError('请先选择 Excel 文件');
      return;
    }
    const result = batchImportFromExcel(excelData, importExcelMergeMode);
    alert(result.message);
    if (result.success) {
      setShowImportDialog(false);
      setExcelData([]);
      setImportMode('json');
      window.location.reload();
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
    setShowImportDialog(open);
    if (!open) {
      setExcelData([]);
      setExcelError('');
      setImportMode('json');
      setImportError('');
      setImportType('balance');
    }
  };

  const handleClear = () => {
    clearAllData();
    setShowClearDialog(false);
    alert('所有数据已清空');
    window.location.reload();
  };

  const themeConfig = THEMES[theme];
  const presetTags = getAllAttributionTagOptions().filter(t => !t.editable);

  // ─── Reusable section row ─────────────────────────────────────────────────
  const SettingRow = ({
    icon, iconBg, iconColor, title, subtitle, onClick, danger = false, rightNode,
  }: {
    icon: React.ReactNode; iconBg: string; iconColor?: string;
    title: string; subtitle?: string; onClick?: () => void;
    danger?: boolean; rightNode?: React.ReactNode;
  }) => (
    <button
      className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          <span className={iconColor}>{icon}</span>
        </div>
        <div className="text-left">
          <div className={`font-medium text-sm ${danger ? 'text-red-500' : 'text-gray-800'}`}>{title}</div>
          {subtitle && <div className="text-xs text-gray-400 mt-0.5">{subtitle}</div>}
        </div>
      </div>
      {rightNode ?? <ChevronRight size={16} className="text-gray-300" />}
    </button>
  );

  return (
    <div className="pb-6 bg-gray-50 min-h-screen overflow-x-hidden">
      {/* 标题栏 - 使用 fixed 定位确保始终可见 */}
      <header className="bg-white px-4 py-3 flex justify-between items-center fixed top-0 left-0 right-0 z-50 max-w-md mx-auto shadow-sm">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => onPageChange('home')}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-lg font-semibold">设置</h1>
        </div>
      </header>

      {/* 占位元素，防止内容被固定标题栏遮挡 */}
      <div className="h-14"></div>

      <div className="p-4 space-y-5">
        {/* ── 个性化 ──────────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mb-2">个性化</h2>
          <Card className="bg-white overflow-hidden divide-y divide-gray-100">
            {/* 主题皮肤 */}
            <button 
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              onClick={() => setShowThemeDialog(true)}
            >
              <div className="flex items-center gap-3">
                <div 
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${themeConfig.primary}15` }}
                >
                  <Palette size={18} style={{ color: themeConfig.primary }} />
                </div>
                <div className="text-left">
                  <div className="font-medium text-sm text-gray-800">主题皮肤</div>
                  <div className="text-xs text-gray-400 mt-0.5">当前：{themeConfig.name}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-5 h-5 rounded-full"
                  style={{ background: `linear-gradient(135deg, ${themeConfig.gradientFrom}, ${themeConfig.gradientTo})` }}
                />
                <ChevronRight size={16} className="text-gray-300" />
              </div>
            </button>

            {/* 归因标签管理 */}
            <button
              className="w-full p-4 hover:bg-gray-50 transition-colors text-left"
              onClick={() => setShowTagDialog(true)}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${themeConfig.primary}15` }}>
                    <Tag size={18} style={{ color: themeConfig.primary }} />
                  </div>
                  <div>
                    <div className="font-medium text-sm text-gray-800">归因标签</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {presetTags.length} 个预设 · {customTags.length > 0 ? `${customTags.length} 个自定义` : '可添加自定义标签'}
                    </div>
                  </div>
                </div>
                <ChevronRight size={16} className="text-gray-300" />
              </div>

              {/* 标签预览行 */}
              <div className="ml-12 flex flex-wrap gap-1.5">
                {getAllAttributionTagOptions().slice(0, 6).map(tag => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                    style={
                      tag.editable
                        ? { backgroundColor: `${themeConfig.primary}18`, color: themeConfig.primary }
                        : { backgroundColor: '#f3f4f6', color: '#6b7280' }
                    }
                  >
                    {tag.emoji} {tag.label}
                  </span>
                ))}
                {getAllAttributionTagOptions().length > 6 && (
                  <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-400">
                    +{getAllAttributionTagOptions().length - 6}
                  </span>
                )}
              </div>
            </button>
          </Card>
        </section>

        {/* ── 数据管理 ─────────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mb-2">数据管理</h2>
          <Card className="bg-white overflow-hidden divide-y divide-gray-100">
            <SettingRow
              icon={<Download size={18} />}
              iconBg="" iconColor=""
              title="导出数据"
              subtitle="按时间范围导出 JSON / CSV"
              onClick={() => setShowExportDialog(true)}
              rightNode={
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-400">JSON · CSV</span>
                  <ChevronRight size={16} className="text-gray-300" />
                </div>
              }
            />
            <SettingRow
              icon={<Upload size={18} />}
              iconBg="bg-blue-50" iconColor="text-blue-500"
              title="导入数据"
              subtitle="从文件恢复或批量录入"
              onClick={() => setShowImportDialog(true)}
            />
            <SettingRow
              icon={<Trash2 size={18} />}
              iconBg="bg-red-50" iconColor="text-red-400"
              title="清空所有数据"
              subtitle="删除所有账户和记录"
              onClick={() => setShowClearDialog(true)}
              danger
              rightNode={<ChevronRight size={16} className="text-red-200" />}
            />
          </Card>
        </section>

        {/* ── 工具 ────────────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mb-2">工具</h2>
          <Card className="bg-white overflow-hidden">
            <SettingRow
              icon={<Wrench size={18} />}
              iconBg="bg-orange-50" iconColor="text-orange-500"
              title="修复重复数据"
              subtitle="检测并去除重复记录"
              onClick={() => {
                const result = validateData();
                if (result.isHealthy) {
                  alert(`数据健康，无需修复。当前记录数: ${result.recordCount}`);
                } else if (confirm(`检测到 ${result.duplicates.length} 条重复记录，是否执行去重？`)) {
                  const removed = dedupeRecords();
                  alert(`去重完成，删除了 ${removed} 条重复记录`);
                }
              }}
            />
          </Card>
        </section>

        {/* ── 关于 ────────────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mb-2">关于</h2>
          <Card className="bg-white overflow-hidden divide-y divide-gray-100">
            <SettingRow
              icon={<Info size={18} />}
              iconBg="bg-gray-100" iconColor="text-gray-500"
              title="使用说明"
              subtitle="了解如何使用本应用"
              onClick={() => setShowAboutDialog(true)}
            />
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                <FileText size={18} className="text-gray-500" />
              </div>
              <div>
                <div className="font-medium text-sm text-gray-800">应用版本</div>
                <div className="text-xs text-gray-400 mt-0.5">当前版本 1.0.2</div>
              </div>
            </div>
          </Card>
        </section>
      </div>

      {/* 主题选择对话框 */}
      <Dialog open={showThemeDialog} onOpenChange={setShowThemeDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>选择主题</DialogTitle></DialogHeader>
          <div className="py-4">
            <div className="grid grid-cols-1 gap-3">
              {(Object.keys(THEMES) as ThemeType[]).map((themeKey) => {
                const config = THEMES[themeKey];
                return (
                  <button
                    key={themeKey}
                    onClick={() => handleThemeChange(themeKey)}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${theme === themeKey ? '' : 'border-transparent hover:border-gray-200'}`}
                    style={{ borderColor: theme === themeKey ? config.primary : undefined }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex-shrink-0"
                      style={{ background: `linear-gradient(135deg, ${config.gradientFrom} 0%, ${config.gradientTo} 100%)` }}
                    />
                    <div className="flex-1 text-left">
                      <div className="font-medium text-sm">{config.name}</div>
                    </div>
                    {theme === themeKey && (
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0"
                        style={{ backgroundColor: config.primary }}>✓</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════
          归因标签管理弹窗
      ════════════════════════════════════════════════════════ */}
      <Dialog open={showTagDialog} onOpenChange={setShowTagDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>归因标签管理</DialogTitle>
            <DialogDescription>预设标签不可删除，可添加自定义标签用于月度/年度归因记录</DialogDescription>
          </DialogHeader>

          <div className="py-3 space-y-4">
            {/* 预设标签 */}
            <div>
              <div className="text-xs font-medium text-gray-400 mb-2">系统预设</div>
              <div className="flex flex-wrap gap-1.5">
                {presetTags.map(tag => (
                  <span key={tag.id} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 rounded-full text-xs text-gray-600">
                    {tag.emoji} {tag.label}
                  </span>
                ))}
              </div>
            </div>

            {/* 自定义标签 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-medium text-gray-400">自定义标签</div>
                {customTags.length === 0 && (
                  <span className="text-xs text-gray-300">暂无，在下方添加</span>
                )}
              </div>
              {customTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {customTags.map(tag => (
                    <span
                      key={tag.id}
                      className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full text-xs"
                      style={{ backgroundColor: `${themeConfig.primary}15`, color: themeConfig.primary }}
                    >
                      {tag.emoji} {tag.label}
                      <button
                        className="w-4 h-4 rounded-full bg-gray-200 hover:bg-red-400 text-gray-500 hover:text-white flex items-center justify-center transition-colors ml-0.5"
                        onClick={() => handleDeleteTag(tag.id)}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* 新增输入区 */}
              <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                <div className="text-xs text-gray-500 font-medium">添加新标签</div>
                <div className="flex items-center gap-2">
                  <input
                    className="w-10 h-9 border border-gray-200 rounded-lg text-center text-base bg-white focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ '--tw-ring-color': themeConfig.primary } as any}
                    value={newTagEmoji}
                    onChange={e => setNewTagEmoji(e.target.value.slice(-2) || '🏷️')}
                    placeholder="🏷️"
                    maxLength={2}
                  />
                  <input
                    className="flex-1 h-9 border border-gray-200 rounded-lg px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ '--tw-ring-color': themeConfig.primary } as any}
                    placeholder="标签名称（最多8字）"
                    value={newTagLabel}
                    onChange={e => { setNewTagLabel(e.target.value.slice(0, 8)); setTagAddError(''); }}
                    maxLength={8}
                    onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                  />
                  <button
                    className="h-9 px-3 rounded-lg text-white text-sm font-medium flex-shrink-0 transition-opacity hover:opacity-80"
                    style={{ backgroundColor: themeConfig.primary }}
                    onClick={handleAddTag}
                  >
                    添加
                  </button>
                </div>
                {tagAddError && <p className="text-xs text-red-500">{tagAddError}</p>}
                <p className="text-xs text-gray-400">添加后可在月度归因、年度归因编辑页面选择使用</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 导出对话框 */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>导出数据</DialogTitle>
            <DialogDescription>
              选择要导出的时间范围
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <div className="text-sm text-gray-500 mb-2">开始时间</div>
              <div className="flex gap-2">
                <select
                  value={exportStartYear}
                  onChange={(e) => setExportStartYear(Number(e.target.value))}
                  className="flex-1 p-2 border rounded-lg"
                >
                  {yearRange.map(y => <option key={y} value={y}>{y}年</option>)}
                </select>
                <select
                  value={exportStartMonth}
                  onChange={(e) => setExportStartMonth(Number(e.target.value))}
                  className="flex-1 p-2 border rounded-lg"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>{m}月</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-2">结束时间</div>
              <div className="flex gap-2">
                <select
                  value={exportEndYear}
                  onChange={(e) => setExportEndYear(Number(e.target.value))}
                  className="flex-1 p-2 border rounded-lg"
                >
                  {yearRange.map(y => <option key={y} value={y}>{y}年</option>)}
                </select>
                <select
                  value={exportEndMonth}
                  onChange={(e) => setExportEndMonth(Number(e.target.value))}
                  className="flex-1 p-2 border rounded-lg"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>{m}月</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-2">导出格式</div>
              <div className="flex gap-2">
                <button
                  onClick={() => setExportFormat('json')}
                  className={`flex-1 p-2 rounded-lg border text-sm ${
                    exportFormat === 'json' ? 'border-2' : 'border-gray-200'
                  }`}
                  style={{ borderColor: exportFormat === 'json' ? themeConfig.primary : undefined }}
                >
                  JSON
                </button>
                <button
                  onClick={() => setExportFormat('csv')}
                  className={`flex-1 p-2 rounded-lg border text-sm ${
                    exportFormat === 'csv' ? 'border-2' : 'border-gray-200'
                  }`}
                  style={{ borderColor: exportFormat === 'csv' ? themeConfig.primary : undefined }}
                >
                  CSV 表格
                </button>
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-2">导出内容</div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportContent.balance}
                    onChange={(e) => setExportContent({ ...exportContent, balance: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">账户余额数据</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportContent.monthlyAttribution}
                    onChange={(e) => setExportContent({ ...exportContent, monthlyAttribution: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">月度归因记录</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportContent.yearlyAttribution}
                    onChange={(e) => setExportContent({ ...exportContent, yearlyAttribution: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">年度归因记录</span>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportDialog(false)}>
              取消
            </Button>
            <Button 
              className="text-white"
              style={{ backgroundColor: themeConfig.primary }}
              onClick={handleExport}
            >
              导出
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 导入对话框 */}
      <Dialog open={showImportDialog} onOpenChange={handleCloseImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>导入数据</DialogTitle>
          </DialogHeader>

          {/* 导入类型选择 */}
          <div className="flex gap-2 py-2">
            <Button
              variant={importType === 'balance' ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
              style={importType === 'balance' ? { backgroundColor: themeConfig.primary } : {}}
              onClick={() => setImportType('balance')}
            >
              账户余额
            </Button>
            <Button
              variant={importType === 'monthlyAttribution' ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
              style={importType === 'monthlyAttribution' ? { backgroundColor: themeConfig.primary } : {}}
              onClick={() => setImportType('monthlyAttribution')}
            >
              月度归因
            </Button>
            <Button
              variant={importType === 'yearlyAttribution' ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
              style={importType === 'yearlyAttribution' ? { backgroundColor: themeConfig.primary } : {}}
              onClick={() => setImportType('yearlyAttribution')}
            >
              年度归因
            </Button>
          </div>

          {/* 余额导入 */}
          {importType === 'balance' && (
            <>
              {/* 导入模式切换 */}
              <div className="flex gap-2 py-2">
                <Button
                  variant={importMode === 'json' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                  style={importMode === 'json' ? { backgroundColor: themeConfig.primary } : {}}
                  onClick={() => setImportMode('json')}
                >
                  <FileJson size={16} className="mr-1" />
                  JSON
                </Button>
                <Button
                  variant={importMode === 'excel' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                  style={importMode === 'excel' ? { backgroundColor: themeConfig.primary } : {}}
                  onClick={() => setImportMode('excel')}
                >
                  <FileSpreadsheet size={16} className="mr-1" />
                  CSV
                </Button>
              </div>

              {/* JSON 导入模式 */}
              {importMode === 'json' && (
                <>
                  <DialogDescription className="text-sm">
                    选择目标时间和导入方式，然后选择 JSON 文件导入
                  </DialogDescription>
                  <div className="py-4 space-y-4">
                    <div>
                      <div className="text-sm text-gray-500 mb-2">目标时间</div>
                      <div className="flex gap-2">
                        <select
                          value={importTargetYear}
                          onChange={(e) => setImportTargetYear(Number(e.target.value))}
                          className="flex-1 p-2 border rounded-lg"
                        >
                          {yearRange.map(y => <option key={y} value={y}>{y}年</option>)}
                        </select>
                        <select
                          value={importTargetMonth}
                          onChange={(e) => setImportTargetMonth(Number(e.target.value))}
                          className="flex-1 p-2 border rounded-lg"
                        >
                          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                            <option key={m} value={m}>{m}月</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500 mb-2">导入方式</div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setImportJsonMergeMode('merge')}
                          className={`flex-1 p-2 rounded-lg border text-sm ${
                            importJsonMergeMode === 'merge' ? 'border-2' : 'border-gray-200'
                          }`}
                          style={{ borderColor: importJsonMergeMode === 'merge' ? themeConfig.primary : undefined }}
                        >
                          合并记录
                        </button>
                        <button
                          onClick={() => setImportJsonMergeMode('overwrite')}
                          className={`flex-1 p-2 rounded-lg border text-sm ${
                            importJsonMergeMode === 'overwrite' ? 'border-2' : 'border-gray-200'
                          }`}
                          style={{ borderColor: importJsonMergeMode === 'overwrite' ? themeConfig.primary : undefined }}
                        >
                          覆盖记录
                        </button>
                      </div>
                    </div>
                    <div>
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleImport}
                        className="w-full"
                      />
                      {importError && (
                        <p className="text-red-500 text-sm mt-2">{importError}</p>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Excel 导入模式 */}
              {importMode === 'excel' && (
                <>
                  <DialogDescription className="text-sm">
                    上传 CSV 文件批量导入月度余额数据。表格格式：月份、账户名称、当月余额。导入后仅更新指定账户的指定月份，未填写的账户月份保持不变。
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

                    {/* 文件选择 - 仅支持 CSV */}
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleExcelFileChange}
                      className="w-full text-sm"
                    />
                    <p className="text-xs text-gray-400">支持 .csv 格式，建议使用 UTF-8 编码</p>

                    {/* Excel 数据预览 */}
                    {excelData.length > 0 && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg text-xs">
                        <div className="font-medium mb-2">预览 ({excelData.length} 条数据)</div>
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {excelData.slice(0, 5).map((row, index) => (
                            <div key={index} className="flex justify-between text-gray-600">
                              <span>{row.year}-{String(row.month).padStart(2, '0')}</span>
                              <span className="text-gray-400">{row.accountName}</span>
                              <span className="font-medium">¥{row.balance.toFixed(2)}</span>
                            </div>
                          ))}
                          {excelData.length > 5 && (
                            <div className="text-gray-400">...还有 {excelData.length - 5} 条</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 导入方式选择 */}
                    {excelData.length > 0 && (
                      <div>
                        <div className="text-sm text-gray-500 mb-2">导入方式</div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setImportExcelMergeMode('merge')}
                            className={`flex-1 p-2 rounded-lg border text-sm ${
                              importExcelMergeMode === 'merge' ? 'border-2' : 'border-gray-200'
                            }`}
                            style={{ borderColor: importExcelMergeMode === 'merge' ? themeConfig.primary : undefined }}
                          >
                            合并记录
                          </button>
                          <button
                            onClick={() => setImportExcelMergeMode('overwrite')}
                            className={`flex-1 p-2 rounded-lg border text-sm ${
                              importExcelMergeMode === 'overwrite' ? 'border-2' : 'border-gray-200'
                            }`}
                            style={{ borderColor: importExcelMergeMode === 'overwrite' ? themeConfig.primary : undefined }}
                          >
                            覆盖记录
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 错误提示 */}
                    {(excelError || importError) && (
                      <div className="text-red-500 text-sm">{excelError || importError}</div>
                    )}
                  </div>

                  <DialogFooter>
                    <Button
                      onClick={handleExcelImport}
                      disabled={excelData.length === 0}
                      className="text-white"
                      style={{ backgroundColor: themeConfig.primary }}
                    >
                      确认导入
                    </Button>
                  </DialogFooter>
                </>
              )}
            </>
          )}

          {/* 月度归因导入 */}
          {importType === 'monthlyAttribution' && (
            <div className="py-4 space-y-4">
              <DialogDescription className="text-sm">
                上传 CSV 文件导入月度归因记录。格式：年份,月份,归因标签,变动金额,变动百分比,备注
              </DialogDescription>
              
              <div>
                <div className="text-sm text-gray-500 mb-2">导入方式</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setImportAttributionMergeMode('merge')}
                    className={`flex-1 p-2 rounded-lg border text-sm ${
                      importAttributionMergeMode === 'merge' ? 'border-2' : 'border-gray-200'
                    }`}
                    style={{ borderColor: importAttributionMergeMode === 'merge' ? themeConfig.primary : undefined }}
                  >
                    合并标签
                  </button>
                  <button
                    onClick={() => setImportAttributionMergeMode('overwrite')}
                    className={`flex-1 p-2 rounded-lg border text-sm ${
                      importAttributionMergeMode === 'overwrite' ? 'border-2' : 'border-gray-200'
                    }`}
                    style={{ borderColor: importAttributionMergeMode === 'overwrite' ? themeConfig.primary : undefined }}
                  >
                    覆盖记录
                  </button>
                  <button
                    onClick={() => setImportAttributionMergeMode('skip')}
                    className={`flex-1 p-2 rounded-lg border text-sm ${
                      importAttributionMergeMode === 'skip' ? 'border-2' : 'border-gray-200'
                    }`}
                    style={{ borderColor: importAttributionMergeMode === 'skip' ? themeConfig.primary : undefined }}
                  >
                    跳过存在
                  </button>
                </div>
              </div>

              <div>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const content = event.target?.result as string;
                        const result = importMonthlyAttributionCSV(content, importAttributionMergeMode);
                        setImportError(result.message);
                      };
                      reader.readAsText(file);
                    }
                  }}
                  className="w-full"
                />
                {importError && (
                  <p className="text-sm mt-2" style={{ color: importError.includes('成功') ? themeConfig.primary : '#ef4444' }}>
                    {importError}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 年度归因导入 */}
          {importType === 'yearlyAttribution' && (
            <div className="py-4 space-y-4">
              <DialogDescription className="text-sm">
                上传 CSV 文件导入年度归因记录。格式：年份,归因标签,关键月份,变动金额,变动百分比,年末净资产,备注
              </DialogDescription>
              
              <div>
                <div className="text-sm text-gray-500 mb-2">导入方式</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setImportAttributionMergeMode('merge')}
                    className={`flex-1 p-2 rounded-lg border text-sm ${
                      importAttributionMergeMode === 'merge' ? 'border-2' : 'border-gray-200'
                    }`}
                    style={{ borderColor: importAttributionMergeMode === 'merge' ? themeConfig.primary : undefined }}
                  >
                    合并标签
                  </button>
                  <button
                    onClick={() => setImportAttributionMergeMode('overwrite')}
                    className={`flex-1 p-2 rounded-lg border text-sm ${
                      importAttributionMergeMode === 'overwrite' ? 'border-2' : 'border-gray-200'
                    }`}
                    style={{ borderColor: importAttributionMergeMode === 'overwrite' ? themeConfig.primary : undefined }}
                  >
                    覆盖记录
                  </button>
                  <button
                    onClick={() => setImportAttributionMergeMode('skip')}
                    className={`flex-1 p-2 rounded-lg border text-sm ${
                      importAttributionMergeMode === 'skip' ? 'border-2' : 'border-gray-200'
                    }`}
                    style={{ borderColor: importAttributionMergeMode === 'skip' ? themeConfig.primary : undefined }}
                  >
                    跳过存在
                  </button>
                </div>
              </div>

              <div>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const content = event.target?.result as string;
                        const result = importYearlyAttributionCSV(content, importAttributionMergeMode);
                        setImportError(result.message);
                      };
                      reader.readAsText(file);
                    }
                  }}
                  className="w-full"
                />
                {importError && (
                  <p className="text-sm mt-2" style={{ color: importError.includes('成功') ? themeConfig.primary : '#ef4444' }}>
                    {importError}
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 清空确认对话框 */}
      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>清空所有数据</DialogTitle>
            <DialogDescription>
              确定要删除所有账户和记账记录吗？此操作无法撤销，建议先导出数据备份。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClearDialog(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleClear}>
              确认清空
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 使用说明对话框 */}
      <Dialog open={showAboutDialog} onOpenChange={setShowAboutDialog}>
        <DialogContent className="max-w-md max-h-[85vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="px-5 pt-5 pb-3 flex-shrink-0">
            <DialogTitle className="text-lg font-bold tracking-tight">使用说明</DialogTitle>
          </DialogHeader>
          
          <div className="overflow-y-auto px-5 pb-5 -webkit-overflow-scrolling-touch">
            {/* 快速上手 */}
            <div className="bg-gradient-to-br from-sky-500 to-sky-600 rounded-2xl p-4 text-white mb-5">
              <div className="flex items-center gap-2 mb-3.5 font-semibold text-[15px]">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                快速上手
              </div>
              <div className="space-y-2.5">
                {[
                  '进入「账户管理」添加你的银行卡、支付宝等账户',
                  '在「月度记账」中选择月份，录入各账户余额',
                  '查看「资产趋势」和「记账记录」，追踪净资产变化',
                ].map((text, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-[13px] text-white/90 leading-relaxed">
                    <span className="w-[22px] h-[22px] rounded-full bg-white/20 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-px">
                      {i + 1}
                    </span>
                    {text}
                  </div>
                ))}
              </div>
            </div>

            {/* 核心功能 */}
            <CollapsibleSection icon="🎯" iconBg="#dbeafe" title="核心功能" defaultOpen>
              <div className="space-y-2">
                <FeatureItem emoji="💳" title="资产管理" desc="统一管理现金、银行卡、信用卡、支付宝、微信、投资等各类账户" />
                <FeatureItem emoji="📝" title="月度记账" desc="按月录入账户余额，实时追踪个人净资产变化趋势" />
                <FeatureItem emoji="📈" title="资产趋势" desc="可视化折线图展示净资产变化，支持月度/年度双视图" />
                <FeatureItem emoji="🏷️" title="月度归因" desc="记录每月资产变动原因（工资、奖金、投资等），支持自定义标签" />
                <FeatureItem emoji="📋" title="记账日志" desc="自动记录每一次余额修改，操作全程可追溯" />
              </div>
            </CollapsibleSection>

            {/* 账户类型 */}
            <CollapsibleSection icon="🏦" iconBg="#fef3c7" title="账户类型说明">
              <div className="space-y-2">
                <div className="flex items-center gap-2.5 p-2.5 bg-green-50 rounded-xl">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-green-200 text-green-800 flex-shrink-0">资产类</span>
                  <span className="text-xs text-gray-600 leading-relaxed">现金、储蓄卡、网络支付、投资 — 余额直接计入总资产</span>
                </div>
                <div className="flex items-center gap-2.5 p-2.5 bg-red-50 rounded-xl">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-red-200 text-red-800 flex-shrink-0">负债类</span>
                  <span className="text-xs text-gray-600 leading-relaxed">信用卡、借入 — 余额为欠款金额，计入负资产</span>
                </div>
                <div className="flex items-center gap-2.5 p-2.5 bg-amber-50 rounded-xl">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-200 text-amber-800 flex-shrink-0">债权类</span>
                  <span className="text-xs text-gray-600 leading-relaxed">借出 — 独立统计，不计入净资产</span>
                </div>
              </div>
            </CollapsibleSection>

            {/* 记账流程 */}
            <CollapsibleSection icon="🔄" iconBg="#fce7f3" title="记账流程">
              <div className="space-y-0 pt-1">
                <FlowStep num={1}>在<strong className="text-gray-800 font-semibold">「账户管理」</strong>中添加你的各类账户</FlowStep>
                <FlowStep num={2}>进入<strong className="text-gray-800 font-semibold">「月度记账」</strong>，选择对应月份录入各账户余额</FlowStep>
                <FlowStep num={3}>支持<strong className="text-gray-800 font-semibold">「复制上月余额」</strong>快速录入，也可单独修改单个账户</FlowStep>
                <FlowStep num={4}>资产发生较大变化时，可添加<strong className="text-gray-800 font-semibold">月度归因说明</strong></FlowStep>
                <FlowStep num={5} isLast>修改后自动保存，历史记录可在<strong className="text-gray-800 font-semibold">「记账记录」</strong>中查看</FlowStep>
              </div>
            </CollapsibleSection>

            {/* 资产趋势 */}
            <CollapsibleSection icon="📊" iconBg="#e0e7ff" title="资产趋势">
              <div className="space-y-2">
                <FeatureItem emoji="📉" title="净资产变化折线图" desc="直观展示财务状况，支持高低点自动标注" />
                <FeatureItem emoji="🔍" title="归因筛选" desc="按标签筛选，快速定位特定变动月份" />
                <FeatureItem emoji="👆" title="数据点交互" desc="点击数据点查看当月账户快照和归因详情" />
                <FeatureItem emoji="🔀" title="双视图切换" desc="支持月度趋势和年度趋势两种视图模式" />
              </div>
            </CollapsibleSection>

            {/* 数据导入导出 */}
            <CollapsibleSection icon="💾" iconBg="#ffedd5" title="数据导入与导出">
              <div className="grid grid-cols-2 gap-2">
                <DataCard icon="📦" title="JSON 备份" desc="完整备份恢复，跨设备迁移" />
                <DataCard icon="📑" title="CSV 导出" desc="分类导出数据，便于表格查看" />
                <DataCard icon="📥" title="CSV 导入" desc="按类型单独导入余额/归因/年度" />
                <DataCard icon="🗑️" title="清空数据" desc="一键清除全部，操作前请备份" />
              </div>
              <p className="mt-3 text-xs text-gray-500 leading-relaxed">
                <strong>CSV 模板字段：</strong>月份、账户名称、余额、归因标签（可选）、备注（可选）
              </p>
            </CollapsibleSection>

            {/* 隐私安全 */}
            <div className="bg-gradient-to-br from-emerald-50 to-green-100 border border-emerald-200 rounded-2xl p-4 flex gap-3 items-start mb-5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center text-lg flex-shrink-0">
                🔒
              </div>
              <div>
                <h4 className="text-sm font-bold text-emerald-800 mb-1">隐私与安全</h4>
                <p className="text-xs text-emerald-700 leading-relaxed">
                  本应用为纯本地运行，无需联网，所有数据仅存储在您的设备中。建议定期导出备份，避免数据意外丢失。
                </p>
              </div>
            </div>

            {/* 公众号二维码 */}
            <div className="pt-4 border-t border-gray-100 text-center mb-4">
              <p className="text-sm font-semibold text-gray-700 mb-1">关于作者</p>
              <p className="text-xs text-gray-500 mb-3">出品人：Frank · 公众号：Frank技术</p>
              <div className="w-36 h-36 bg-gray-100 rounded-xl mx-auto overflow-hidden flex items-center justify-center">
                <img
                  src="/qrcode.png"
                  alt="Frank技术公众号"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="144" height="144"%3E%3Crect fill="%23f3f4f6" width="144" height="144"/%3E%3Ctext fill="%236b7280" font-size="12" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EFrank技术%3C/text%3E%3C/svg%3E';
                  }}
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-2">扫码关注公众号</p>
            </div>

            {/* 底部品牌 */}
            <div className="text-center pt-3 border-t border-gray-100">
              <div className="text-[13px] font-semibold text-gray-700 mb-0.5">Easy Ledger</div>
              <div className="text-xs text-gray-400">当前版本 1.0.2 · 出品人 Frank</div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 导出成功 - 复制数据对话框（Android 备选方案） */}
      <Dialog open={showExportSuccess} onOpenChange={setShowExportSuccess}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>数据导出成功</DialogTitle>
            <DialogDescription>
              请复制下方 JSON 数据并保存到文件
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="relative">
              <textarea
                ref={exportTextareaRef}
                value={exportedData}
                readOnly
                className="w-full h-48 p-3 text-xs font-mono bg-gray-50 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Button
                size="sm"
                className="absolute top-2 right-2"
                style={{ backgroundColor: copied ? '#10b981' : themeConfig.primary }}
                onClick={handleCopyToClipboard}
              >
                {copied ? (
                  <>
                    <Check size={14} className="mr-1" />
                    已复制
                  </>
                ) : (
                  <>
                    <Copy size={14} className="mr-1" />
                    复制
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              提示：点击"复制"按钮后，可将数据粘贴到文件管理器或备忘录中保存为 .json 文件
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowExportSuccess(false)}>
              完成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
