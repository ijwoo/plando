
/**
 * 이메일 동일인 판정 — 서버(PermissionService.isSameUser)가 equalsIgnoreCase 라서
 * 여기서도 대소문자를 무시한다. 대문자가 섞인 계정("Kim@x.com")으로 로그인하면
 * "나에게 배정"·"내가 만든" 필터가 자기 할 일을 하나도 못 찾아 빈 목록이 됐다.
 * (workspace/hooks/useWorkspacePermissions.js의 sameEmail과 같은 규칙 — feature 경계를
 *  넘어 권한 훅을 끌어오지 않으려고 여기 같은 규칙의 로컬 헬퍼를 둔다)
 */
const sameEmail = (a, b) => !!a && !!b && String(a).toLowerCase() === String(b).toLowerCase();

export const TODO_FILTERS = {
    ALL: "ALL",
    ASSIGNED_TO_ME: "ASSIGNED_TO_ME",
    CREATED_BY_ME: "CREATED_BY_ME",
    UNASSIGNED: "UNASSIGNED",
};

export const DATE_FILTERS = {
    TODAY: "TODAY",
    TOMORROW: "TOMORROW",
    THIS_WEEK: "THIS_WEEK",
};

export function filterTodosByView(todos, filterKey, myEmail) {
    if (!Array.isArray(todos)) return [];

    switch (filterKey) {
        case TODO_FILTERS.ASSIGNED_TO_ME:
            return todos.filter((todo) =>
                Array.isArray(todo.assignees) &&
                todo.assignees.some((a) =>
                    sameEmail(typeof a === "string" ? a : a?.email, myEmail)
                )
            );

        case TODO_FILTERS.CREATED_BY_ME:
            return todos.filter((todo) => sameEmail(todo.userEmail, myEmail));

        case TODO_FILTERS.UNASSIGNED:
            return todos.filter(
                (todo) => !Array.isArray(todo.assignees) || todo.assignees.length === 0
            );

        case TODO_FILTERS.ALL:
        default:
            return todos;
    }
}

/**
 * "YYYY-MM-DD"(뒤에 시각이 붙어 있어도 무방) → 그 날의 **로컬** 자정 Date.
 *
 * new Date("2026-07-22")는 ISO date-only라 UTC 자정으로 파싱된다. 로컬 자정과 비교하면
 * UTC 오프셋이 음수인 기기(미주 등)에서 하루가 밀린다 — 그래서 반드시 이 헬퍼로 파싱한다.
 */
export function toDateOnly(ymd) {
    if (!ymd) return null;
    const d = new Date(`${String(ymd).slice(0, 10)}T00:00:00`);
    return isNaN(d.getTime()) ? null : d;
}

/** 오늘의 로컬 자정. */
function startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

/**
 * 마감일까지 남은 일수(로컬 자정 기준). 음수면 지연, 0이면 오늘. 날짜가 없으면 null.
 */
export function daysUntilDue(dueDate) {
    const due = toDateOnly(dueDate);
    if (!due) return null;
    return Math.round((due - startOfToday()) / 86400000);
}

/**
 * 마감일이 오늘보다 이전인지 = "지연" 판정 단일 소스.
 * 예전엔 `new Date(t.dueDate) < new Date(new Date().toDateString())` 이었는데,
 * 좌변은 UTC 자정 / 우변은 로컬 자정이라 음수 오프셋 기기에서 "오늘 마감"이 지연으로 세어졌다.
 */
export function isOverdueDate(dueDate) {
    const d = daysUntilDue(dueDate);
    return d !== null && d < 0;
}

/**
 * todo의 일정 범위(startAt~dueDate)가 [from, to] 범위와 겹치는지.
 * MobileListView 등에서 그룹핑(오늘/내일/이번주)에 재사용.
 */
export function isInRange(todo, from, to) {
    const start = toDateOnly(todo.startAt);
    const due = toDateOnly(todo.dueDate);
    if (!start && !due) return false;
    const s = start ?? due;
    const e = due ?? start;
    // 일정 범위와 필터 범위가 겹치는지 확인
    return s <= to && e >= from;
}

export function filterTodosByRecurrence(todos, recurringOnly) {
    if (!recurringOnly) return todos;
    return todos.filter((t) => t.hasRecurrence || t.recurrenceSourceId != null);
}

export function filterTodosByDate(todos, dateFilter) {
    if (!dateFilter) return todos;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (dateFilter === DATE_FILTERS.TODAY) {
        const end = new Date(today);
        end.setHours(23, 59, 59, 999);
        return todos.filter((t) => isInRange(t, today, end));
    }

    if (dateFilter === DATE_FILTERS.TOMORROW) {
        const tmrStart = new Date(today);
        tmrStart.setDate(today.getDate() + 1);
        const tmrEnd = new Date(tmrStart);
        tmrEnd.setHours(23, 59, 59, 999);
        return todos.filter((t) => isInRange(t, tmrStart, tmrEnd));
    }

    if (dateFilter === DATE_FILTERS.THIS_WEEK) {
        // 주는 일요일 시작 — 대시보드 주간 통계와 동일 기준
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        return todos.filter((t) => isInRange(t, weekStart, weekEnd));
    }

    return todos;
}