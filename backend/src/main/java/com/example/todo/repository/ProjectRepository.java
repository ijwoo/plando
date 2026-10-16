package com.example.todo.repository;

import com.example.todo.entity.Project;
import com.example.todo.entity.Workspace;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ProjectRepository extends JpaRepository<Project, Long> {

    List<Project> findByWorkspaceOrderByIdAsc(Workspace workspace);

    /** 통합 검색용 — 이름 부분일치. 이름 시작일치를 먼저 보여준다. */
    @org.springframework.data.jpa.repository.Query("""
        select p from Project p
        where p.workspace = :workspace
          and lower(p.name) like lower(concat('%', :keyword, '%'))
        order by
          case when lower(p.name) like lower(concat(:keyword, '%')) then 0 else 1 end,
          p.name asc
    """)
    List<Project> searchByKeyword(
            @org.springframework.data.repository.query.Param("workspace") Workspace workspace,
            @org.springframework.data.repository.query.Param("keyword") String keyword
    );

    Optional<Project> findByIdAndWorkspace(Long id, Workspace workspace);

    // 게스트 정리: 게스트가 생성한(created_by) 프로젝트 id 목록.
    // 샘플 워크스페이스는 삭제되지 않아 그 안의 게스트 프로젝트가 누적되므로 created_by 기준으로 직접 수거.
    @Query("SELECT p.id FROM Project p WHERE p.createdBy.email IN :emails")
    List<Long> findGuestProjectIds(@Param("emails") List<String> emails);
}
