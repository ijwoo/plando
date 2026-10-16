import api from "../../../shared/api/axiosInstance.js";

export const fetchDmRooms = () => api.get("/dm/rooms");

export const getOrCreateRoom = (partnerId) =>
    api.post("/dm/rooms", { partnerId });

export const createGroupRoom = (groupName, memberIds) =>
    api.post("/dm/rooms/group", { groupName, memberIds });

// 페이지네이션 — before(메시지 id) 이전 size개. before 없으면 최신 size개. (항상 시간 오름차순 반환)
export const fetchMessages = (roomId, { before, size = 30 } = {}) => {
    const params = { size };
    if (before != null) params.before = before;
    return api.get(`/dm/rooms/${roomId}/messages`, { params });
};

// 텍스트 메시지 전송 (REST) — 응답으로 저장된 메시지 반환. 낙관적 UI 정합용.
export const sendDmMessage = (roomId, { content, tag = null, linkedTodoId = null, replyToId = null }) =>
    api.post(`/dm/rooms/${roomId}/messages`, { content, tag, linkedTodoId, replyToId });

// 대화 내 검색 — 내용 매칭 메시지(최신순)
export const searchDmMessages = (roomId, q) =>
    api.get(`/dm/rooms/${roomId}/search`, { params: { q } });

export const markAsRead = (roomId) =>
    api.post(`/dm/rooms/${roomId}/read`);

export const fetchPartnerProfile = (roomId) =>
    api.get(`/dm/rooms/${roomId}/partner-profile`);

export const inviteToGroupRoom = (roomId, memberIds) =>
    api.post(`/dm/rooms/${roomId}/invite`, { memberIds });

export const uploadDmFile = (roomId, formData) =>
    api.post(`/dm/rooms/${roomId}/send-file`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
    });

export const deleteDmMessage = (roomId, messageId) =>
    api.delete(`/dm/rooms/${roomId}/messages/${messageId}`);

export const updateDmMessage = (roomId, messageId, content) =>
    api.patch(`/dm/rooms/${roomId}/messages/${messageId}`, { content });

export const toggleDmReaction = (roomId, messageId, emoji) =>
    api.post(`/dm/rooms/${roomId}/messages/${messageId}/reactions`, { emoji });

export const setDmNotice = (roomId, messageId, pinned) =>
    api.patch(`/dm/rooms/${roomId}/messages/${messageId}/notice`, { pinned });
