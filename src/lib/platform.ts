export function isNativePlatform(): boolean {
  return typeof (window as any).Capacitor !== 'undefined' && 
         (window as any).Capacitor.isNativePlatform?.() === true;
}

export function isAndroid(): boolean {
  return isNativePlatform() && (window as any).Capacitor.getPlatform() === 'android';
}