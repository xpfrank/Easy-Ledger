import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export function isNativePlatform(): boolean {
  return typeof (window as any).Capacitor !== 'undefined' && 
         (window as any).Capacitor.isNativePlatform?.() === true;
}

export function isAndroid(): boolean {
  return isNativePlatform() && (window as any).Capacitor.getPlatform() === 'android';
}

/**
 * 保存文件到设备：Android/iOS 使用 Capacitor Filesystem + Share，浏览器使用标准下载
 */
export async function saveFileToDevice(
  data: string,
  fileName: string,
  mimeType: string
): Promise<{ success: boolean; message: string; data?: string }> {
  try {
    if (isNativePlatform()) {
      await Filesystem.writeFile({
        path: `EasyLedger/${fileName}`,
        data: data,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
        recursive: true,
      });
      const filePath = `Documents/EasyLedger/${fileName}`;
      await Share.share({
        title: '导出记账数据',
        text: fileName,
        url: `file://${filePath}`,
        dialogTitle: '保存或分享文件',
      });
      return { success: true, message: `文件已保存到 ${filePath}` };
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