import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

export function isNativePlatform(): boolean {
  return typeof (window as any).Capacitor !== 'undefined' && 
         (window as any).Capacitor.isNativePlatform?.() === true;
}

export function isAndroid(): boolean {
  return isNativePlatform() && (window as any).Capacitor.getPlatform() === 'android';
}

/**
 * 保存文件到设备：Android/iOS 使用 Capacitor Filesystem，浏览器使用标准下载
 */
export async function saveFileToDevice(
  data: string,
  fileName: string,
  mimeType: string
): Promise<{ success: boolean; message: string }> {
  try {
    if (isNativePlatform()) {
      await Filesystem.writeFile({
        path: `EasyLedger/${fileName}`,
        data: data,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
        recursive: true,
      });
      return { success: true, message: `文件已保存到 Documents/EasyLedger/${fileName}` };
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
    return { success: false, message: `保存失败: ${error.message || '未知错误'}` };
  }
}
