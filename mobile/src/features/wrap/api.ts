import { api } from '@/api/client';
import type { Schemas } from '@/api/types';

export type WrapResponse = Schemas['WrapResponseDto'];
export type WrapPersona = 'analyst' | 'cheer' | 'cynical' | 'brutal';

/** 주간 회고 조회 — weekStart null이면 이번 주. refresh=true면 AI 한마디 재생성 */
export async function getWeeklyWrap(
  weekStart: string | null,
  opts?: { refresh?: boolean; persona?: WrapPersona },
): Promise<WrapResponse> {
  const params: Record<string, string | boolean> = {};
  if (weekStart) params.weekStart = weekStart;
  if (opts?.refresh) params.refresh = true;
  if (opts?.persona) params.persona = opts.persona;
  const { data } = await api.get<WrapResponse>('/api/wrap/weekly', { params });
  return data;
}

export type WrapHistoryItem = Schemas['WrapHistoryItemDto'];

/** 최근 N주 요약 히스토리 — 완료율 추이 차트용 */
export async function getWrapHistory(weeks = 12): Promise<WrapHistoryItem[]> {
  const { data } = await api.get<WrapHistoryItem[]>('/api/wrap/history', { params: { weeks } });
  return data;
}

/** 셀프 메모 저장 (빈 문자열이면 삭제) */
export async function saveWrapMemo(content: string, weekStart: string | null): Promise<void> {
  await api.put('/api/wrap/weekly/memo', { content, ...(weekStart ? { weekStart } : {}) });
}
