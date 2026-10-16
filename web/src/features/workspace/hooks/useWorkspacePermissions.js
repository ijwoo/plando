import { useMemo } from "react";
import { useWorkspace } from "../context/WorkspaceContext.jsx";
import { getUser } from "../../../shared/utils/tokenUtils.js";

/** 4단계 역할 서열 — 모바일 permissions.ts와 동일 규칙. */
export const ROLE_RANK = { OWNER: 3, ADMIN: 2, MEMBER: 1, VIEWER: 0 };

export const ROLE_LABEL = {
    OWNER: "소유자",
    ADMIN: "관리자",
    MEMBER: "멤버",
    VIEWER: "뷰어",
};

/**
 * 이메일 동일인 판정 — 서버(PermissionService.isSameUser)가 equalsIgnoreCase 라서
 * 여기서도 대소문자를 무시한다. 대문자로 가입한 계정이 자기 글 삭제 버튼을 못 보던
 * 어긋남을 없애기 위함.
 */
const sameEmail = (a, b) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

/** 내 역할 기반 권한 판정. 최종 강제는 서버(PermissionService)이며, 여기선 UI 게이팅용. */
export function useWorkspacePermissions() {
    const { currentWorkspace } = useWorkspace();
    const role = currentWorkspace?.role ?? "VIEWER";
    const myEmail = getUser()?.email ?? null;

    return useMemo(() => {
        const rank = ROLE_RANK[role] ?? 0;
        const atLeast = (r) => rank >= (ROLE_RANK[r] ?? 0);
        return {
            role,
            myEmail,
            isOwner: role === "OWNER",
            // 내용 편집(생성·수정) = MEMBER 이상 (VIEWER 차단)
            canEditContent: atLeast("MEMBER"),
            // 개별 할 일 편집(수정·상태·보관·복원) = MEMBER 이상 + 샘플 차단.
            // 서버 requireCanEditTodo와 같은 규칙 — 샘플은 역할과 무관하게 읽기 전용(403)이라
            // 역할만 보고 버튼을 띄우면 관리자에게도 눌리기만 하고 실패하는 컨트롤이 된다.
            canEditTodo: (todo) => atLeast("MEMBER") && !todo?.isSample,
            // 삭제 = 작성자 본인 || ADMIN 이상 (샘플은 역할 무관 불가)
            canDeleteTodo: (todo) => {
                // 서버 requireCanDeleteTodo가 샘플이면 역할을 보기도 전에 403을 던진다
                if (todo?.isSample) return false;
                if (atLeast("ADMIN")) return true;
                /* 작성자 이메일은 TodoResponseDto의 `userEmail` 하나뿐이다.
                   createdBy.email / authorEmail / creatorEmail은 응답에 아예 없는 필드라
                   항상 undefined → sameEmail이 언제나 false였고, 그래서 MEMBER는 자기가
                   만든 할 일에서도 삭제 버튼을 볼 수 없었다(서버는 허용하는데 UI가 숨김). */
                return sameEmail(myEmail, todo?.userEmail);
            },
            // 프로젝트 삭제 = 작성자 본인 || ADMIN 이상 (PermissionService.requireCanDeleteProject).
            // createdByEmail이 null인 프로젝트(샘플 데이터)는 "작성자가 없다"는 뜻이라 본인 판정이
            // 성립할 수 없다 → ADMIN 이상만 통과. 서버도 createdBy == null이면 isSameUser가 false다.
            // (null을 "내 것"으로 봐주면 멤버가 지울 수 있는 척하다 403을 맞는다)
            canDeleteProject: (project) => {
                if (atLeast("ADMIN")) return true;
                return sameEmail(myEmail, project?.createdByEmail);
            },
            // 멤버 관리(역할 변경·강퇴) = ADMIN 이상
            canManageMembers: atLeast("ADMIN"),
            // 특정 대상 멤버를 관리할 수 있나 = 내가 대상보다 상위 서열
            canManageMember: (targetRole) => rank > (ROLE_RANK[targetRole] ?? 0),
            // 워크스페이스 설정(이름·아이콘 등) = ADMIN 이상
            canManageWorkspace: atLeast("ADMIN"),
            atLeast,
        };
    }, [role, myEmail]);
}
