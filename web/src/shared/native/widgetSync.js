import { Capacitor } from "@capacitor/core";
import WidgetBridge from "./widgetBridge.js";
import { isIOS } from "../utils/platformUtils.js";

/**
 * iOS 위젯과의 데이터 동기화 헬퍼.
 *
 * - 비 iOS / 비 native 환경에서는 모든 함수가 no-op (안전).
 * - 외부에서 todo 배열을 받아 "오늘 task" 만 필터/정렬/포맷 후 native bridge 로 push.
 * - 이 모듈만 위젯의 데이터 형태(WidgetTodo) 를 알고 있어야 함 — 다른 모듈은 raw todo 만 넘기면 됨.
 */

const isWidgetAvailable = () => isIOS && Capacitor.isNativePlatform();

/* ─────────────────────────────────────────────────
 * 시간 / dDay 유틸
 * ───────────────────────────────────────────────── */

function startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

function endOfToday() {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
}

function isToday(dateStr) {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return false;
    return d >= startOfToday() && d <= endOfToday();
}

function isAddedToday(todo) {
    const created = todo.createdAt || todo.created_at;
    if (!created) return false;
    return isToday(created);
}

/** D-day 라벨. 음수(이미 지남)는 "D+N", 0 은 "D-day", 양수는 "D-N". */
function computeDDay(dateStr) {
    if (!dateStr) return null;
    const due = new Date(dateStr);
    if (Number.isNaN(due.getTime())) return null;
    due.setHours(0, 0, 0, 0);
    const today = startOfToday();
    const diff = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return "D-day";
    if (diff > 0) return `D-${diff}`;
    return `D+${Math.abs(diff)}`;
}

/* ─────────────────────────────────────────────────
 * 오늘 task 필터 / 정렬 / 매핑
 * ───────────────────────────────────────────────── */

/**
 * "오늘 task" 정의 (위젯 미리보기 사양과 동일):
 *   - dueDate 가 오늘  OR
 *   - 오늘 추가됐고 status=TODO
 */
function isTodayTodo(todo) {
    if (!todo) return false;
    const due = todo.dueDate || todo.due_date;
    if (isToday(due)) return true;
    const status = String(todo.status || "").toUpperCase();
    if (status === "TODO" && isAddedToday(todo)) return true;
    return false;
}

const PRIORITY_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 };

/**
 * 정렬: featured/starred 우선 → dueDate 가까운 순 → 우선순위 HIGH→LOW.
 * 위젯 디자인(SmallWidgetView/MediumWidgetView) 의 표시 순서와 일치.
 */
function compareTodos(a, b) {
    const aStar = !!(a.focused || a.starred || a.featured);
    const bStar = !!(b.focused || b.starred || b.featured);
    if (aStar !== bStar) return aStar ? -1 : 1;

    const aDue = a.dueDate || a.due_date;
    const bDue = b.dueDate || b.due_date;
    if (aDue && bDue) {
        const diff = new Date(aDue).getTime() - new Date(bDue).getTime();
        if (diff !== 0) return diff;
    } else if (aDue) {
        return -1;
    } else if (bDue) {
        return 1;
    }

    const aP = PRIORITY_ORDER[String(a.priority || "").toUpperCase()] ?? 99;
    const bP = PRIORITY_ORDER[String(b.priority || "").toUpperCase()] ?? 99;
    return aP - bP;
}

/** Plando todo → WidgetTodo (Swift 모델과 키 매칭). */
function mapToWidgetTodo(t) {
    const pid = t.projectId ?? t.project_id;
    return {
        id: Number(t.id) || 0,
        title: String(t.title || ""),
        priority: String(t.priority || "LOW").toUpperCase(),
        status: String(t.status || "TODO").toUpperCase(),
        starred: !!(t.focused || t.starred || t.featured),
        dueDate: t.dueDate || t.due_date || null,
        dDay: computeDDay(t.dueDate || t.due_date),
        // 달력 위젯 카테고리 색 재현용 — 미리보기 catOf 와 동일 규칙(projectId ?? id)
        projectId: pid != null ? Number(pid) : null,
    };
}

/* ─────────────────────────────────────────────────
 * Public API
 * ───────────────────────────────────────────────── */

