import { api } from '@/api/client';
import type { Schemas } from '@/api/types';

export type RecentActivity = Schemas['RecentActivityDto'];
export type PeriodTask = Schemas['PeriodTaskDto'];
export type DashboardTask = Schemas['DashboardTaskDto'];
export type WorkspaceUser = Schemas['UserDto'];
export type Presence = Schemas['PresenceDto'];

/** 최근 활동 로그 (홈 "최근 항목"). */
export async function getRecentActivity(): Promise<RecentActivity[]> {
  const { data } = await api.get<RecentActivity[]>('/api/dashboard/recent-activity');
  return data;
}

/** 기간 내(dueDate 기준) 할 일 — 주간 완료율 통계용. 웹 fetchPeriodTasks 미러 (archived 무관). */
export async function getPeriodTasks(from: string, to: string): Promise<PeriodTask[]> {
  const { data } = await api.get<PeriodTask[]>('/api/dashboard/period-tasks', { params: { from, to } });
  return data;
}

/** 지연(마감 지난 미완료) 할 일 — 팀 통계 D-Day 카드의 "지연 N개". 웹 fetchOverdueTasks 미러. */
export async function getOverdueTasks(): Promise<DashboardTask[]> {
  const { data } = await api.get<DashboardTask[]>('/api/dashboard/overdue');
  return data;
}

/** 현재 워크스페이스 멤버 목록 — 멤버 현황 카드용. 웹 fetchAllUsers 미러. */
export async function getWorkspaceUsers(): Promise<WorkspaceUser[]> {
  const { data } = await api.get<WorkspaceUser[]>('/api/users');
  return data;
}

/**
 * 워크스페이스 멤버 프레즌스 스냅샷 — { [email]: { online, lastSeen } }.
 * 웹 fetchWorkspacePresence 미러 (STOMP 세션 기반이라 스냅샷만; 실시간 patch는 미도입).
 */
export async function getWorkspacePresence(): Promise<Record<string, Presence>> {
  const { data } = await api.get<Record<string, Presence>>('/api/presence');
  return data;
}
