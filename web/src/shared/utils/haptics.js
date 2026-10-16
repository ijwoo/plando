import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { isNative } from "./platformUtils.js";

const safeImpact = async (style) => {
    if (!isNative) return;
    try { await Haptics.impact({ style }); } catch { /* 무시 */ }
};

export const hapticLight  = () => safeImpact(ImpactStyle.Light);
export const hapticMedium = () => safeImpact(ImpactStyle.Medium);
export const hapticHeavy  = () => safeImpact(ImpactStyle.Heavy);
