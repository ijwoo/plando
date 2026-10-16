export { formatTimeAgo, isSameDay } from "../../../shared/utils/formatters.js";
import { statusColor } from "../../../shared/ui/tone.js";
import { weekdayHeader } from "../../calendar/utils/weekStart.js";

/**
 * 표시 순서대로의 요일 라벨 (일~토 고정).
 * 각 항목: { label, weekday } — weekday는 실제 요일 인덱스(0=일~6=토)라 색 판정에 사용.
 */
export { weekdayHeader };

export const FIELD_LABEL = {
    title: "제목",
    content: "내용",
    priority: "우선순위",
    dueDate: "마감일",
    assignees: "담당자",
    assignee: "담당자",
    startAt: "시작일",
    status: "상태",
};

// 유의미한 필드만 표시 (content·null 제외)
const MEANINGFUL_FIELDS = new Set(["status", "assignees", "assignee", "priority", "dueDate", "startAt", "title"]);

const FIELD_PRIORITY = { status: 0, assignees: 1, assignee: 1, priority: 2, dueDate: 3, startAt: 4, title: 5 };

/**
 * 최근 활동 목록에서 노이즈를 제거하고 의미있는 항목만 반환.
 * - content 수정, field 없는 항목 제외
 * - 같은 (todoId, field) 조합은 최신 1개만 유지
 * - 유의미도 순으로 정렬 후 최대 limit개 반환
 */
export function filterActivities(activities, limit = 5) {
    if (!Array.isArray(activities)) return [];

    // 1. 유의미한 필드만
    const filtered = activities.filter((a) => a.field && MEANINGFUL_FIELDS.has(a.field));

    // 2. (todoId, field) 기준 중복 제거 — API는 최신순 정렬을 가정
    const seen = new Set();
    const deduped = [];
    for (const a of filtered) {
        const key = `${a.todoId}__${a.field}`;
        if (!seen.has(key)) {
            seen.add(key);
            deduped.push(a);
        }
    }

    // 3. 유의미도 우선, 같으면 최신순
    deduped.sort((a, b) => {
        const pa = FIELD_PRIORITY[a.field] ?? 99;
        const pb = FIELD_PRIORITY[b.field] ?? 99;
        if (pa !== pb) return pa - pb;
        return new Date(b.modifiedAt) - new Date(a.modifiedAt);
    });

    return deduped.slice(0, limit);
}

/** baseDate가 속한 주(일~토)의 7일. */
export function getWeekDates(baseDate) {
    const offset = baseDate.getDay();
    const first = new Date(baseDate);
    first.setDate(baseDate.getDate() - offset);
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(first);
        d.setDate(first.getDate() + i);
        return d;
    });
}

/**
 * 이번 주(일~토) 범위. 백엔드 주간 리포트(WrapService)와 같은 일요일 시작 기준.
 * 대시보드 통계(weekly 지표·memberStats)와 period-tasks 조회 범위 계산에 공용.
 */
export function getThisWeekRange(now = new Date()) {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
}

/** 지난주 범위 (이번 주 시작 직전 7일). */
export function getLastWeekRange(now = new Date()) {
    const { start: thisStart } = getThisWeekRange(now);
    const end = new Date(thisStart);
    end.setDate(thisStart.getDate() - 1);
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return { start, end };
}

export function formatDueDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d)) return "";
    return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** 시간대별 인사. Desktop/Mobile 대시보드 공용. */
export function getGreeting(date = new Date()) {
    const h = date.getHours();
    if (h < 6) return "좋은 새벽이에요";
    if (h < 12) return "좋은 아침이에요";
    if (h < 18) return "좋은 오후에요";
    return "좋은 저녁이에요";
}

/** 멤버 완료율(0~100) → 시각화 색상. Desktop/Mobile 멤버 현황 공용. */
export function getRateColor(rate) {
    if (rate >= 80) return "#00C48C";
    if (rate >= 60) return "#3D7BFF";
    if (rate >= 40) return "#F59E0B";
    return "#F43F5E";
}

/** 일정 리스트 좌측 accent 색 — tone.js 단일 소스. */
export function getStatusScheduleAccent(theme, status) {
    return statusColor(theme, status);
}


export function formatModifierName(modifier) {
    if (!modifier) return "누군가";
    if (modifier.includes("@")) return modifier.split("@")[0];
    return modifier;
}
