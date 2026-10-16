import api from "../../../shared/api/axiosInstance.js";

export const getMyWorkspaces = async () => {
    const res = await api.get("/workspaces/my");
    return res.data;
};

export const createWorkspace = async (payload) => {
    const res = await api.post("/workspaces", payload);
    return res.data;
};

export const joinWorkspace = async (payload) => {
    const res = await api.post("/workspaces/join", payload);
    return res.data;
};

export const deleteWorkspace = async (workspaceId) => {
    await api.delete(`/workspaces/${workspaceId}`);
};

export const updateWorkspace = async (workspaceId, payload) => {
    const res = await api.patch(`/workspaces/${workspaceId}`, payload);
    return res.data;
};

export const leaveWorkspace = async (workspaceId) => {
    await api.delete(`/workspaces/${workspaceId}/leave`);
};

export const transferOwner = async (workspaceId, targetUserId) => {
    await api.patch(`/workspaces/${workspaceId}/transfer-owner`, { targetUserId });
};

export const checkHasRecruitments = async (workspaceId) => {
    const res = await api.get(`/workspaces/${workspaceId}/has-recruitments`);
    return res.data.hasRecruitments;
};

export const uploadWorkspaceIcon = async (workspaceId, file) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await api.post(`/workspaces/${workspaceId}/icon`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
};
