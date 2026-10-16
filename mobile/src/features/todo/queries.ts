import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import type { Schemas } from '@/api/types';
import type { TodoRequestExt } from '@/api/typesExt';
import type { WorkflowStatusLite } from '@/api/typesExt';
import { isTodoDone , doneStatusKey, undoneStatusKey, useStatuses } from '@/features/status/queries';
import { useWorkspaceStore } from '@/shared/store/workspaceStore';
import { completionFeedback } from '@/shared/ui/completionFeedback';
import { getApiErrorMessage } from '@/api/error';
import { toast } from '@/shared/ui/toast';
import { isOfflineError } from '@/api/error';
import { enqueue, newClientKey } from './offlineQueue';
import * as todoApi from './api';
import type { Todo } from './api';

export const todoKeys = {
  all: ['todos'] as const,
  detail: (id: number) => ['todos', id] as const,
  subtasks: (id: number) => ['todos', id, 'subtasks'] as const,
  archived: ['todos', 'archived'] as const,
};

/**
 * 낙관 업데이트 헬퍼 — 리스트(['todos'])와 상세 캐시에 패치를 즉시 반영하고
 * 롤백용 스냅샷을 돌려준다. 실패 토스트는 전역 MutationCache가 담당.
 */
function optimisticPatch(qc: QueryClient, id: number, patch: Partial<Todo>) {
  const prevList = qc.getQueryData<Todo[]>(todoKeys.all);
  if (prevList) {
    qc.setQueryData<Todo[]>(
      todoKeys.all,
      prevList.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    );
  }
  const prevDetail = qc.getQueryData<Todo>(todoKeys.detail(id));
  if (prevDetail) qc.setQueryData<Todo>(todoKeys.detail(id), { ...prevDetail, ...patch });
  return { prevList, prevDetail };
}

function rollbackPatch(qc: QueryClient, id: number, snap?: { prevList?: Todo[]; prevDetail?: Todo }) {
  if (snap?.prevList) qc.setQueryData(todoKeys.all, snap.prevList);
  if (snap?.prevDetail) qc.setQueryData(todoKeys.detail(id), snap.prevDetail);
}

export function useTodos() {
  // 할 일은 워크스페이스 스코프 — 로그인 직후 X-Workspace-Id 해석 전에 요청하면
  // 헤더 없는 응답이 캐시되므로 활성 워크스페이스 확정 후에만 fetch (useRooms와 동일 패턴)
  const activeId = useWorkspaceStore((s) => s.activeId);
  return useQuery({
    queryKey: todoKeys.all,
    queryFn: todoApi.getTodos,
    enabled: activeId != null,
  });
}

/**
 * 여러 id에 같은 작업을 병렬 적용하고 캐시 무효화는 마지막에 1회만 수행.
 * (개별 mutate를 N번 돌리면 성공마다 ['todos'] refetch가 N번 발생)
 */
export function useBulkTodoAction() {
  const qc = useQueryClient();
  /**
   * @returns 성공 건수 — 호출부가 **결과를 보고** 성공 문구를 띄울 수 있게 한다.
   *
   * 예전엔 void 를 돌려줘서 호출부가 요청 **전에** "N개 완료"를 먼저 띄웠고,
   * 실패는 뒤늦게 "N개 항목 처리에 실패했어요"로만 덧붙었다. 어느 항목이 왜 실패했는지
   * 알 방법이 없었고, 권한(403)·샘플·유효하지 않은 상태(400)가 전부 같은 문구가 됐다.
   */
  return async (ids: number[], run: (id: number) => Promise<unknown>): Promise<number> => {
    const results = await Promise.allSettled(ids.map(run));
    await qc.invalidateQueries({ queryKey: todoKeys.all });
    void qc.invalidateQueries({ queryKey: todoKeys.archived });
    void qc.invalidateQueries({ queryKey: ['dashboard'] });

    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    if (rejected.length) {
      // 실패 사유가 한 종류면 그 사유를 그대로 보여준다(대부분 권한·샘플로 원인이 같다).
      const reasons = new Set(rejected.map((r) => getApiErrorMessage(r.reason, '처리하지 못했어요')));
      const detail = reasons.size === 1 ? [...reasons][0] : `${rejected.length}건을 처리하지 못했어요`;
      toast.error(rejected.length === ids.length ? detail : `${rejected.length}건 실패 — ${detail}`);
    }
    return ids.length - rejected.length;
  };
}

export function useTodo(id: number) {
  return useQuery({
    queryKey: todoKeys.detail(id),
    queryFn: () => todoApi.getTodo(id),
  });
}

/**
 * 주의: PUT은 full-replace — dto에서 생략한 관계 필드(assignees, parentId)가 서버에서 해제된다.
 * 단일 필드 수정은 useUpdateTodoField(PATCH)를 쓸 것. (현재 이 훅은 소비처 없음)
 */
