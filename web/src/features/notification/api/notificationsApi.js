import api from "../../../shared/api/axiosInstance.js";


export const fetchNotifications = async () => {
    return await api.get("/notifications");
};

/** Dashboard PriorityStack용 — type 필터로 알림 조회. */
export const fetchNotificationsByTypes = async (types, limit) => {
    return await api.get("/notifications/by-types", {
        params: { types: types.join(","), ...(limit ? { limit } : {}) },
    });
};

export const fetchUnreadNotificationCount = async () => {
    return await api.get("/notifications/unread-count");
};

export const markNotificationAsRead = async (id) => {
    return await api.patch(`/notifications/${id}/read`,{});
};

export const markAllNotificationsAsRead = async () => {
    return await api.patch("/notifications/read-all", {});
};

export const fetchRecruitmentNotifications = async () => {
    return await api.get("/notifications/recruitment");
};

export const fetchRecruitmentUnreadCount = async () => {
    return await api.get("/notifications/recruitment/unread-count");
};

export const markAllRecruitmentNotificationsAsRead = async () => {
    return await api.patch("/notifications/recruitment/read-all", {});
};

export const registerApnsToken = async (deviceToken) => {
    return await api.post("/notifications/push/ios/register", { deviceToken });
};

export const unregisterApnsToken = async (deviceToken) => {
    return await api.delete("/notifications/push/ios/unregister", { data: { deviceToken } });
};