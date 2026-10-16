import React, { useCallback } from "react";
import { APP_EVENTS } from "../../../shared/constants/events.js";
import { deleteTodo, getTodoById } from "../api/todoApi.js";
import { recordRecentTodo } from "../utils/recentTodos.js";
import { useLayout } from "../../../layouts/LayoutContext.jsx";
import TodoDetailPanel from "../components/detail/TodoDetailPanel.jsx";

export function useOpenTodoDetail() {
    const { openDetail, clearDetail } = useLayout();

    // 성공 여부 반환 — 호출부가 실패 시 후처리(최근 본 항목에서 제거 등) 할 수 있게
    const openTodoDetail = useCallback(
        async (id, { onDelete, onPatchLocal, onRestore } = {}) => {
            try {
                const res = await getTodoById(id);
                recordRecentTodo(res.data);
                openDetail(
                    <TodoDetailPanel
                        todo={res.data}
                        onClose={clearDetail}
                        /* onDelete를 안 넘긴 호출부(검색·알림·DM·사이드바 등)에서는 삭제가
                           조용히 no-op이면서 "삭제됐어요." 토스트만 떴다. 기본 동작을 준다 —
                           deleteTodo가 내부에서 TODO_DELETED를 전파하므로 목록·카운트도 따라 갱신된다.
                           호출부가 직접 넘긴 onDelete가 있으면 그쪽을 우선한다(낙관 갱신 등). */
                        onDelete={onDelete ?? ((todoId) => deleteTodo(todoId))}
                        onPatchLocal={onPatchLocal}
                        onRestore={onRestore}
                        showClose
                    />
                );
                return true;
            } catch (e) {
                console.error("상세 불러오기 실패", e);
                window.dispatchEvent(new CustomEvent(APP_EVENTS.APP_TOAST, {
                    detail: { message: "할 일을 불러오지 못했어요.", severity: "error" },
                }));
                return false;
            }
        },
        [openDetail, clearDetail]
    );

    return openTodoDetail;
}
