import api from "../../../shared/api/axiosInstance.js";

/** 위치가 등록된 Todo 목록 조회 */
export const fetchLocationTodos = () => api.get("/todos/location");

/** Todo 위치 정보 저장/수정 */
export const updateTodoLocation = (id, location) =>
    api.patch(`/todos/${id}/location`, location);

/** Todo 위치 정보 삭제 */
export const deleteTodoLocation = (id) =>
    api.delete(`/todos/${id}/location`);
