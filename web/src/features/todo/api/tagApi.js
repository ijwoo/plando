import api from "../../../shared/api/axiosInstance.js";

/** 태그(라벨) API. 조회=멤버, 생성·수정=MEMBER+, 삭제=ADMIN+. 할 일 부착=편집 권한. */

export const fetchTags = () => api.get("/tags").then((res) => res.data);

export const createTag = ({ name, color }) =>
    api.post("/tags", { name, color }).then((res) => res.data);

export const updateTag = (id, { name, color }) =>
    api.patch(`/tags/${id}`, { name, color }).then((res) => res.data);

export const deleteTag = (id) => api.delete(`/tags/${id}`);

/** 할 일의 태그 전체 교체. tagIds: number[] → 반영된 태그 목록 반환 */
export const setTodoTags = (todoId, tagIds) =>
    api.put(`/todos/${todoId}/tags`, { tagIds }).then((res) => res.data);
