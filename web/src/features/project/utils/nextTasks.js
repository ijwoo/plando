import { isTodoDone } from "../../../shared/utils/todoStatus.js";

/** 우선순위 정렬 가중치 — 값이 없으면 가장 뒤로. */
const PRIORITY_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 };

/**
 * 프로젝트 개요의 "다음 할 일" 단일 소스 (데스크탑 ProjectsPage / 모바일 ProjectDetailPage 공용).
 *
 * 규칙: 미완료만 남기고 → 마감 임박 → 우선순위 순으로 상위 limit개.
 * - 완료 판정은 커스텀 상태를 포함하는 isTodoDone() 기준 (status === "DONE" 비교 금지).
 * - 마감일이 있는 할 일이 없는 할 일보다 항상 앞.
 */
export function selectNextTasks(todos, limit = 5) {
    if (!Array.isArray(todos)) return [];
    return todos
        .filter((t) => !isTodoDone(t))
        .sort((a, b) => {
            if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
            if (a.dueDate && !b.dueDate) return -1;
            if (!a.dueDate && b.dueDate) return 1;
            return (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3);
        })
        .slice(0, limit);
}
