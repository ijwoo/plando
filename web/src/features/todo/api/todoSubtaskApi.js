import api from "../../../shared/api/axiosInstance.js";

/**
 * 서브태스크(parentId 기반 실제 할 일) API.
 *
 * 백엔드 계약(모바일 앱과 동일):
 *  - 각 todo에 parentId(number|null), subtaskTotal, subtaskDone 포함(GET /todos)
 *  - GET /todos/{id}/subtasks → 자식 todo 배열
 *  - 생성/토글/삭제는 기존 todoApi 재사용(addTodo({..., parentId}), updateTodoStatus, deleteTodo)
 *
 * 정책: 깊이 1단계(서브태스크는 자식을 못 가짐), 부모 삭제 시 자식은 최상위로 승격, 완료 전파 없음.
 */
export const fetchSubtasks = (todoId) => api.get(`/todos/${todoId}/subtasks`);
