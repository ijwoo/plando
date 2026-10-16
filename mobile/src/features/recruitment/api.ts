import { api } from '@/api/client';
import type { Schemas } from '@/api/types';

export type RecruitmentListItem = Schemas['RecruitmentListResponse'];
export type RecruitmentDetail = Schemas['RecruitmentDetailResponse'];
export type RecruitmentQuestion = Schemas['RecruitmentQuestionDto'];
export type RecruitmentRole = Schemas['RoleDto'];

export type RecruitmentCreateRequest = Schemas['RecruitmentCreateRequest'];
export type RecruitmentApplication = Schemas['RecruitmentApplicationDto'];

export type RecruitmentTab = 'browse' | 'mine' | 'applied' | 'bookmarked';

/** 상태값 — 백엔드 VALID_STATUSES와 동일 (웹의 '마감' 표기는 '모집완료'가 실제 값) */
export type RecruitmentStatus = '모집중' | '모집완료' | '진행중';

/** 목록 — 탭(둘러보기/내 모집/지원함/북마크) 또는 검색 */
export async function getRecruitments(tab: RecruitmentTab, search?: string): Promise<RecruitmentListItem[]> {
  const params: Record<string, string> = { tab };
  if (search?.trim()) params.search = search.trim();
  const { data } = await api.get<RecruitmentListItem[]>('/api/recruitments', { params });
  return data;
}

export async function getRecruitment(id: number): Promise<RecruitmentDetail> {
  const { data } = await api.get<RecruitmentDetail>(`/api/recruitments/${id}`);
  return data;
}

/** 지원 토글 — 서버가 'applied' | 'cancelled' 상태 문자열 반환 */
export async function toggleApply(id: number, message: string, roleId?: number): Promise<string> {
  const { data } = await api.post<{ status: string }>(`/api/recruitments/${id}/apply`, {
    message,
    ...(roleId != null ? { roleId } : {}),
  });
  return data.status;
}

export async function toggleBookmark(id: number): Promise<boolean> {
  const { data } = await api.post<{ bookmarked: boolean }>(`/api/recruitments/${id}/bookmark`);
  return !!data.bookmarked;
}

export async function createRecruitment(body: RecruitmentCreateRequest): Promise<RecruitmentListItem> {
  const { data } = await api.post<RecruitmentListItem>('/api/recruitments', body);
  return data;
}

export async function updateRecruitment(id: number, body: RecruitmentCreateRequest): Promise<RecruitmentDetail> {
  const { data } = await api.put<RecruitmentDetail>(`/api/recruitments/${id}`, body);
  return data;
}

export async function deleteRecruitment(id: number): Promise<void> {
  await api.delete(`/api/recruitments/${id}`);
}

export async function updateRecruitmentStatus(id: number, status: RecruitmentStatus): Promise<void> {
  await api.patch(`/api/recruitments/${id}/status`, { status });
}

// ── 지원자 관리 (작성자 전용) ─────────────────────────────────────

export async function getApplications(id: number): Promise<RecruitmentApplication[]> {
  const { data } = await api.get<RecruitmentApplication[]>(`/api/recruitments/${id}/applications`);
  return data;
}

export async function reviewApplication(
  id: number,
  appId: number,
  action: 'accept' | 'reject',
): Promise<RecruitmentApplication> {
  const { data } = await api.patch<RecruitmentApplication>(`/api/recruitments/${id}/applications/${appId}`, { action });
  return data;
}

/** 리더 Q&A 응답 신뢰도 — public */
export async function getUserQaStats(userId: number): Promise<{
  totalQuestionCount?: number;
  avgAnswerLatencyMinutes?: number | null;
  answerRate?: number;
  answeredCount?: number;
}> {
  const { data } = await api.get(`/api/users/${userId}/qa-stats`);
  return data;
}

// ── Q&A ──────────────────────────────────────────────────────────

export async function getQuestions(id: number): Promise<RecruitmentQuestion[]> {
  const { data } = await api.get<RecruitmentQuestion[]>(`/api/recruitments/${id}/questions`);
  return data;
}

export async function createQuestion(id: number, body: string, isPrivate: boolean): Promise<RecruitmentQuestion> {
  const { data } = await api.post<RecruitmentQuestion>(`/api/recruitments/${id}/questions`, { body, isPrivate });
  return data;
}

export async function deleteQuestion(id: number, qId: number): Promise<void> {
  await api.delete(`/api/recruitments/${id}/questions/${qId}`);
}

export async function upsertAnswer(id: number, qId: number, body: string): Promise<void> {
  await api.put(`/api/recruitments/${id}/questions/${qId}/answer`, { body });
}

export async function deleteAnswer(id: number, qId: number): Promise<void> {
  await api.delete(`/api/recruitments/${id}/questions/${qId}/answer`);
}

export async function pinQuestion(id: number, qId: number, pinned: boolean): Promise<void> {
  await api.patch(`/api/recruitments/${id}/questions/${qId}/pin`, { pinned });
}

/** 진행 체크리스트 토글 (작성자 전용) */
export async function toggleChecklist(id: number, checklistId: number): Promise<void> {
  await api.patch(`/api/recruitments/${id}/checklist/${checklistId}`);
}
