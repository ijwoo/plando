package com.example.todo.service;

import com.example.todo.entity.Comment;
import com.example.todo.entity.Project;
import com.example.todo.entity.Todo;
import com.example.todo.entity.TodoAttachment;
import com.example.todo.entity.User;
import com.example.todo.entity.Workspace;
import com.example.todo.entity.WorkspaceMember;
import com.example.todo.entity.WorkspaceRole;
import com.example.todo.exception.ApiException;
import com.example.todo.repository.UserRepository;
import com.example.todo.repository.WorkspaceMemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 단일 권한 강제 지점 (RBAC). 모든 mutating 진입점이 이 서비스를 통과하게 해
 * 흩어져 있던 검사(작성자/담당자/OWNER 등)를 통일하고 PATCH 등의 우회 구멍을 봉쇄한다.
 *
 * 원칙(doc/design-permissions.md):
 *  - 편집(생성·수정·완료·이동) = 역할 기반(MEMBER 이상). 작성자/담당자와 무관(협업).
 *  - 삭제·관리 = 좁게. 삭제 = 작성자 본인 || ADMIN 이상. 담당자는 삭제 권한 없음.
 *  - VIEWER = 읽기 + 코멘트만.
 *  - 샘플(isSample) = 역할 무관 읽기 전용.
 *  - 실패 = 403 + 한국어 메시지.
 */
