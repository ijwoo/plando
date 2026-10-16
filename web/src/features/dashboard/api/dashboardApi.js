import api from "../../../shared/api/axiosInstance.js";

export const fetchRecentTasks = () => {
    return api.get('/dashboard/recent-tasks');
};

export const fetchTodayTodos = () => {
    return api.get('/dashboard/today-todos');
};

export const fetchHighPriorityTasks = () => {
    return api.get(`/dashboard/high-priority`);
};

export const fetchOverdueTasks = async () => {
    return await api.get("/dashboard/overdue");
};

export const fetchInProgressTasks = () => {
    return api.get("/dashboard/in-progress");
};

export const fetchDashboardStats = () => {
    return api.get("/dashboard/stats");
};

export const fetchRecentActivity = () => {
    return api.get("/dashboard/recent-activity");
};

/**
 * 기간 + dueDate 기반 통계 데이터. archived 무관.
 * weekly completion rate / weekly bar / member stats 계산용.
 * @param {string} from YYYY-MM-DD
 * @param {string} to   YYYY-MM-DD
 */
export const fetchPeriodTasks = (from, to) => {
    return api.get("/dashboard/period-tasks", { params: { from, to } });
};