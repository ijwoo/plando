import { darken } from "@mui/material/styles";

/**
 * 앱 캔버스(크롬) 배경색 — 본문 카드 뒤/사이드바/네비바가 공유하는 바탕.
 * Layout / Sidebar / SidebarIconRail / Navbar 공용 (단일 source).
 *
 * 라이트: 페이지 배경을 그냥 darken 하면 칙칙한 회색이 됨 → 살짝 쿨 슬레이트로 섞어
 *         깔끔한 캔버스 톤을 만든다. 다크: 기존처럼 더 어둡게.
 */
function hexToRgb(hex) {
    const m = String(hex).replace("#", "").match(/.{2}/g);
    return m && m.length >= 3 ? m.slice(0, 3).map((x) => parseInt(x, 16)) : null;
}
function mix(hex, target, amt) {
    const a = hexToRgb(hex);
    const b = hexToRgb(target);
    if (!a || !b) return null;
    const r = a.map((v, i) => Math.round(v + (b[i] - v) * amt));
    return `#${r.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export function getCanvasBg(theme) {
    const base = theme.palette.background.default;
    if (theme.palette.mode === "dark") return darken(base, 0.5);
    // 라이트: 중립 라이트그레이(#EEEEEE)와 섞어 화이트에 가까운 깔끔한 소프트 캔버스. hex가 아니면 약한 darken 폴백.
    return mix(base, "#EEEEEE", 0.3) ?? darken(base, 0.035);
}
