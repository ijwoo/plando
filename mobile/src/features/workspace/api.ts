import { api } from '@/api/client';
import type { Schemas } from '@/api/types';

export type WorkspaceSummary = Schemas['WorkspaceSummaryResponse'];

/** 내가 속한 워크스페이스 목록 */
export async function getMyWorkspaces(): Promise<WorkspaceSummary[]> {
  const { data } = await api.get<WorkspaceSummary[]>('/api/workspaces/my');
  return data;
}

export type WorkspaceMember = Schemas['WorkspaceMemberResponse'];

/** 워크스페이스 멤버 목록 (담당자 선택 등) */
export async function getMembers(workspaceId: number): Promise<WorkspaceMember[]> {
  const { data } = await api.get<WorkspaceMember[]>(`/api/workspaces/${workspaceId}/members`);
  return data;
}

export type WorkspaceAction = Schemas['WorkspaceActionResponse'];

/** 워크스페이스 생성 (생성자가 OWNER) */
export async function createWorkspace(name: string): Promise<WorkspaceAction> {
  const { data } = await api.post<WorkspaceAction>('/api/workspaces', { name });
  return data;
}

/** 초대 코드로 워크스페이스 참여 */
export async function joinWorkspace(inviteCode: string): Promise<WorkspaceAction> {
  const { data } = await api.post<WorkspaceAction>('/api/workspaces/join', { inviteCode });
  return data;
}

/** 워크스페이스 이름 변경 (OWNER) */
export async function updateWorkspace(id: number, workspaceName: string): Promise<WorkspaceAction> {
  const { data } = await api.patch<WorkspaceAction>(`/api/workspaces/${id}`, { workspaceName });
  return data;
}

/** 워크스페이스 삭제 (OWNER) */
export async function deleteWorkspace(id: number): Promise<void> {
  await api.delete(`/api/workspaces/${id}`);
}

/** 삭제 전 확인 — 이 워크스페이스에 딸린 팀모집글이 있는지 (웹 checkHasRecruitments 미러) */
export async function hasRecruitments(id: number): Promise<boolean> {
  try {
    const { data } = await api.get<{ hasRecruitments: boolean }>(`/api/workspaces/${id}/has-recruitments`);
    return !!data?.hasRecruitments;
  } catch {
    return false; // 확인 실패 시 삭제를 막지 않음(웹과 동일)
  }
}

/** 워크스페이스 나가기 */
export async function leaveWorkspace(id: number): Promise<void> {
  await api.delete(`/api/workspaces/${id}/leave`);
}

/** 소유권 이전 (OWNER → 대상 멤버) */
export async function transferOwner(id: number, targetUserId: number): Promise<void> {
  await api.patch(`/api/workspaces/${id}/transfer-owner`, { targetUserId });
}

/** 멤버 역할 변경 (ADMIN 이상). role: OWNER 제외한 ADMIN|MEMBER|VIEWER. */
export async function changeMemberRole(id: number, userId: number, role: string): Promise<void> {
  await api.patch(`/api/workspaces/${id}/members/${userId}/role`, { role });
}

/** 멤버 강퇴 (ADMIN 이상, OWNER·본인 불가). */
export async function removeMember(id: number, userId: number): Promise<void> {
  await api.delete(`/api/workspaces/${id}/members/${userId}`);
}

/** 워크스페이스 아이콘(이미지) 업로드 (multipart). RN 파일 형식 {uri,name,type}. */
export async function uploadWorkspaceIcon(
  id: number,
  file: { uri: string; name: string; type: string },
): Promise<{ iconImageUrl?: string }> {
  const form = new FormData();
  form.append('file', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
  const { data } = await api.post<{ iconImageUrl?: string }>(`/api/workspaces/${id}/icon`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}
