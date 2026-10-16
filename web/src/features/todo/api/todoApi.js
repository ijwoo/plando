import api from "../../../shared/api/axiosInstance.js";
import { APP_EVENTS } from "../../../shared/constants/events.js";

export const fetchTodos = () => api.get("/todos");

// 현재 워크스페이스의 할 일을 CSV(바이너리)로 받아온다. X-Workspace-Id는 인터셉터가 첨부.
export const exportTodosCsv = () => api.get("/todos/export", { responseType: "blob" });

export const addTodo = (todo) => api.post("/todos", todo);

// 삭제 후 TODO_DELETED 전파 — 대시보드/사이드바 카운트·지도·위젯·"최근 본 항목" 등 구독자 일괄 갱신.
// (호출처가 9곳으로 흩어져 있어 API 한 곳에서 전파하는 것이 누락 없이 안전)
export const deleteTodo = async (id) => {
    const res = await api.delete(`/todos/${id}`);
    try { window.dispatchEvent(new CustomEvent(APP_EVENTS.TODO_DELETED, { detail: { id } })); } catch { /* ignore */ }
    return res;
};

export const updateTodoStatus = (id, newStatus) =>
    api.put(`/todos/${id}/status`, { status: newStatus });

export const updateTodoPriority = (id, priority) =>
    api.patch(`/todos/${id}/priority`, { priority });

export const updateTodoFocus = (id, focused) =>
    api.patch(`/todos/${id}/focus`, { focused: !!focused });

export const getTodoById = (id) => api.get(`/todos/${id}`);

export const updateTodoField = (id, field, value) =>
    api.patch(`/todos/${id}`, { field, value });

export const fetchTodoLogs = (todoId) =>
    api.get(`/todos/${todoId}/logs`);

export const fetchArchivedTodos = () => api.get("/todos/archived");
export const archiveTodo = (id) => api.patch(`/todos/${id}/archive`);
export const restoreTodo = (id) => api.patch(`/todos/${id}/restore`);
export const archiveDoneTodos = () => api.post("/todos/archive-done");

// 반복 일정 변경 전파: scope = "ALL" | "THIS_AND_FOLLOWING"
export const propagateRecurrenceChange = (id, scope, field, value) =>
    api.post(`/todos/${id}/recurrence-propagate`, { scope, field, value });