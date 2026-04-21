import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Download, Upload, Trash2, Info, FileText, Palette, Check, Copy, FileSpreadsheet, FileJson } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { PageRoute, ThemeType } from '@/types';
import type { ExcelImportRow } from '@/lib/storage';
import { exportDataByRange, importData, clearAllData, getSettings, updateSettings, parseExcelCSV, batchImportFromExcel, exportExcelTemplate, hasGarbledText, exportToCSV, exportMonthlyAttributionCSV, exportYearlyAttributionCSV, importMonthlyAttributionCSV, importYearlyAttributionCSV } from '@/lib/storage';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { THEMES } from '@/types';

interface SettingsPageProps {
  onPageChange: (page: PageRoute, params?: any) => void;
}

export function SettingsPage({ onPageChange }: SettingsPageProps) {
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showAboutDialog, setShowAboutDialog] = useState(false);
  const [showThemeDialog, setShowThemeDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
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

  const currentYear = new Date().getFullYear();
  const yearRange = Array.from({ length: 21 }, (_, i) => currentYear - 10 + i);

  useEffect(() => {
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

      <div className="p-4 space-y-4">
        {/* 主题皮肤 */}
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-gray-500 px-1">个性化</h2>
          <Card className="bg-white overflow-hidden">
            <button 
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
              onClick={() => setShowThemeDialog(true)}
            >
              <div className="flex items-center gap-3">
                <div 
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${themeConfig.primary}15` }}
                >
                  <Palette size={18} style={{ color: themeConfig.primary }} />
                </div>
                <div className="text-left">
                  <div className="font-medium text-sm">主题皮肤</div>
                  <div className="text-xs text-gray-400">当前：{themeConfig.name}</div>
                </div>
              </div>
            </button>
          </Card>
        </div>

        {/* 数据管理 */}
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-gray-500 px-1">数据管理</h2>
          <Card className="bg-white overflow-hidden">
            <div className="divide-y divide-gray-100">
              <button 
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
                onClick={() => setShowExportDialog(true)}
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${themeConfig.primary}15` }}
                  >
                    <Download size={18} style={{ color: themeConfig.primary }} />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-sm">导出数据</div>
                    <div className="text-xs text-gray-400">按时间范围导出</div>
                  </div>
                </div>
              </button>
              
              <button 
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
                onClick={() => setShowImportDialog(true)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Upload size={18} className="text-blue-500" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-sm">导入数据</div>
                    <div className="text-xs text-gray-400">选择目标时间导入</div>
                  </div>
                </div>
              </button>
              
              <button 
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
                onClick={() => setShowClearDialog(true)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center">
                    <Trash2 size={18} className="text-red-500" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-sm text-red-500">清空所有数据</div>
                    <div className="text-xs text-gray-400">删除所有账户和记录</div>
                  </div>
                </div>
              </button>
            </div>
          </Card>
        </div>

        {/* 关于 */}
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-gray-500 px-1">关于</h2>
          <Card className="bg-white overflow-hidden">
            <div className="divide-y divide-gray-100">
              <button 
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
                onClick={() => setShowAboutDialog(true)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                    <Info size={18} className="text-gray-500" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-sm">使用说明</div>
                    <div className="text-xs text-gray-400">了解如何使用本应用</div>
                  </div>
                </div>
              </button>
              
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                    <FileText size={18} className="text-gray-500" />
                  </div>
                  <div>
                    <div className="font-medium text-sm">应用版本</div>
                    <div className="text-xs text-gray-400">当前版本 1.0.2</div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* 主题选择对话框 */}
      <Dialog open={showThemeDialog} onOpenChange={setShowThemeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>选择主题</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="grid grid-cols-1 gap-3">
              {(Object.keys(THEMES) as ThemeType[]).map((themeKey) => {
                const config = THEMES[themeKey];
                return (
                  <button
                    key={themeKey}
                    onClick={() => handleThemeChange(themeKey)}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                      theme === themeKey ? 'border-2' : 'border-gray-200 hover:border-gray-300'
                    }`}
                    style={{ borderColor: theme === themeKey ? config.primary : undefined }}
                  >
                    <div 
                      className="w-10 h-10 rounded-lg"
                      style={{ background: `linear-gradient(135deg, ${config.gradientFrom} 0%, ${config.gradientTo} 100%)` }}
                    />
                    <div className="flex-1 text-left">
                      <div className="font-medium">{config.name}</div>
                    </div>
                    {theme === themeKey && (
                      <div 
                        className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs"
                        style={{ backgroundColor: config.primary }}
                      >
                        ✓
                      </div>
                    )}
                  </button>
                );
              })}
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
                              <span>{row.month}</span>
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
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>使用说明</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4 text-sm">
            {/* 核心功能 */}
            <div className="bg-blue-50 p-3 rounded-lg">
              <h3 className="font-medium mb-2 text-blue-700">核心功能</h3>
              <ul className="text-gray-600 space-y-1 list-disc list-inside">
                <li><b>资产管理</b>：统一管理现金、银行卡、信用卡、支付宝、微信、投资等各类账户</li>
                <li><b>月度记账</b>：按月录入账户余额，实时追踪个人净资产变化</li>
                <li><b>资产趋势</b>：可视化展示净资产变化趋势，支持月度/年度视图</li>
                <li><b>月度归因</b>：记录每月资产变动原因（工资、奖金、投资等）</li>
                <li><b>记账日志</b>：自动记录每一次余额修改，操作全程可追溯</li>
              </ul>
            </div>

            {/* 账户类型说明 */}
            <div>
              <h3 className="font-medium mb-2">账户类型说明</h3>
              <div className="text-gray-600 space-y-1">
                <p><b>资产类</b>（现金、储蓄卡、网络支付、投资）：余额直接计入总资产</p>
                <p><b>负债类</b>（信用卡、借入）：余额为欠款金额，计入负资产</p>
                <p><b>债权类</b>（借出）：独立统计，不计入净资产</p>
              </div>
            </div>

            {/* 记账流程 */}
            <div>
              <h3 className="font-medium mb-2">记账流程</h3>
              <ol className="text-gray-600 space-y-1 list-decimal list-inside">
                <li>在「账户管理」中添加你的账户</li>
                <li>进入「月度记账」，选择对应月份，录入各账户余额</li>
                <li>支持「复制上月余额」快速录入，也可单独修改单个账户</li>
                <li>资产发生较大变化时，可添加月度归因说明</li>
                <li>修改后自动保存，历史记录可在「记账记录」中查看</li>
              </ol>
            </div>

            {/* 资产趋势说明 */}
            <div>
              <h3 className="font-medium mb-2">资产趋势</h3>
              <div className="text-gray-600 space-y-1">
                <p>进入「资产趋势」页面，可查看：</p>
                <ul className="list-disc list-inside ml-2">
                  <li>净资产变化折线图，直观展示财务状况</li>
                  <li>支持筛选标签，快速定位特定变动月份</li>
                  <li>点击数据点查看当月账户快照</li>
                  <li>支持月度趋势和年度趋势两种视图</li>
                </ul>
              </div>
            </div>

            {/* 数据导入与导出 */}
            <div>
              <h3 className="font-medium mb-2">数据导入与导出</h3>
              <div className="text-gray-600 space-y-1">
                <p><b>JSON 导出/导入</b>：完整备份恢复，数据可跨设备迁移</p>
                <p><b>CSV 批量导入</b>：支持表格批量导入账户余额</p>
                <p><b>CSV 模板字段</b>：月份、账户名称、余额、归因标签(可选)、备注(可选)</p>
                <p><b>清空数据</b>：一键清除全部数据，操作前请务必完成备份</p>
              </div>
            </div>

            {/* 隐私与安全 */}
            <div className="bg-green-50 p-3 rounded-lg">
              <h3 className="font-medium mb-1 text-green-700">隐私与安全</h3>
              <p className="text-gray-600">
                本应用为纯本地运行，无需联网，所有数据仅存储在您的设备中。建议定期导出备份，避免数据意外丢失。
              </p>
            </div>
            
            {/* 公众号二维码 */}
            <div className="pt-4 border-t">
              <h3 className="font-medium mb-3">关于作者</h3>
              <div className="flex flex-col items-center">
                <p className="text-gray-600 mb-2">出品人：Frank</p>
                <p className="text-gray-600 mb-3">公众号：Frank技术</p>
                <div className="w-40 h-40 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                  <img 
                    src="/qrcode.png" 
                    alt="Frank技术公众号" 
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="160" height="160"%3E%3Crect fill="%23f3f4f6" width="160" height="160"/%3E%3Ctext fill="%236b7280" font-size="14" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EFrank技术%3C/text%3E%3C/svg%3E';
                    }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-2">扫码关注公众号</p>
              </div>
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
