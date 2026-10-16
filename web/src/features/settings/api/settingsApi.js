import api from "../../../shared/api/axiosInstance.js";

export const getMySettings = () => {
    return api.get("/settings/me");
};

export const updateMySettings = (payload) => {
    return api.put("/settings/me", payload);
};

export const markTutorialSeen = (pageKey) => {
    const fieldMap = {
        dashboard: "dashboardTutorialSeen",
        todo: "todoTutorialSeen",
        tasklist: "tasklistTutorialSeen",
        calendar: "calendarTutorialSeen",
    };

    const fieldName = fieldMap[pageKey];
    if (!fieldName) {
        throw new Error(`Unknown tutorial page key: ${pageKey}`);
    }

    return updateMySettings({
        [fieldName]: true,
    });
};