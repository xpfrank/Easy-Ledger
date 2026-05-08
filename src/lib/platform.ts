import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export function isNativePlatform(): boolean {
  return typeof (window as any).Capacitor !== 'undefined' && 
         (window as any).Capacitor.isNativePlatform?.() === true;
}

export function isAndroid(): boolean {
  return isNativePlatform() && (window as any).Capacitor.getPlatform() === 'android';
}

export async function saveFileToDevice(
  data: string,
  fileName: string,
  mimeType: string
): Promise<{ success: boolean; message: string; data?: string }> {
  try {
    if (isNativePlatform()) {
      const filePath = `EasyLedger/${fileName}`;
      await Filesystem.writeFile({
        path: filePath,
        data: data,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
        recursive: true,
      });

      const uri = await Filesystem.getUri({
        path: filePath,
        directory: Directory.Documents,
      });

      await Share.share({
        title: '导出记账数据',
        text: `EasyLedger 导出文件: ${fileName}`,
        url: uri.uri,
      });

      return { success: true, message: '文件已保存，可通过分享选择保存位置' };
    } else {
      const blob = new Blob([data], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      return { success: true, message: '文件已下载' };
    }
  } catch (error: any) {
    console.error('Save file failed:', error);
    return { success: false, message: `保存失败: ${error.message || '未知错误'}`, data };
  }
}