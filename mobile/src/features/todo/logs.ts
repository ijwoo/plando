import { useQuery } from '@tanstack/react-query';

import { api } from '@/api/client';
import type { Schemas } from '@/api/types';
import { PRIORITY_LABEL, STATUS_LABEL, type TodoPriority, type TodoStatus } from '@/shared/ui/tone';

export type TodoLog = Schemas['TodoLogResponseDto'];

/** 할 일 변경 로그 (활동 탭). GET /api/todos/{id}/logs */
export function useTodoLogs(todoId: number) {
  return useQuery({
    queryKey: ['todo', todoId, 'logs'],
    queryFn: async () => (await api.get<TodoLog[]>(`/api/todos/${todoId}/logs`)).data,
  });
}

const FIELD_LABEL: Record<string, string> = {
  status: '상태',
  priority: '우선순위',
  dueDate: '마감일',
  startAt: '시작일',
  startTime: '시작 시간',
  endTime: '종료 시간',
  title: '제목',
  content: '내용',
  assignees: '담당자',
  projectId: '프로젝트',
  locationName: '위치',
  archived: '보관',
};

export function fieldLabel(field?: string): string {
  return (field && FIELD_LABEL[field]) ?? field ?? '항목';
}

/** 로그 값(코드)을 한글 라벨로 — 상태/우선순위/보관 등. 그 외는 원값. */
export function valueLabel(field?: string, value?: string): string {
  if (value == null || value === '') return '없음';
  if (field === 'status') return STATUS_LABEL[value as TodoStatus] ?? value;
  if (field === 'priority') return PRIORITY_LABEL[value as TodoPriority] ?? value;
  if (field === 'archived') return value === 'true' ? '보관' : '해제';
  return value;
}

function trunc(s: string, n = 22): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n) + '…' : t;
}

/**
 * 로그 한 건을 담백한 한 줄 요약으로(수정자 이름 제외). content 같은 장문 필드는
 * 값을 노출하지 않고 동작만 — 활동 피드가 마크다운 전문으로 벽이 되는 걸 방지.
 */
export function changeSummary(l: TodoLog, statusLabel?: (k?: string | null) => string): string {
  const f = l.field;
  // 내용: 전문 대신 새 내용 앞부분만 미리보기(벽 방지). 전체는 행을 눌러 펼치거나 상세 본문에.
  if (f === 'content') return l.afterValue ? `내용 수정 · "${trunc(l.afterValue, 30)}"` : '내용 수정';
  if (f === 'title') return l.afterValue ? `제목 → "${trunc(l.afterValue)}"` : '제목 수정';
  if (f === 'archived') return l.afterValue === 'true' ? '보관함으로 이동' : '보관 해제';
  // 상태: 커스텀 상태(st_...)는 statusLabel로 라벨 해석(없으면 기본 3상태만 valueLabel).
  const lbl = (v?: string) => {
    if (v == null || v === '') return '없음';
    if (f === 'status' && statusLabel) return statusLabel(v);
    return valueLabel(f, v);
  };
  const before = lbl(l.beforeValue);
  const after = lbl(l.afterValue);
  if (l.beforeValue && l.afterValue) return `${fieldLabel(f)} ${before} → ${after}`;
  if (l.afterValue) return `${fieldLabel(f)} → ${after}`;
  if (l.beforeValue) return `${fieldLabel(f)} 해제`;
  return `${fieldLabel(f)} 변경`;
}

/** 값 변화가 실제로 있는 로그만(무의미한 무변경 저장 제거). */
export function isMeaningfulLog(l: TodoLog): boolean {
  if (l.beforeValue != null && l.afterValue != null && l.beforeValue === l.afterValue) return false;
  return true;
}

/**
 * 활동 로그 정리 — (1) 무의미 로그 제거 (2) 시간 내림차순에서 연속된
 * 같은 (대상·필드·수정자) 편집을 최신 1건으로 접기(내용 5번 저장·상태 토글 스팸 방지).
 */
export function collapseLogs(logs: TodoLog[]): TodoLog[] {
  const out: TodoLog[] = [];
  for (const l of logs) {
    if (!isMeaningfulLog(l)) continue;
    const prev = out[out.length - 1];
    if (
      prev &&
      prev.field === l.field &&
      prev.todoId === l.todoId &&
      (prev.modifierName ?? prev.modifier) === (l.modifierName ?? l.modifier)
    ) {
      continue; // 직전(더 최신) 건만 유지
    }
    out.push(l);
  }
  return out;
}
