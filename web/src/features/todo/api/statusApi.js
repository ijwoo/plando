import api from "../../../shared/api/axiosInstance.js";

/** 워크플로우 상태(커스텀 상태) API. 조회=멤버, 관리=ADMIN+. */

export const fetchStatuses = () => api.get("/statuses").then((res) => res.data);

export const createStatus = ({ label, category, color }) =>
    api.post("/statuses", { label, category, color }).then((res) => res.data);

export const updateStatus = (id, { label, category, color }) =>
    api.patch(`/statuses/${id}`, { label, category, color }).then((res) => res.data);

export const deleteStatus = (id, reassignTo) =>
    api.delete(`/statuses/${id}`, { params: reassignTo ? { reassignTo } : {} });

export const reorderStatuses = (orderedIds) =>
    api.patch("/statuses/reorder", { orderedIds });

export const setDefaultStatus = (id) => api.patch(`/statuses/${id}/default`);