@Component
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PermissionService {

    private final UserRepository userRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;

    // ── 역할 조회 ──────────────────────────────────────────────

    private User user(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ApiException(404, "사용자를 찾을 수 없습니다."));
    }

    /** 워크스페이스에서 이 사용자의 역할. 멤버가 아니면 403. */
    public WorkspaceRole roleOf(String email, Workspace workspace) {
        User u = user(email);
        return workspaceMemberRepository.findByWorkspaceAndUser(workspace, u)
                .map(WorkspaceMember::getRole)
                .orElseThrow(() -> new ApiException(403, "해당 워크스페이스에 접근 권한이 없습니다."));
    }

    // ── 역할 게이트 ────────────────────────────────────────────

    /** 최소 역할(min) 이상 요구. 미만이면 403. */
    public void requireRole(String email, Workspace workspace, WorkspaceRole min) {
        if (!roleOf(email, workspace).atLeast(min)) {
            throw new ApiException(403, permissionMessage(min));
        }
    }

    /** 멤버(어떤 역할이든) 요구 — 조회/코멘트 등. VIEWER 포함. */
    public void requireMember(String email, Workspace workspace) {
        roleOf(email, workspace); // 멤버 아니면 위에서 403
    }

    /** 멤버 관리(초대·역할변경·강퇴) — ADMIN 이상. */
    public void requireCanManageMembers(String email, Workspace workspace) {
        requireRole(email, workspace, WorkspaceRole.ADMIN);
    }

    /** 워크스페이스 설정(이름·아이콘·상태정의) — ADMIN 이상. */
    public void requireCanManageWorkspace(String email, Workspace workspace) {
        requireRole(email, workspace, WorkspaceRole.ADMIN);
    }

    // ── 콘텐츠 편집 (MEMBER 이상, 샘플·VIEWER 차단) ─────────────

    /** 할 일 편집(수정·상태·우선순위·이동·보관·완료 등 모든 변경). MEMBER 이상 + 샘플 차단. */
    public void requireCanEditTodo(String email, Todo todo) {
        if (Boolean.TRUE.equals(todo.getIsSample())) {
            throw new ApiException(403, "샘플 할 일은 수정할 수 없습니다.");
        }
        requireRole(email, todo.getWorkspace(), WorkspaceRole.MEMBER);
    }

    /** 프로젝트 편집(수정). MEMBER 이상. */
    public void requireCanEditProject(String email, Project project) {
        requireRole(email, project.getWorkspace(), WorkspaceRole.MEMBER);
    }

    /** 워크스페이스 내 콘텐츠 생성(할 일·체크리스트·첨부 등). MEMBER 이상. */
    public void requireCanCreateContent(String email, Workspace workspace) {
        requireRole(email, workspace, WorkspaceRole.MEMBER);
    }

    // ── 삭제 (작성자 본인 || ADMIN 이상) ───────────────────────

    /**
     * 할 일 삭제 = 작성자 본인 || ADMIN 이상. 담당자는 삭제 불가.
     * 샘플은 수정은 계속 막지만 **삭제는 ADMIN 이상에게 허용**한다. 예전엔 역할 무관 전면 차단이라,
     * 샘플이 엉뚱한 워크스페이스에 만들어졌을 때 그 워크스페이스의 OWNER 조차 치울 방법이 없었다.
     */
    public void requireCanDeleteTodo(String email, Todo todo) {
        WorkspaceRole role = roleOf(email, todo.getWorkspace());
        if (Boolean.TRUE.equals(todo.getIsSample())) {
            if (role.atLeast(WorkspaceRole.ADMIN)) return;
            throw new ApiException(403, "샘플 할 일은 관리자만 삭제할 수 있습니다.");
        }
        if (role.atLeast(WorkspaceRole.ADMIN)) return;
        if (isSameUser(email, todo.getCreatedBy())) return;
        throw new ApiException(403, "작성자 또는 관리자만 삭제할 수 있습니다.");
    }

    /** 프로젝트 삭제 = 작성자 본인 || ADMIN 이상. */
    public void requireCanDeleteProject(String email, Project project) {
        WorkspaceRole role = roleOf(email, project.getWorkspace());
        if (role.atLeast(WorkspaceRole.ADMIN)) return;
        if (isSameUser(email, project.getCreatedBy())) return;
        throw new ApiException(403, "작성자 또는 관리자만 삭제할 수 있습니다.");
    }

    // ── 코멘트 (VIEWER 포함 작성 가능 / 삭제=본인||ADMIN) ───────

    /** 코멘트 작성 — 멤버 전원(VIEWER 포함). 부모 할 일의 워크스페이스로 판정. */
    public void requireCanComment(String email, Todo parentTodo) {
        requireMember(email, parentTodo.getWorkspace());
    }

    /** 코멘트 삭제 = 작성자 본인 || ADMIN 이상(모더레이션). */
    public void requireCanDeleteComment(String email, Comment comment, Todo parentTodo) {
        if (email != null && email.equalsIgnoreCase(comment.getWriterEmail())) return;
        if (roleOf(email, parentTodo.getWorkspace()).atLeast(WorkspaceRole.ADMIN)) return;
        throw new ApiException(403, "작성자 또는 관리자만 삭제할 수 있습니다.");
    }

    // ── 첨부 (업로드=MEMBER+ / 삭제=업로더||할일작성자||ADMIN) ──

    /** 첨부 삭제 = 업로더 본인 || 할 일 작성자 || ADMIN 이상. */
    public void requireCanDeleteAttachment(String email, TodoAttachment attachment, Todo parentTodo) {
        if (email != null && email.equalsIgnoreCase(attachment.getUploaderEmail())) return;
        WorkspaceRole role = roleOf(email, parentTodo.getWorkspace());
        if (role.atLeast(WorkspaceRole.ADMIN)) return;
        if (isSameUser(email, parentTodo.getCreatedBy())) return;
        throw new ApiException(403, "업로더 또는 관리자만 삭제할 수 있습니다.");
    }

    // ── helpers ────────────────────────────────────────────────

    private boolean isSameUser(String email, User owner) {
        return email != null && owner != null && email.equalsIgnoreCase(owner.getEmail());
    }

    private String permissionMessage(WorkspaceRole min) {
        return switch (min) {
            case OWNER -> "소유자만 할 수 있습니다.";
            case ADMIN -> "관리자 이상만 할 수 있습니다.";
            case MEMBER -> "읽기 전용 역할은 편집할 수 없습니다.";
            case VIEWER -> "해당 워크스페이스에 접근 권한이 없습니다.";
        };
    }
}
