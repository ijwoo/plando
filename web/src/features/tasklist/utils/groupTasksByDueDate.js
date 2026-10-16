import { toDateFromYmd } from "../../calendar/utils/calendarUtils.js";
import { isTodoDone } from "../../../shared/utils/todoStatus.js";

/**
 * 시간대 기반 할 일 그룹화 (Desktop TaskList Phase 13).
 *
 * 그룹:
 * - urgent: 오늘 마감 + 지난 일정 (status !== DONE)
 * - week:   이번 주 (오늘 제외, 일요일까지) + 미완료
 * - later:  다음 주 이후 + 미완료
 * - done:   완료 전체 (기본 collapsed 상태라 노출 부담 적음)
 * - noDue:  마감일 없음 + 미완료 (옵션)
 */
const GROUP_ORDER = ["urgent", "week", "later", "noDue", "done"];

export function groupTasksByDueDate(tasks) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 주 시작은 앱 전체가 일요일 고정 (대시보드 통계·캘린더·주간 탭·백엔드 Wrap과 동일 기준)
    const dayOfWeek = today.getDay(); // 일=0
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() + (6 - dayOfWeek));
    weekEnd.setHours(23, 59, 59, 999);

    const groups = { urgent: [], week: [], later: [], noDue: [], done: [] };

    for (const t of tasks ?? []) {
        if (isTodoDone(t)) {
            groups.done.push(t);
            continue;
        }
        if (!t.dueDate) {
            groups.noDue.push(t);
            continue;
        }
        const due = toDateFromYmd(t.dueDate);
        if (due <= today) groups.urgent.push(t);
        else if (due <= weekEnd) groups.week.push(t);
        else groups.later.push(t);
    }

    // 각 그룹 내부 정렬: dueDate asc → priority desc
    const priorityRank = (p) => (p === "HIGH" ? 0 : p === "MEDIUM" ? 1 : p === "LOW" ? 2 : 3);
    for (const key of Object.keys(groups)) {
        groups[key].sort((a, b) => {
            const ad = a.dueDate ? toDateFromYmd(a.dueDate).getTime() : Infinity;
            const bd = b.dueDate ? toDateFromYmd(b.dueDate).getTime() : Infinity;
            if (ad !== bd) return ad - bd;
            return priorityRank(a.priority) - priorityRank(b.priority);
        });
    }

    return GROUP_ORDER.map((id) => ({ id, tasks: groups[id] })).filter((g) => g.tasks.length > 0);
}

/** 그룹별 메타 (제목/부제목/색상). */
export function getGroupMeta(id, today = new Date()) {
    switch (id) {
        case "urgent":
            return { title: "오늘 · 지난 일정", sub: "지금 처리할 것", color: "var(--plando-red)" };
        case "week": {
            const dayOfWeek = (today.getDay() + 6) % 7;
            const start = new Date(today);
            start.setDate(today.getDate() + (dayOfWeek === 0 ? 1 : 0)); // 오늘 다음날부터
            const end = new Date(today);
            end.setDate(today.getDate() + (6 - dayOfWeek));
            const range = `${start.getMonth() + 1}월 ${start.getDate()}일 – ${end.getDate()}일`;
            return { title: "이번 주", sub: range, color: "var(--plando-primary)" };
        }
        case "later":
            return { title: "다음 주 이후", sub: "예정", color: "var(--plando-purple)" };
        case "noDue":
            return { title: "마감일 없음", sub: "정리 필요", color: "var(--plando-gray)" };
        case "done":
            return { title: "완료", sub: "전체", color: "var(--plando-green)" };
        default:
            return { title: id, sub: null, color: "var(--plando-gray)" };
    }
}

// formatRelativeDue / formatAbsoluteDue는 shared/utils/formatters.js로 이전됨 (Phase 14)
