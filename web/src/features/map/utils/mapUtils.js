import { statusColor } from "../../../shared/ui/tone.js";

export const FILTERS = [
    { key: "todo", label: "할 일", status: "TODO" },
    { key: "in_progress", label: "진행 중", status: "IN_PROGRESS" },
    { key: "done", label: "완료", status: "DONE" },
    { key: "all", label: "전체" },
    { key: "mine", label: "내 할 일" },
];

/** 실제 Todo status 기반 Chip color */
export function statusChipColor(status) {
    switch (status) {
        case "TODO":        return "error";
        case "IN_PROGRESS": return "warning";
        case "DONE":        return "success";
        default:            return "default";
    }
}

/** 지도 마커 색상 — 앱 전체 상태 색(tone.js statusColor) 단일 소스 사용 */
export function getTaskMarkerColor(theme, status) {
    return statusColor(theme, status);
}

/** 날짜 포맷 */
export function formatDueDate(date) {
    if (!date) return "날짜 없음";
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return `마감 ${date}`;
        const month = d.getMonth() + 1;
        const day = d.getDate();
        return `마감 ${month}월 ${day}일`;
    } catch {
        return `마감 ${date}`;
    }
}
