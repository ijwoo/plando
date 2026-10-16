import api from "../../../shared/api/axiosInstance.js";

/** 모집 목록 조회
 *  tab: "browse" | "mine" | "applied"
 *  search: 검색 키워드 (선택)
 */
export const fetchRecruitments = (tab = "browse", search = "") => {
    const params = { tab };
    if (search) params.search = search;
    return api.get("/recruitments", { params });
};

/** 모집 상세 조회 (조회수 증가 포함) */
export const fetchRecruitmentDetail = (id) =>
    api.get(`/recruitments/${id}`);

/** 모집글 생성 */
export const createRecruitment = (data) =>
    api.post("/recruitments", data);

/** 모집글 수정 */
export const updateRecruitment = (id, data) =>
    api.put(`/recruitments/${id}`, data);

/** 모집글 삭제 */
export const deleteRecruitment = (id) =>
    api.delete(`/recruitments/${id}`);

/** 상태 변경 (모집중 / 모집완료 / 진행중) */
export const updateRecruitmentStatus = (id, status) =>
    api.patch(`/recruitments/${id}/status`, { status });

/**
 * 지원 신청 / 취소 토글.
 * @param {number} id 모집글 id
 * @param {string} message 팀장에게 전할 메시지
 * @param {number|null} roleId 선택한 역할 id — 신청 시에만 의미 (취소 호출 시 무시됨)
 */
export const toggleApply = (id, message = "", roleId = null) =>
    api.post(`/recruitments/${id}/apply`, { message, roleId });

/** 북마크 토글 */
export const toggleBookmark = (id) =>
    api.post(`/recruitments/${id}/bookmark`);

/** 체크리스트 항목 토글 */
export const toggleChecklist = (recruitmentId, checklistId) =>
    api.patch(`/recruitments/${recruitmentId}/checklist/${checklistId}`);

/** 신청자 목록 조회 (작성자 전용) */
export const fetchApplications = (recruitmentId) =>
    api.get(`/recruitments/${recruitmentId}/applications`);

/** 신청 수락 또는 거절 (작성자 전용) */
export const reviewApplication = (recruitmentId, appId, action) =>
    api.patch(`/recruitments/${recruitmentId}/applications/${appId}`, { action });
