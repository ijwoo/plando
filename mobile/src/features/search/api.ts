import { api } from '@/api/client';
import type { Schemas } from '@/api/types';

/** 검색 결과의 프로젝트 항목 (openCount = 그 프로젝트의 미완료 할 일 수) */
export type SearchProject = { id?: number; name?: string; color?: string; openCount?: number };

/** 검색 결과의 태그 항목 (todoCount = 그 태그가 붙은 미아카이브 할 일 수) */
export type SearchTag = { id?: number; name?: string; color?: string; todoCount?: number };

/**
 * 서버 SearchResultDto에 projects·tags·hasMoreTasks가 추가됐지만 generated/schema.ts는 아직 옛 스펙이다.
 * 스펙 재생성은 백엔드 feat/openapi-spec 브랜치를 로컬로 띄워야만 가능(npm run gen:spec)하므로,
 * 생성 파일은 건드리지 않고 여기서만 교차 확장한다. 스펙을 다시 뽑으면 이 확장은 지워도 된다.
 */
type TaskItem = NonNullable<Schemas['SearchResultDto']['tasks']>[number] & {
  /** 보관 여부 — 검색이 아카이브까지 훑게 되면서 결과에 섞이므로 UI가 구분 표시한다 */
  archived?: boolean;
};

export type SearchResult = Omit<Schemas['SearchResultDto'], 'tasks'> & {
  tasks?: TaskItem[];
  projects?: SearchProject[];
  tags?: SearchTag[];
  hasMoreTasks?: boolean;
};

/**
 * 통합 검색 — 할 일·메시지·멤버·프로젝트·태그. X-Workspace-Id 헤더는 인터셉터가 주입.
 * page(0-base)는 할 일에만 적용된다. 1페이지부터는 할 일만 내려오고 나머지 종류는 빈 배열.
 */
export async function search(q: string, page = 0): Promise<SearchResult> {
  const { data } = await api.get<SearchResult>('/api/search', { params: { q, page } });
  return data;
}
