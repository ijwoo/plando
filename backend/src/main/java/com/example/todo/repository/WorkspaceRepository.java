package com.example.todo.repository;

import com.example.todo.entity.Workspace;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface WorkspaceRepository extends JpaRepository<Workspace, Long> {
    Optional<Workspace> findByInviteCode(String inviteCode);
    boolean existsByInviteCode(String inviteCode);

    /**
     * 게스트가 OWNER인 비샘플 워크스페이스 — cleanup 시 cascade 삭제 대상.
     * isSample=true 데모 워크스페이스는 제외 (영구 유지).
     */
    @Query("""
        SELECT DISTINCT w FROM Workspace w
        JOIN w.members m
        WHERE m.user.email IN :emails
          AND m.role = com.example.todo.entity.WorkspaceRole.OWNER
          AND w.isSample = false
        """)
    List<Workspace> findGuestOwnedNonSampleWorkspaces(@Param("emails") List<String> emails);
}