package com.example.todo.repository;

import com.example.todo.entity.User;
import com.example.todo.entity.Workspace;
import com.example.todo.entity.WorkspaceMember;
import com.example.todo.entity.WorkspaceRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface WorkspaceMemberRepository extends JpaRepository<WorkspaceMember, Long> {

    List<WorkspaceMember> findByUser(User user);

    List<WorkspaceMember> findByWorkspace(Workspace workspace);

    @Query("""
            SELECT wm FROM WorkspaceMember wm
            WHERE wm.workspace = :workspace
              AND (
                lower(coalesce(wm.user.name, ''))  LIKE lower(concat('%', :keyword, '%'))
                OR lower(wm.user.email) LIKE lower(concat('%', :keyword, '%'))
              )
            ORDER BY wm.role ASC, wm.user.name ASC
            """)
    List<WorkspaceMember> searchByKeyword(
            @Param("workspace") Workspace workspace,
            @Param("keyword") String keyword
    );

    Optional<WorkspaceMember> findByWorkspaceAndUser(Workspace workspace, User user);

    Optional<WorkspaceMember> findByWorkspaceAndRole(Workspace workspace, WorkspaceRole role);

    boolean existsByWorkspaceAndUser(Workspace workspace, User user);

    Optional<WorkspaceMember> findFirstByUserOrderByIdAsc(User user);

    Optional<WorkspaceMember> findFirstByUserAndRoleOrderByIdAsc(User user, WorkspaceRole role);

    List<WorkspaceMember> findByUserAndRole(User user, WorkspaceRole role);

    long countByUser(User user);

    /** 워크스페이스별 멤버 수 (모집 생성 시 현재 팀원수 자동 매핑용) */
    long countByWorkspace(Workspace workspace);

    /**
     * 게스트 멤버십 일괄 삭제 — cleanup용.
     * 단, isSample=true인 데모 워크스페이스는 제외 → 게스트가 demo 워크스페이스에 영구 멤버로 남음.
     */
    @Modifying
    @Query("DELETE FROM WorkspaceMember wm WHERE wm.user.email IN :emails AND wm.workspace.isSample = false")
    void deleteAllByUserEmails(@Param("emails") List<String> emails);
}