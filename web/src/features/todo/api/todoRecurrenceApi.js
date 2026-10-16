import api from "../../../shared/api/axiosInstance.js";

export const fetchRecurrence = (todoId) => api.get(`/todos/${todoId}/recurrence`);
export const upsertRecurrence = (todoId, data) => api.put(`/todos/${todoId}/recurrence`, data);
