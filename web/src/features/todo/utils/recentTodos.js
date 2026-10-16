/**
 * 최근 본 할 일 기록 (검색 빈 화면의 "최근 본 항목"용 — ClickUp Recents 패턴).
 * useOpenTodoDetail(상세 열기 중앙 진입점)에서 기록 → 보드/캘린더/검색 어디서 열든 쌓인다.
 * 할 일은 워크스페이스 종속이므로 키도 워크스페이스별 — 다른 워크스페이스의 항목이 섞이면
 * 탭 시 "찾을 수 없음" 오류가 난다.
 */
import { APP_EVENTS } from "../../../shared/constants/events.js";

const KEY_PREFIX = "plando.recentTodos";
const MAX = 6;

// axios 인터셉터와 동일한 소스에서 현재 워크스페이스를 읽는다 (컨텍스트 의존 없이)
const key = () => `${KEY_PREFIX}.${localStorage.getItem("currentWorkspaceId") ?? "none"}`;

// 최근 목록 변경을 구독자(대시보드 카드 등)에게 알림 — localStorage 쓰기는 이벤트가 없으므로 직접 발행
const notifyChanged = () => {
    try { window.dispatchEvent(new Event(APP_EVENTS.RECENT_TODOS_CHANGED)); } catch { /* ignore */ }
};

export function loadRecentTodos() {
    try {
        const raw = JSON.parse(localStorage.getItem(key()));
        return Array.isArray(raw) ? raw.filter((x) => x && x.id != null && x.title) : [];
    } catch { return []; }
}

export function recordRecentTodo(todo) {
    if (!todo?.id || !todo?.title) return;
    try {
        const next = [
            { id: todo.id, title: todo.title, status: todo.status ?? null },
            ...loadRecentTodos().filter((x) => x.id !== todo.id),
        ].slice(0, MAX);
        localStorage.setItem(key(), JSON.stringify(next));
        notifyChanged();
    } catch { /* ignore */ }
}

/** 열기 실패(삭제됨 등) 항목 제거용 */
export function removeRecentTodo(id) {
    try {
        const next = loadRecentTodos().filter((x) => x.id !== id);
        localStorage.setItem(key(), JSON.stringify(next));
        notifyChanged();
    } catch { /* ignore */ }
}

// 할 일 삭제 전파(TODO_DELETED)를 받아 "최근 본 항목"에서도 즉시 제거.
// (모듈 로드 시 1회 등록 — recentTodos는 검색/대시보드에서 import되어 앱 부팅 시 활성화됨)
try {
    window.addEventListener(APP_EVENTS.TODO_DELETED, (e) => {
        const id = e?.detail?.id;
        if (id != null) removeRecentTodo(id);
    });
} catch { /* ignore */ }
