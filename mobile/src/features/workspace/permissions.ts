import { useMemo } from 'react';

import { useMe } from '@/features/auth/queries';
import { useMyWorkspaces } from '@/features/workspace/queries';
import { useWorkspaceStore } from '@/shared/store/workspaceStore';

/**
 * 워크스페이스 RBAC 권한 훅 (백엔드 PermissionService와 동일 기준).
 *  - 편집(생성·수정·완료·이동) = 역할(MEMBER 이상). 작성자/담당자 무관(협업).
 *  - 삭제 = 작성자 본인 || ADMIN 이상.
 *  - 관리(멤버·설정) = ADMIN 이상.
 *  - VIEWER = 읽기 + 코멘트만.
 * 역할을 아직 모를 때(로딩)는 잠그지 않고 서버 403 폴백에 맡긴다(관대).
 * UI 게이팅용일 뿐 — 실제 강제는 항상 서버가 한다.
 */
export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

const RANK: Record<WorkspaceRole, number> = { OWNER: 3, ADMIN: 2, MEMBER: 1, VIEWER: 0 };

const ROLE_LABEL: Record<WorkspaceRole, string> = {
  OWNER: '소유자',
  ADMIN: '관리자',
  MEMBER: '멤버',
  VIEWER: '뷰어',
};

/**
 * 역할 한국어 라벨. 역할을 보여주는 곳은 모두 이걸 쓴다 —
 * 화면마다 "OWNER면 소유자, 아니면 멤버"로 줄여 쓰다가 관리자·뷰어가 '멤버'로 보였다.
 */
export function roleLabel(role?: string | null): string {
  return ROLE_LABEL[role as WorkspaceRole] ?? ROLE_LABEL.MEMBER;
}

type TodoLike = { userEmail?: string | null; isSample?: boolean | null } | null | undefined;
type OwnedLike = { createdByEmail?: string | null } | null | undefined;

export function useWorkspacePermissions() {
  const activeId = useWorkspaceStore((s) => s.activeId);
  const { data: workspaces } = useMyWorkspaces();
  const { data: me } = useMe();
  const myEmail = me?.email ?? null;

  return useMemo(() => {
    const ws = workspaces?.find((w) => w.workspaceId === activeId) ?? workspaces?.[0];
    const role = ws?.role as WorkspaceRole | undefined;
    const rank = role ? RANK[role] : undefined;
    const known = rank !== undefined;
    const isAuthor = (t: TodoLike | OwnedLike, field: 'userEmail' | 'createdByEmail') =>
      !!myEmail && !!t && (t as Record<string, unknown>)[field] === myEmail;

    return {
      role,
      myEmail,
      isViewer: role === 'VIEWER',
      isAdmin: known && (rank as number) >= RANK.ADMIN,
      isOwner: role === 'OWNER',
      /** 콘텐츠 편집·생성 (MEMBER 이상). 로딩 중이면 허용(서버 폴백). */
      canEditContent: !known || (rank as number) >= RANK.MEMBER,
      /** 멤버 초대·역할변경·강퇴 (ADMIN 이상). */
      canManageMembers: known && (rank as number) >= RANK.ADMIN,
      /** 워크스페이스 이름·아이콘·설정 (ADMIN 이상). */
      canManageWorkspace: known && (rank as number) >= RANK.ADMIN,
      /** 할 일 삭제 = 작성자 본인 || ADMIN 이상. */
      canDeleteTodo: (todo: TodoLike) =>
        !known || (rank as number) >= RANK.ADMIN || isAuthor(todo, 'userEmail'),
      /** 프로젝트 삭제 = 작성자 본인 || ADMIN 이상. */
      canDeleteProject: (project: OwnedLike) =>
        !known || (rank as number) >= RANK.ADMIN || isAuthor(project, 'createdByEmail'),
      /** 이 사용자가 대상 멤버(targetRole)를 관리(역할변경·강퇴)할 수 있나 — 자신보다 하위만. */
      canManageMember: (targetRole: WorkspaceRole) =>
        known && role !== 'VIEWER' && role !== 'MEMBER'
          ? role === 'OWNER'
            ? targetRole !== 'OWNER'
            : (rank as number) > RANK[targetRole] // ADMIN: 하위만
          : false,
    };
  }, [workspaces, activeId, myEmail]);
}
