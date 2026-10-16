import api from "../../../shared/api/axiosInstance.js";

/** 공개 Q&A 목록 조회 (핀 우선 → 최신순) — 게스트 포함 누구나 가능 */
export const fetchQuestions = (recruitmentId) =>
    api.get(`/recruitments/${recruitmentId}/questions`);

/**
 * 질문 등록 — non-guest, 본인 모집글 X.
 * @param {boolean} isPrivate true면 비공개 — 작성자/질문자만 본문 조회 가능
 */
export const postQuestion = (recruitmentId, body, isPrivate = false) =>
    api.post(`/recruitments/${recruitmentId}/questions`, { body, isPrivate });

/** 질문 숨김(soft delete) — asker 본인 또는 모집 작성자 */
export const deleteQuestion = (recruitmentId, qId) =>
    api.delete(`/recruitments/${recruitmentId}/questions/${qId}`);

/** 답변 등록/수정 (upsert) — 모집 작성자만 */
export const upsertAnswer = (recruitmentId, qId, body) =>
    api.put(`/recruitments/${recruitmentId}/questions/${qId}/answer`, { body });

/** 답변 삭제 — 모집 작성자만, idempotent */
export const deleteAnswer = (recruitmentId, qId) =>
    api.delete(`/recruitments/${recruitmentId}/questions/${qId}/answer`);

/** 핀 토글 — 모집 작성자만 */
export const pinQuestion = (recruitmentId, qId, pinned) =>
    api.patch(`/recruitments/${recruitmentId}/questions/${qId}/pin`, { pinned });

/** 작성자 Q&A 응답 통계 — public, 비로그인 OK */
export const fetchUserQaStats = (userId) =>
    api.get(`/users/${userId}/qa-stats`);