export function useUpdateTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: Schemas['TodoRequestDto'] }) =>
      todoApi.updateTodo(id, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: todoKeys.all }),
  });
}

/**
 * 새 할 일이 받을 상태 key — 서버 WorkflowStatusService.defaultStatusKey 미러
 * (isDefault 항목 → 없으면 TODO 카테고리 기본/첫 항목 → 없으면 'TODO').
 *
 * status는 서버 DTO에서 @NotBlank라 생략할 수 없다. 그래서 'TODO'를 박아 보내왔는데,
 * 기본 상태를 다른 것으로 바꾼 워크스페이스에서는 의도한 진입 상태가 아닌 곳에 만들어졌고
 * (TODO를 지운 워크스페이스라면 서버가 조용히 기본값으로 바꿔) 화면에 보이던 상태와도
 * 달라졌다. 클라이언트가 서버와 같은 규칙으로 고른다.
 */
export function newTodoStatusKey(statuses?: WorkflowStatusLite[] | null): string {
  return (statuses ?? []).find((s) => s.isDefault)?.statusKey ?? undoneStatusKey(statuses);
}

export function useCreateTodo() {
  const qc = useQueryClient();
  const { data: statuses } = useStatuses();
  return useMutation({
    // title은 필수, status는 워크스페이스 기본 상태. content/assignees/projectId 등 TodoRequestDto 전체 허용.
    mutationFn: (input: Partial<TodoRequestExt> & { title: string }) =>
      todoApi.createTodo({
        ...input,
        status: input.status || newTodoStatusKey(statuses),
        /* 재전송 중복 방지 열쇠를 **처음부터** 붙인다. 나중에 큐에서 붙이면, 이미 보냈지만
           응답만 못 받은 요청과 큐에 담긴 요청이 서로 다른 열쇠를 갖게 되어 중복이 난다. */
        clientKey: input.clientKey ?? newClientKey(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: todoKeys.all });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('할 일을 추가했어요');
    },
    onError: (error, input) => {
      /* 네트워크에 **닿지 못한** 것만 큐에 담는다.
         서버가 400·403 으로 거절한 것을 담으면 영원히 실패하며 쌓인다.
         담은 뒤에는 실패 토스트 대신 "나중에 보낼게요" 를 말한다 — 사용자가 다시 적지
         않아도 되는데 실패로 알리면 같은 것을 두 번 적게 된다. */
      if (!isOfflineError(error)) return;
      void enqueue({
        clientKey: input.clientKey ?? newClientKey(),
        /* status 를 **지금** 확정해서 담는다. 나중에 보낼 때 워크스페이스 기본 상태가
           바뀌어 있으면 적을 때와 다른 상태로 들어간다. */
        payload: { ...input, status: input.status || newTodoStatusKey(statuses) },
        queuedAt: Date.now(),
      });
      toast.info('지금 연결이 없어 저장해뒀어요. 연결되면 자동으로 올려드려요');
    },
  });
}

/** 단건 필드 자동저장 (PATCH {field,value}). 403은 호출부에서 readonly 처리하도록 전파. */
export function useUpdateTodoField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, field, value }: { id: number; field: string; value: unknown }) =>
      todoApi.updateTodoField(id, field, value),
    // 보드 상태 이동·우선순위 변경 등이 즉시 보이도록 낙관 반영
    onMutate: async ({ id, field, value }) => {
      await qc.cancelQueries({ queryKey: todoKeys.all });
      // assignees는 API로 CSV 문자열을 보내지만 응답/캐시는 객체 배열 — 문자열을 그대로 캐시에 쓰면
      // .map 크래시(편집 폼·AvatarStack). 응답 모양으로 정규화해서 패치한다.
      const patch =
        field === 'assignees' && typeof value === 'string'
          ? { assignees: value ? value.split(',').map((email) => ({ email, name: email.split('@')[0] })) : [] }
          : { [field]: value };
      return optimisticPatch(qc, id, patch as Partial<Todo>);
    },
    onError: (_e, { id }, snap) => rollbackPatch(qc, id, snap),
    onSettled: (_d, _e, { id }) => {
      qc.invalidateQueries({ queryKey: todoKeys.detail(id) });
      qc.invalidateQueries({ queryKey: todoKeys.all });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      // 활동 로그·프로젝트 활동 피드도 갱신 — 수정 직후 활동 탭에 바로 반영되도록
      qc.invalidateQueries({ queryKey: ['todo', id, 'logs'] });
      qc.invalidateQueries({ queryKey: ['project-activity'] });
    },
  });
}

