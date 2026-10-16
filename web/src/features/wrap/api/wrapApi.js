import api from "../../../shared/api/axiosInstance.js";

/**
 * 주간 회고 카드 조회.
 * @param {string|null} weekStart - "YYYY-MM-DD" 또는 null (이번 주)
 * @param {boolean} refresh - true 면 AI 한마디 캐시 무시하고 새로 생성
 * @returns {Promise<AxiosResponse<WrapResponse>>}
 */
export const getWeeklyWrap = (weekStart = null, refresh = false, persona = null) => {
    const params = {};
    if (weekStart) params.weekStart = weekStart;
    if (refresh) params.refresh = true;
    if (persona) params.persona = persona;
    return api.get("/wrap/weekly", { params });
};

/**
 * 셀프 메모 저장 (upsert). content 빈 문자열이면 삭제.
 * @param {string} content
 * @param {string|null} weekStart - "YYYY-MM-DD" 또는 null (이번 주)
 */
export const saveWrapSelfMemo = (content, weekStart = null) =>
    api.put("/wrap/weekly/memo", { content, weekStart });

/**
 * 회고 히스토리 — 최근 N주차 brief 리스트.
 */
export const getWrapHistory = (weeks = 12) =>
    api.get("/wrap/history", { params: { weeks } });
