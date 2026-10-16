import api from "../../../shared/api/axiosInstance.js";

export const fetchAttachments = (todoId) =>
    api.get(`/todos/${todoId}/attachments`);

export const uploadAttachment = (todoId, file) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post(`/todos/${todoId}/attachments`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
    });
};

export const deleteAttachment = (todoId, attachId) =>
    api.delete(`/todos/${todoId}/attachments/${attachId}`);
