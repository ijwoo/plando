import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useWorkspaceStore } from '@/shared/store/workspaceStore';
import { toast } from '@/shared/ui/toast';
import {
  changeMemberRole,
  createWorkspace,
  deleteWorkspace,
  getMembers,
  getMyWorkspaces,
  joinWorkspace,
  leaveWorkspace,
  removeMember,
  transferOwner,
  updateWorkspace,
  uploadWorkspaceIcon,
} from './api';

export function useMyWorkspaces() {
  return useQuery({
    queryKey: ['workspaces', 'my'],
    queryFn: getMyWorkspaces,
  });
}

export function useWorkspaceMembers(workspaceId?: number) {
  const activeId = useWorkspaceStore((s) => s.activeId);
  const id = workspaceId ?? activeId;
  return useQuery({
    queryKey: ['workspaces', id, 'members'],
    queryFn: () => getMembers(id as number),
    enabled: id != null,
  });
}

/**
 * 만들기·참여 후에는 그 워크스페이스로 바로 전환한다.
 * 예전엔 목록만 갱신해서, 사용자는 방금 만든(참여한) 곳이 아니라 원래 보던 워크스페이스에
 * 그대로 남았다 — 성공 토스트만 뜨고 화면은 그대로라 아무 일도 안 일어난 것처럼 보였다.
 * (딥링크 참여 경로 join.tsx / _layout은 이미 같은 처리를 한다.)
 */
export function useCreateWorkspace() {
  const qc = useQueryClient();
  const setActive = useWorkspaceStore((s) => s.setActive);
  return useMutation({
    mutationFn: (name: string) => createWorkspace(name),
    onSuccess: (res) => {
      if (res?.workspaceId != null) setActive(res.workspaceId);
      qc.invalidateQueries(); // 워크스페이스 스코프 데이터 전체 갱신
      toast.success('워크스페이스를 만들었어요');
    },
  });
}

export function useJoinWorkspace() {
  const qc = useQueryClient();
  const setActive = useWorkspaceStore((s) => s.setActive);
  return useMutation({
    mutationFn: (inviteCode: string) => joinWorkspace(inviteCode),
    onSuccess: (res) => {
      if (res?.workspaceId != null) setActive(res.workspaceId);
      qc.invalidateQueries();
      toast.success(`"${res?.workspaceName ?? '워크스페이스'}"에 참여했어요`);
    },
  });
}

export function useUpdateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, workspaceName }: { id: number; workspaceName: string }) =>
      updateWorkspace(id, workspaceName),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspaces', 'my'] });
      toast.success('저장했어요');
    },
  });
}

export function useDeleteWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteWorkspace(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspaces', 'my'] });
      toast.success('워크스페이스를 삭제했어요');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '워크스페이스를 삭제하지 못했어요'),
  });
}

export function useLeaveWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => leaveWorkspace(id),
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '워크스페이스에서 나가지 못했어요'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspaces', 'my'] });
      toast.success('워크스페이스에서 나갔어요');
    },
  });
}

export function useTransferOwner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, targetUserId }: { id: number; targetUserId: number }) =>
      transferOwner(id, targetUserId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspaces'] });
      toast.success('소유권을 넘겼어요');
    },
  });
}

export function useChangeMemberRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, userId, role }: { id: number; userId: number; role: string }) =>
      changeMemberRole(id, userId, role),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['workspaces', v.id, 'members'] });
      qc.invalidateQueries({ queryKey: ['workspaces', 'my'] });
      toast.success('역할을 변경했어요');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '역할을 변경하지 못했어요'),
  });
}

export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, userId }: { id: number; userId: number }) => removeMember(id, userId),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['workspaces', v.id, 'members'] });
      qc.invalidateQueries({ queryKey: ['workspaces', 'my'] });
      toast.success('멤버를 내보냈어요');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '멤버를 내보내지 못했어요'),
  });
}

export function useUploadWorkspaceIcon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: number; file: { uri: string; name: string; type: string } }) =>
      uploadWorkspaceIcon(id, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspaces', 'my'] });
      toast.success('이미지를 변경했어요');
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.message ?? '이미지를 변경하지 못했어요');
    },
  });
}