/** 포커스(⚡) 토글 — per-user 전용 엔드포인트. */
export function useUpdateTodoFocus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, focused }: { id: number; focused: boolean }) => todoApi.updateTodoFocus(id, focused),
    onMutate: async ({ id, focused }) => {
      await qc.cancelQueries({ queryKey: todoKeys.all });
      return optimisticPatch(qc, id, { focused } as Partial<Todo>);
    },
    onError: (_e, { id }, snap) => rollbackPatch(qc, id, snap),
    onSettled: (_d, _e, { id }) => {
      qc.invalidateQueries({ queryKey: todoKeys.detail(id) });
      qc.invalidateQueries({ queryKey: todoKeys.all });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useToggleTodo() {
  const qc = useQueryClient();
  // 'DONE'/'TODO' 하드코딩 금지 — 워크스페이스가 그 key를 지웠을 수 있고, 서버는 isValidKey로
  // 실제 존재하는 key만 받는다(하드코딩이면 커스텀 상태 워크스페이스에서 완료 체크가 400).
  const { data: statuses } = useStatuses();
  return useMutation({
    mutationFn: ({ id, done }: { id: number; done: boolean }) =>
      todoApi.updateTodoStatus(id, done ? doneStatusKey(statuses) : undoneStatusKey(statuses)),
    // 완료 토글은 하루에 수십 번 쓰는 동작 — 체크·취소선·그룹 이동이 즉시 보여야 한다
    onMutate: async ({ id, done }) => {
      completionFeedback(done); // 성공 햅틱(+옵션 차임) — 낙관 반영과 같은 프레임에
      await qc.cancelQueries({ queryKey: todoKeys.all });
      // doneAt도 함께 패치한다 — isTodoDone이 doneAt을 먼저 보므로, 이걸 빼면 '되돌리기'를 눌러도
      // 화면이 계속 완료로 보인다(refetch 전까지).
      return optimisticPatch(qc, id, {
        status: done ? doneStatusKey(statuses) : undoneStatusKey(statuses),
        doneAt: done ? new Date().toISOString() : null,
      } as Partial<Todo>);
    },
    onError: (_e, { id }, snap) => rollbackPatch(qc, id, snap),
    onSettled: (_d, _e, { id }) => {
      qc.invalidateQueries({ queryKey: todoKeys.all });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['todo', id, 'logs'] });
      qc.invalidateQueries({ queryKey: ['project-activity'] });
    },
  });
}

/**
 * 부모(상세·리스트) 캐시의 subtaskTotal/subtaskDone 카운터를 낙관 갱신.
 * 서브태스크 목록 캐시와 별개로, 상세 헤더 n/m·목록 배지가 refetch 전에 즉시 따라온다.
 */
function bumpSubtaskCounts(qc: QueryClient, parentId: number, dTotal: number, dDone: number) {
  const apply = (t: Todo): Todo => ({
    ...t,
    subtaskTotal: Math.max(0, (t.subtaskTotal ?? 0) + dTotal),
    subtaskDone: Math.max(0, (t.subtaskDone ?? 0) + dDone),
  });
  const list = qc.getQueryData<Todo[]>(todoKeys.all);
  if (list) qc.setQueryData<Todo[]>(todoKeys.all, list.map((t) => (t.id === parentId ? apply(t) : t)));
  const detail = qc.getQueryData<Todo>(todoKeys.detail(parentId));
  if (detail) qc.setQueryData<Todo>(todoKeys.detail(parentId), apply(detail));
}

/** 부모의 서브태스크 목록 — 상세 화면 전용(목록 화면은 리스트 쿼리에서 parentId 그룹핑, 추가 fetch 없음) */
export function useSubtasks(parentId: number) {
  return useQuery({
    queryKey: todoKeys.subtasks(parentId),
    queryFn: () => todoApi.getSubtasks(parentId),
  });
}

/** 서브태스크 추가 — 제목만, parentId 고정. 응답 항목을 서브태스크 캐시에 즉시 append + 부모 카운터 +1. */
export function useCreateSubtask(parentId: number) {
  const qc = useQueryClient();
  const { data: statuses } = useStatuses();
  return useMutation({
    // priority는 DB not-null — 인라인 추가 기본값 MEDIUM
    mutationFn: (title: string) => todoApi.createTodo({ title, status: undoneStatusKey(statuses), priority: 'MEDIUM', parentId }),
    onSuccess: (created) => {
      qc.setQueryData<Todo[]>(todoKeys.subtasks(parentId), (prev) => (prev ? [...prev, created] : [created]));
      bumpSubtaskCounts(qc, parentId, 1, 0);
      // ['todos'] prefix — 리스트(자식 포함)·부모 상세까지 서버 값으로 재동기화
      void qc.invalidateQueries({ queryKey: todoKeys.all });
    },
  });
}

