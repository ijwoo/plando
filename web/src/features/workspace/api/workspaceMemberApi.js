import api from "../../../shared/api/axiosInstance.js";

export const getWorkspaceMembers = async (workspaceId) => {
    const res = await api.get(`/workspaces/${workspaceId}/members`);
    return res.data; // [{ userId, name, email, profileImageUrl, role }]
};

/** 멤버 역할 변경 (ADMIN 이상). role: "ADMIN"|"MEMBER"|"VIEWER" */
export const changeMemberRole = (workspaceId, userId, role) =>
    api.patch(`/workspaces/${workspaceId}/members/${userId}/role`, { role });

/** 멤버 내보내기 (ADMIN 이상, 대상보다 상위 역할). */
export const removeMember = (workspaceId, userId) =>
    api.delete(`/workspaces/${workspaceId}/members/${userId}`);
