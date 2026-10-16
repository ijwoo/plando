import api from "../../../shared/api/axiosInstance.js";

export const fetchTemplates = (workspaceId) =>
    api.get(`/workspaces/${workspaceId}/templates`);

export const createTemplate = (workspaceId, payload) =>
    api.post(`/workspaces/${workspaceId}/templates`, payload);

export const updateTemplate = (workspaceId, id, payload) =>
    api.put(`/workspaces/${workspaceId}/templates/${id}`, payload);

export const deleteTemplate = (workspaceId, id) =>
    api.delete(`/workspaces/${workspaceId}/templates/${id}`);
