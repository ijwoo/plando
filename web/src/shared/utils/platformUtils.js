import { Capacitor } from "@capacitor/core";

export const isAndroid = /Android/i.test(navigator.userAgent);
export const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
export const isNative = Capacitor.isNativePlatform();
export const isMobile = isAndroid || isIOS;
