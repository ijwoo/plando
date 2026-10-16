import { api } from '@/api/client';
import type { Schemas } from '@/api/types';

/**
 * 생성 타입에 createdByEmail 을 덧댄다.
 *
 * 서버 DTO 에는 방금 추가했지만 `src/api/generated/schema.ts` 는 openapi.json 에서 자동 생성되고,
 * 그 스펙은 백엔드 `feat/openapi-spec` 브랜치를 띄워야 다시 뽑을 수 있다(CLAUDE.md 참고).
 * 다음 `npm run gen:spec` 때 정식으로 들어오면 이 교차 타입은 지워도 된다.
 */
export type Project = Schemas['ProjectResponseDto'] & { createdByEmail?: string };

export async function getProjects(): Promise<Project[]> {
  const { data } = await api.get<Project[]>('/api/projects');
  return data;
}

export async function createProject(name: string, color?: string, icon?: string): Promise<Project> {
  const { data } = await api.post<Project>('/api/projects', { name, color, icon });
  return data;
}

export async function updateProject(id: number, name: string, color?: string, icon?: string): Promise<Project> {
  const { data } = await api.put<Project>(`/api/projects/${id}`, { name, color, icon });
  return data;
}

export async function deleteProject(id: number): Promise<void> {
  await api.delete(`/api/projects/${id}`);
}

/** 프로젝트 개요 활동 피드 — 소속 할 일들의 최근 변경 로그 (웹 getProjectActivity 미러) */
export async function getProjectActivity(id: number): Promise<Schemas['TodoLogResponseDto'][]> {
  const { data } = await api.get<Schemas['TodoLogResponseDto'][]>(`/api/projects/${id}/activity`);
  return data ?? [];
}
