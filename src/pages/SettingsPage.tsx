import { useState, useEffect } from 'react';
import { ArrowLeft, Download, Upload, Trash2, Info, FileText, Palette } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { PageRoute, ThemeType } from '@/types';
import { exportDataByRange, importData, clearAllData, getSettings, updateSettings } from '@/lib/storage';
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
  
  // 导出设置
  const [exportStartYear, setExportStartYear] = useState(new Date().getFullYear());
  const [exportStartMonth, setExportStartMonth] = useState(new Date().getMonth() + 1);
  const [exportEndYear, setExportEndYear] = useState(new Date().getFullYear());
  const [exportEndMonth, setExportEndMonth] = useState(new Date().getMonth() + 1);
  
  // 导入设置
  const [importTargetYear, setImportTargetYear] = useState(new Date().getFullYear());
  const [importTargetMonth, setImportTargetMonth] = useState(new Date().getMonth() + 1);
  const [importMergeMode, setImportMergeMode] = useState<'overwrite' | 'merge'>('merge');

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

  const handleExport = () => {
    const data = exportDataByRange(exportStartYear, exportStartMonth, exportEndYear, exportEndMonth);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `记账数据_${exportStartYear}${exportStartMonth.toString().padStart(2, '0')}-${exportEndYear}${exportEndMonth.toString().padStart(2, '0')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportDialog(false);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setImportError('');
    
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        if (importData(content, importTargetYear, importTargetMonth, importMergeMode)) {
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

  const handleClear = () => {
    clearAllData();
    setShowClearDialog(false);
    alert('所有数据已清空');
    window.location.reload();
  };

  const themeConfig = THEMES[theme];

  return (
    <div className="pb-6 bg-gray-50 min-h-screen">
      {/* 标题栏 */}
      <header className="bg-white px-4 py-3 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => onPageChange('home')}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-lg font-semibold">设置</h1>
        </div>
      </header>

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
                    <div className="text-xs text-gray-400">当前版本 2.4.0</div>
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
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>导入数据</DialogTitle>
            <DialogDescription>
              选择目标时间和导入方式
            </DialogDescription>
          </DialogHeader>
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
                  onClick={() => setImportMergeMode('merge')}
                  className={`flex-1 p-2 rounded-lg border text-sm ${
                    importMergeMode === 'merge' ? 'border-2' : 'border-gray-200'
                  }`}
                  style={{ borderColor: importMergeMode === 'merge' ? themeConfig.primary : undefined }}
                >
                  合并记录
                </button>
                <button
                  onClick={() => setImportMergeMode('overwrite')}
                  className={`flex-1 p-2 rounded-lg border text-sm ${
                    importMergeMode === 'overwrite' ? 'border-2' : 'border-gray-200'
                  }`}
                  style={{ borderColor: importMergeMode === 'overwrite' ? themeConfig.primary : undefined }}
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>
              取消
            </Button>
          </DialogFooter>
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
              <h3 className="font-medium mb-2 text-blue-700">🎯 核心功能</h3>
              <ul className="text-gray-600 space-y-1 list-disc list-inside">
                <li><b>资产管理</b>：统一管理现金、银行卡、信用卡、支付宝、微信、投资等各类账户</li>
                <li><b>月度记账</b>：按月录入账户余额，实时追踪个人净资产变化</li>
                <li><b>年度汇总</b>：查看年度资产数据，清晰掌握整体财务趋势</li>
                <li><b>记账日志</b>：自动记录每一次余额修改，操作全程可追溯</li>
              </ul>
            </div>

            {/* 账户类型说明 */}
            <div>
              <h3 className="font-medium mb-2">💳 账户类型说明</h3>
              <div className="text-gray-600 space-y-1">
                <p><b>资产类</b>（现金、储蓄卡、网络支付、投资）：余额直接计入总资产</p>
                <p><b>负债类</b>（信用卡、借入）：余额为欠款金额，计入负资产</p>
                <p><b>债权类</b>（借出）：独立统计，不计入净资产</p>
              </div>
            </div>

            {/* 记账流程 */}
            <div>
              <h3 className="font-medium mb-2">📝 记账流程</h3>
              <ol className="text-gray-600 space-y-1 list-decimal list-inside">
                <li>在「账户管理」中添加你的账户</li>
                <li>进入「月度记账」，选择对应月份，录入各账户余额</li>
                <li>支持「复制上月余额」快速录入，也可单独修改单个账户</li>
                <li>修改后自动保存，历史记录可在「记账记录」中查看</li>
              </ol>
            </div>

            {/* 数据导入与导出 */}
            <div>
              <h3 className="font-medium mb-2">💾 数据导入与导出</h3>
              <div className="text-gray-600 space-y-1">
                <p><b>导出数据</b>：选择时间范围，将数据备份为 JSON 文件</p>
                <p><b>导入数据</b>：选择备份文件，支持合并或覆盖现有数据</p>
                <p><b>清空数据</b>：一键清除全部数据，操作前请务必完成备份</p>
              </div>
            </div>

            {/* 隐私与安全 */}
            <div className="bg-green-50 p-3 rounded-lg">
              <h3 className="font-medium mb-1 text-green-700">🔒 隐私与安全</h3>
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
    </div>
  );
}
