/**
 * 서브태스크 계약 확장 타입 — 백엔드 feat/subtasks 머지 후 `npm run gen:spec`으로
 * schema.ts를 재생성하면 이 파일은 제거하고 Schemas 원본 타입으로 되돌린다.
 *
 * 계약(확정본):
 * - Todo 응답에 parentId / subtaskTotal / subtaskDone 추가
 * - 생성·수정 요청 body에 parentId 수용
 * - GET /api/todos/{id}/subtasks → Todo[]
 * - 정책: 깊이 1단계(서브태스크에 자식 불가), 부모 삭제 시 자식은 일반 할일로 승격, 완료 전파 없음
 */
import type { Schemas } from './types';

/** 태그(라벨) */
export type TagLite = { id: number; name: string; color?: string | null };

/** Todo 응답에 추가되는 서브태스크 필드 */
export type SubtaskFields = {
  /** 부모 할 일 id — null/없음이면 최상위 */
  parentId?: number | null;
  /** 서브태스크 개수(부모 항목에만 채워짐) */
  subtaskTotal?: number;
  /** 완료된 서브태스크 개수 */
  subtaskDone?: number;
  /**
   * 체크리스트 항목 수 — 서버가 계속 내려주는 필드. 체크리스트 UI를 제거해(서브태스크로 일원화)
   * 앱에서는 더 이상 사용하지 않지만, 백엔드 응답 계약을 그대로 반영하기 위해 선언은 남겨둔다.
   */
  checklistTotal?: number;
  /** 체크된 체크리스트 항목 수 — 위와 동일(미사용) */
  checklistDone?: number;
  /** 부착된 태그 */
  tags?: TagLite[];
  /** 완료 시각 — null/없음이 아니면 완료(카테고리 DONE). 커스텀 상태 완료 판정용. */
  doneAt?: string | null;
};

/** 워크플로우 상태 정의 */
export type WorkflowStatusLite = {
  id: number;
  statusKey: string;
  label: string;
  color?: string | null;
  category: 'TODO' | 'IN_PROGRESS' | 'DONE';
  sortOrder: number;
  isDefault: boolean;
};

/** TodoResponseDto + 서브태스크 필드 — 기존 Todo 타입 자리에 그대로 합성 */
export type TodoExt = Schemas['TodoResponseDto'] & SubtaskFields;

/** TodoRequestDto + parentId — 생성/수정 요청 */
export type TodoRequestExt = Schemas['TodoRequestDto'] & {
  parentId?: number | null;
  /**
   * 오프라인 재전송 중복 방지 열쇠. 서버가 같은 값을 보면 새로 만들지 않고 있던 것을 돌려준다.
   * OpenAPI 스펙(feat/openapi-spec 브랜치)이 아직 이 필드를 모르므로 여기서 확장한다 —
   * 다음 gen:spec 때 스펙에 들어오면 이 줄은 지워도 된다.
   */
  clientKey?: string;
};
