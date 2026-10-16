import { useQuery } from '@tanstack/react-query';

import { useWorkspaceStore } from '@/shared/store/workspaceStore';
import * as dashApi from './api';

/** 홈 "최근 항목" — 워크스페이스 스코프라 activeId 준비 후 요청. */
export function useRecentActivity() {
  const enabled = useWorkspaceStore((s) => s.activeId) != null;
  return useQuery({ queryKey: ['dashboard', 'activity'], queryFn: dashApi.getRecentActivity, enabled });
}

/**
 * 기간 내(dueDate) 할 일 — 팀 통계 주간 계산용.
 * 쿼리 키를 BriefingCard와 동일하게(['dashboard','period-tasks',from,to]) 맞춰 캐시를 공유한다.
 */
export function usePeriodTasks(from: string, to: string) {
  const enabled = useWorkspaceStore((s) => s.activeId) != null;
  return useQuery({
    queryKey: ['dashboard', 'period-tasks', from, to],
    queryFn: () => dashApi.getPeriodTasks(from, to),
    enabled,
    staleTime: 5 * 60_000,
  });
}

/** 지연 할 일 목록 — D-Day 카드의 "지연 N개" 배지. */
export function useOverdueTasks() {
  const enabled = useWorkspaceStore((s) => s.activeId) != null;
  return useQuery({ queryKey: ['dashboard', 'overdue'], queryFn: dashApi.getOverdueTasks, enabled });
}

/** 워크스페이스 멤버 목록 — 멤버 현황 카드 (태스크 없는 멤버도 0%로 표시). */
export function useWorkspaceUsers() {
  const enabled = useWorkspaceStore((s) => s.activeId) != null;
  return useQuery({ queryKey: ['dashboard', 'members'], queryFn: dashApi.getWorkspaceUsers, enabled });
}

/** 온라인 프레즌스 스냅샷 — 실패해도 화면은 동작해야 하므로 소비처에서 data 유무로만 사용. */
export function useWorkspacePresence() {
  const enabled = useWorkspaceStore((s) => s.activeId) != null;
  return useQuery({
    queryKey: ['dashboard', 'presence'],
    queryFn: dashApi.getWorkspacePresence,
    enabled,
    staleTime: 30_000,
    retry: false, // 프레즌스는 부가 정보 — 실패 시 조용히 생략
  });
}