/** 서브태스크 완료 토글 — 서브태스크 캐시 + 리스트/자기 상세 + 부모 카운터를 한 번에 낙관 반영. */
export function useToggleSubtask(parentId: number) {
  const qc = useQueryClient();
  const { data: statuses } = useStatuses();
  return useMutation({
    mutationFn: ({ id, done }: { id: number; done: boolean }) =>
      todoApi.updateTodoStatus(id, done ? doneStatusKey(statuses) : undoneStatusKey(statuses)),
    onMutate: async ({ id, done }) => {
      completionFeedback(done); // 낙관 반영과 같은 프레임에 성공 햅틱
      await qc.cancelQueries({ queryKey: todoKeys.all });
      const status = done ? doneStatusKey(statuses) : undoneStatusKey(statuses);
      const prevSubs = qc.getQueryData<Todo[]>(todoKeys.subtasks(parentId));
      const prevParent = qc.getQueryData<Todo>(todoKeys.detail(parentId));
      const doneAt = done ? new Date().toISOString() : null;
      const base = optimisticPatch(qc, id, { status, doneAt } as Partial<Todo>); // prevList는 카운터 패치 전 스냅샷
      if (prevSubs) {
        qc.setQueryData<Todo[]>(todoKeys.subtasks(parentId), prevSubs.map((t) => (t.id === id ? { ...t, status, doneAt } : t)));
      }
      bumpSubtaskCounts(qc, parentId, 0, done ? 1 : -1);
      return { ...base, prevSubs, prevParent };
    },
    onError: (_e, { id }, snap) => {
      rollbackPatch(qc, id, snap);
      if (snap?.prevSubs) qc.setQueryData(todoKeys.subtasks(parentId), snap.prevSubs);
      if (snap?.prevParent) qc.setQueryData(todoKeys.detail(parentId), snap.prevParent);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: todoKeys.all }),
  });
}

/** 서브태스크 삭제 — 서브태스크·리스트 캐시에서 낙관 제거 + 부모 카운터 감소. 실패 시 복원. */
export function useDeleteSubtask(parentId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => todoApi.deleteTodo(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: todoKeys.all });
      const prevSubs = qc.getQueryData<Todo[]>(todoKeys.subtasks(parentId));
      const prevList = qc.getQueryData<Todo[]>(todoKeys.all);
      const prevParent = qc.getQueryData<Todo>(todoKeys.detail(parentId));
      const target = prevSubs?.find((t) => t.id === id) ?? prevList?.find((t) => t.id === id);
      if (prevSubs) qc.setQueryData<Todo[]>(todoKeys.subtasks(parentId), prevSubs.filter((t) => t.id !== id));
      if (prevList) qc.setQueryData<Todo[]>(todoKeys.all, prevList.filter((t) => t.id !== id));
      bumpSubtaskCounts(qc, parentId, -1, target != null && isTodoDone(target) ? -1 : 0);
      return { prevSubs, prevList, prevParent };
    },
    onError: (_e, _id, snap) => {
      if (snap?.prevSubs) qc.setQueryData(todoKeys.subtasks(parentId), snap.prevSubs);
      if (snap?.prevList) qc.setQueryData(todoKeys.all, snap.prevList);
      if (snap?.prevParent) qc.setQueryData(todoKeys.detail(parentId), snap.prevParent);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: todoKeys.all }),
  });
}

export function useDeleteTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => todoApi.deleteTodo(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: todoKeys.all });
      toast.success('할 일을 삭제했어요');
    },
  });
}

/** 보관 목록 — 실제로 보이는 화면에서만 fetch하도록 enabled로 게이트 (기본 on, 워크스페이스 확정 필요) */
export function useArchivedTodos(enabled = true) {
  const activeId = useWorkspaceStore((s) => s.activeId);
  return useQuery({
    queryKey: todoKeys.archived,
    queryFn: todoApi.getArchivedTodos,
    enabled: enabled && activeId != null,
  });
}

export function useArchiveTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => todoApi.archiveTodo(id),
    // 목록에서 즉시 사라지게 낙관 제거 — 실패 시 복원
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: todoKeys.all });
      const prevList = qc.getQueryData<Todo[]>(todoKeys.all);
      if (prevList) qc.setQueryData<Todo[]>(todoKeys.all, prevList.filter((t) => t.id !== id));
      return { prevList };
    },
    onError: (_e, _id, snap) => {
      if (snap?.prevList) qc.setQueryData(todoKeys.all, snap.prevList);
    },
    // ['todos'] prefix 무효화 → 메인 보드 + 아카이브 둘 다 갱신. 토스트는 호출부에서(실행취소 포함).
    onSettled: () => qc.invalidateQueries({ queryKey: todoKeys.all }),
  });
}

export function useRestoreTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => todoApi.restoreTodo(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: todoKeys.all }),
  });
}
