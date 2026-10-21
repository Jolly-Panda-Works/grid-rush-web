export const isNative = (): boolean =>
  !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
/** Phones/tablets (touch as primary input) and the Android app. Mobile play is portrait-only; desktop adapts to the window. */
export const isMobile = (): boolean => isNative() || (typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches);
