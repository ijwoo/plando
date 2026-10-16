import { alpha } from "@mui/material/styles";

/**
 * 상태·우선순위 색의 단일 소스.
 *
 * RN 모바일 앱(`mobile/src/shared/ui/tone.ts`)이 디자인 원본이며 여기서 그대로 미러한다.
 * 모바일과 동일하게 색 해석은 딱 세 가지만 노출한다 —
 *   statusColor(theme, status) / priorityColor(theme, priority) / readableOn(hex)
 *
 * ── theme.palette 기반인 이유 (CSS var 대신) ──────────────────────────
 * 1) `alpha(color, 0.12)` 같은 파생이 필요하다. 이 파일의 소비처 대부분이 soft 배경을
 *    alpha로 만드는데 `var(--plando-red)`는 alpha()에 넣을 수 없다.
 * 2) sx 밖의 소비처(카카오 지도 마커 SVG, 캔버스, 차트)는 CSS 변수를 못 읽는다.
 * 3) readableOn()이 실제 hex를 요구한다.
 * palette.error/warning/success.main 값은 --plando-red/orange/green과 동일한 hex라
 * 기존 화면의 색은 그대로다. primary만 테마별로 달라지는데(모바일 theme.primary와 동일),
 * 이는 의도된 모바일 미러링이다.
 *
 * ※ HIGH(우선순위)와 TODO(상태)가 같은 red 토큰을 공유하는 건 의도된 것이다.
 */

/** 외부 브랜드 고정 색상 */
export const BRAND_COLOR = {
    KAKAO: "#FEE500",
};

export const STATUSES = ["TODO", "IN_PROGRESS", "DONE"];

export const PRIORITIES = ["HIGH", "MEDIUM", "LOW"];

export const STATUS_OPTIONS = [
    { value: "TODO", label: "할 일" },
    { value: "IN_PROGRESS", label: "진행 중" },
    { value: "DONE", label: "완료" },
];

export const PRIORITY_OPTIONS = [
    { value: "HIGH", label: "높음" },
    { value: "MEDIUM", label: "중간" },
    { value: "LOW", label: "낮음" },
];

export const STATUS_LABEL = {
    TODO: "할 일",
    IN_PROGRESS: "진행 중",
    DONE: "완료",
};

export const PRIORITY_LABEL = {
    HIGH: "높음",
    MEDIUM: "중간",
    LOW: "낮음",
};

export function getStatusLabel(status) {
    return STATUS_LABEL[status] ?? status ?? "-";
}

export function getPriorityLabel(priority) {
    return PRIORITY_LABEL[priority] ?? priority ?? "-";
}

/**
 * 상태별 색 — IN_PROGRESS=주황 / DONE=초록 / 그 외(TODO·미지정·알 수 없는 키)=빨강.
 * 워크스페이스 커스텀 상태는 StatusContext의 colorOf(key)가 우선이고, 정의된 색이 없을 때
 * 이 함수가 폴백이 된다(모바일과 동일하게 danger로 수렴).
 */
export function statusColor(theme, status) {
    if (status === "IN_PROGRESS") return theme.palette.warning.main;
    if (status === "DONE") return theme.palette.success.main;
    return theme.palette.error.main; // TODO(또는 미지정)
}

/** 우선순위별 색 — HIGH=빨강 / MEDIUM=주황 / 그 외(LOW·미지정)=테마 primary. */
export function priorityColor(theme, priority) {
    if (priority === "HIGH") return theme.palette.error.main;
    if (priority === "MEDIUM") return theme.palette.warning.main;
    return theme.palette.primary.main; // LOW(또는 미지정)
}

/**
 * 채움색 위 soft 배경/보더 파생. 커스텀 상태의 임의 hex에도 그대로 쓸 수 있게
 * base color를 인자로 받는다. (다크는 조금 더 진하게)
 */
export function softOn(theme, color, ratio = 1) {
    const isDark = theme.palette.mode === "dark";
    try {
        return alpha(color, (isDark ? 0.20 : 0.12) * ratio);
    } catch {
        return "transparent";
    }
}

/**
 * 채움색 위에 올릴 가독 텍스트 색(#fff 또는 진한 회색)을 색의 밝기로 결정.
 * 밝은 토큰(예: dark primary #8AB4F8) 위의 흰 텍스트는 대비가 부족하다.
 */
export function readableOn(hex) {
    const raw = String(hex ?? "").trim().replace("#", "");
    const n = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
    const r = parseInt(n.slice(0, 2), 16);
    const g = parseInt(n.slice(2, 4), 16);
    const b = parseInt(n.slice(4, 6), 16);
    if ([r, g, b].some((v) => Number.isNaN(v))) return "#fff";
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.62 ? "#1A1A1A" : "#fff";
}