/**
 * 오늘 task 를 위젯 표시용으로 필터/정렬/포맷 (순수 함수 — 미리보기/push 공용).
 * @returns {{ todos: Array, total: number, done: number }}
 */
export function buildWidgetData(allTodos) {
    if (!Array.isArray(allTodos)) return { todos: [], total: 0, done: 0 };
    const today = allTodos.filter(isTodayTodo);
    const sorted = [...today].sort(compareTodos);
    const todos = sorted.slice(0, 10).map(mapToWidgetTodo);
    const total = today.length;
    const done = today.filter((t) => String(t.status || "").toUpperCase() === "DONE").length;
    return { todos, total, done };
}

/**
 * 달력 위젯(주간/월간)용 데이터 — 현재 월 ±7일 범위의 dueDate 일정만 추려 매핑.
 * (순수 함수 — 미리보기/push 공용. 주간 위젯은 현재 주, 월간 위젯은 현재 달만 쓰므로
 *  이 범위면 양쪽 모두 커버.)
 * @returns {{ calendarTodos: Array }}
 */
export function buildCalendarWidgetData(allTodos) {
    if (!Array.isArray(allTodos)) return { calendarTodos: [] };
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    start.setDate(start.getDate() - 7);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    end.setDate(end.getDate() + 7);
    end.setHours(23, 59, 59, 999);

    const dated = allTodos.filter((t) => {
        const raw = t.dueDate || t.due_date;
        if (!raw) return false;
        const d = new Date(raw);
        if (Number.isNaN(d.getTime())) return false;
        return d >= start && d <= end;
    });
    dated.sort((a, b) => new Date(a.dueDate || a.due_date) - new Date(b.dueDate || b.due_date));
    const calendarTodos = dated.slice(0, 60).map(mapToWidgetTodo);
    return { calendarTodos };
}

/**
 * 오늘 task + 달력 일정을 필터/정렬/포맷해서 iOS 위젯에 push.
 * 비 iOS 환경에서는 no-op.
 *
 * @param {Array} allTodos  현재 워크스페이스의 모든 todo 배열 (status / dueDate / starred 포함)
 * @param {string|null} workspaceName  워크스페이스 이름 (위젯에 표시 가능, v1 미사용)
 */
export async function pushTodayTodosToWidget(allTodos, workspaceName = null) {
    if (!isWidgetAvailable()) return;
    if (!Array.isArray(allTodos)) return;

    const { todos: top10, total, done } = buildWidgetData(allTodos);
    const { calendarTodos } = buildCalendarWidgetData(allTodos);

    try {
        await WidgetBridge.updateTodos({
            todos: top10,
            total,
            done,
            calendarTodos,
            workspaceName: workspaceName || null,
        });
    } catch (e) {
        console.warn("[widget] updateTodos 실패:", e);
    }
}

/**
 * 로그인 상태 토글 + 인터랙티브 위젯(체크박스)에서 백엔드 호출에 쓸 토큰/워크스페이스/apiBase 전달.
 */
export async function setWidgetLoggedIn(value, options = {}) {
    if (!isWidgetAvailable()) return;
    const payload = { value: !!value };
    if (value) {
        const token = options.token
            ?? localStorage.getItem("accessToken")
            ?? sessionStorage.getItem("accessToken")
            ?? null;
        const workspaceId = options.workspaceId ?? localStorage.getItem("currentWorkspaceId") ?? null;
        const apiBase = options.apiBase ?? import.meta.env.VITE_API_BASE_URL ?? null;
        if (token) payload.token = token;
        if (workspaceId) payload.workspaceId = String(workspaceId);
        if (apiBase) payload.apiBase = apiBase;
    }
    try {
        await WidgetBridge.setLoggedIn(payload);
    } catch (e) {
        console.warn("[widget] setLoggedIn 실패:", e);
    }
}

/**
 * 로그아웃 시 호출. payload + 로그인 상태 모두 정리 + 위젯 새로고침.
 */
export async function clearWidget() {
    if (!isWidgetAvailable()) return;
    try {
        await WidgetBridge.clear({});
    } catch (e) {
        console.warn("[widget] clear 실패:", e);
    }
}
