import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getApiErrorMessage } from '@/api/error';
import { toast } from '@/shared/ui/toast';
import * as rcApi from './api';
import type { RecruitmentDetail, RecruitmentListItem, RecruitmentTab } from './api';

export const rcKeys = {
  list: (tab: RecruitmentTab, search: string) => ['recruitments', tab, search] as const,
  detail: (id: number) => ['recruitments', 'detail', id] as const,
  questions: (id: number) => ['recruitments', 'questions', id] as const,
  applications: (id: number) => ['recruitments', 'applications', id] as const,
  qaStats: (userId: number) => ['recruitments', 'qa-stats', userId] as const,
};

export function useRecruitments(tab: RecruitmentTab, search: string) {
  return useQuery({
    queryKey: rcKeys.list(tab, search),
    queryFn: () => rcApi.getRecruitments(tab, search),
    staleTime: 30_000,
  });
}

export function useRecruitment(id: number, enabled = true) {
  return useQuery({
    queryKey: rcKeys.detail(id),
    queryFn: () => rcApi.getRecruitment(id),
    enabled,
  });
}

export function useRecruitmentQuestions(id: number, enabled = true) {
  return useQuery({
    queryKey: rcKeys.questions(id),
    queryFn: () => rcApi.getQuestions(id),
    enabled,
  });
}

/** 북마크 토글 — 목록·상세 캐시 낙관 반영 */
export function useToggleBookmark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => rcApi.toggleBookmark(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['recruitments'] });
      const listSnaps = qc.getQueriesData<RecruitmentListItem[]>({ queryKey: ['recruitments'] });
      // 모든 목록 캐시에서 해당 항목 bookmarked 뒤집기
      for (const [key, data] of listSnaps) {
        if (!Array.isArray(data)) continue;
        qc.setQueryData(
          key,
          data.map((r) => (r.id === id ? { ...r, bookmarked: !r.bookmarked } : r)),
        );
      }
      const prevDetail = qc.getQueryData<RecruitmentDetail>(rcKeys.detail(id));
      if (prevDetail) qc.setQueryData(rcKeys.detail(id), { ...prevDetail, bookmarked: !prevDetail.bookmarked });
      return { listSnaps, prevDetail };
    },
    onError: (e, id, snap) => {
      for (const [key, data] of snap?.listSnaps ?? []) qc.setQueryData(key, data);
      if (snap?.prevDetail) qc.setQueryData(rcKeys.detail(id), snap.prevDetail);
      // 롤백만 하고 조용히 끝내면 아이콘이 깜빡였다 되돌아갈 뿐이라 실패를 알 길이 없었다.
      // (게스트는 서버가 403 GUEST_NOT_ALLOWED로 막는데 화면엔 아무 반응이 없었다)
      toast.error(getApiErrorMessage(e, '북마크를 저장하지 못했어요'));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['recruitments'] }),
  });
}

export function useToggleApply(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ message, roleId }: { message: string; roleId?: number }) =>
      rcApi.toggleApply(id, message, roleId),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: rcKeys.detail(id) });
      qc.invalidateQueries({ queryKey: ['recruitments'] });
    },
  });
}

export function useCreateQuestion(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ body, isPrivate }: { body: string; isPrivate: boolean }) =>
      rcApi.createQuestion(id, body, isPrivate),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: rcKeys.questions(id) });
      qc.invalidateQueries({ queryKey: rcKeys.detail(id) });
    },
  });
}

export function useDeleteQuestion(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (qId: number) => rcApi.deleteQuestion(id, qId),
    onSettled: () => qc.invalidateQueries({ queryKey: rcKeys.questions(id) }),
  });
}

export function useUpsertAnswer(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ qId, body }: { qId: number; body: string }) => rcApi.upsertAnswer(id, qId, body),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: rcKeys.questions(id) });
      qc.invalidateQueries({ queryKey: rcKeys.detail(id) });
    },
  });
}

export function useDeleteAnswer(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (qId: number) => rcApi.deleteAnswer(id, qId),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: rcKeys.questions(id) });
      qc.invalidateQueries({ queryKey: rcKeys.detail(id) });
    },
  });
}

export function usePinQuestion(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ qId, pinned }: { qId: number; pinned: boolean }) => rcApi.pinQuestion(id, qId, pinned),
    onSettled: () => qc.invalidateQueries({ queryKey: rcKeys.questions(id) }),
  });
}

export function useCreateRecruitment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: rcApi.RecruitmentCreateRequest) => rcApi.createRecruitment(body),
    onSettled: () => qc.invalidateQueries({ queryKey: ['recruitments'] }),
  });
}

export function useUpdateRecruitment(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: rcApi.RecruitmentCreateRequest) => rcApi.updateRecruitment(id, body),
    onSettled: () => qc.invalidateQueries({ queryKey: ['recruitments'] }),
  });
}

export function useDeleteRecruitment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => rcApi.deleteRecruitment(id),
    onSettled: () => qc.invalidateQueries({ queryKey: ['recruitments'] }),
  });
}

/** 상태 변경 — 상세 statusLabel 낙관 반영 */
export function useUpdateRecruitmentStatus(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: rcApi.RecruitmentStatus) => rcApi.updateRecruitmentStatus(id, status),
    onMutate: async (status) => {
      await qc.cancelQueries({ queryKey: rcKeys.detail(id) });
      const prev = qc.getQueryData<RecruitmentDetail>(rcKeys.detail(id));
      if (prev) qc.setQueryData(rcKeys.detail(id), { ...prev, statusLabel: status });
      return { prev };
    },
    onError: (_e, _v, snap) => {
      if (snap?.prev) qc.setQueryData(rcKeys.detail(id), snap.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['recruitments'] }),
  });
}

export function useApplications(id: number, enabled = true) {
  return useQuery({
    queryKey: rcKeys.applications(id),
    queryFn: () => rcApi.getApplications(id),
    enabled,
  });
}

export function useReviewApplication(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ appId, action }: { appId: number; action: 'accept' | 'reject' }) =>
      rcApi.reviewApplication(id, appId, action),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: rcKeys.applications(id) });
      qc.invalidateQueries({ queryKey: rcKeys.detail(id) }); // 멤버·지원 수·상태 갱신
    },
  });
}

export function useUserQaStats(userId?: number) {
  return useQuery({
    queryKey: rcKeys.qaStats(userId ?? 0),
    queryFn: () => rcApi.getUserQaStats(userId!),
    enabled: userId != null,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useToggleChecklist(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (checklistId: number) => rcApi.toggleChecklist(id, checklistId),
    // 진행 체크는 상세 progress에 낙관 반영
    onMutate: async (checklistId) => {
      await qc.cancelQueries({ queryKey: rcKeys.detail(id) });
      const prev = qc.getQueryData<RecruitmentDetail>(rcKeys.detail(id));
      if (prev?.progress) {
        qc.setQueryData(rcKeys.detail(id), {
          ...prev,
          progress: prev.progress.map((p) => (p.id === checklistId ? { ...p, done: !p.done } : p)),
        });
      }
      return { prev };
    },
    onError: (_e, _v, snap) => {
      if (snap?.prev) qc.setQueryData(rcKeys.detail(id), snap.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: rcKeys.detail(id) }),
  });
}
