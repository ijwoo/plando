package com.example.todo.repository;

import com.example.todo.entity.Tag;
import com.example.todo.entity.Workspace;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TagRepository extends JpaRepository<Tag, Long> {

    List<Tag> findByWorkspaceOrderByNameAsc(Workspace workspace);

    Optional<Tag> findByWorkspaceAndNameIgnoreCase(Workspace workspace, String name);

    Optional<Tag> findByIdAndWorkspace(Long id, Workspace workspace);

    /**
     * 통합 검색용 — 태그 이름 부분일치. 이름 시작일치를 먼저 보여준다.
     * 태그로 검색해 들어와 그 태그가 붙은 할 일을 보는 흐름(목록의 태그 필터로 이어짐)을 위한 것.
     */
    @org.springframework.data.jpa.repository.Query("""
        select t from Tag t
        where t.workspace = :workspace
          and lower(t.name) like lower(concat('%', :keyword, '%'))
        order by
          case when lower(t.name) like lower(concat(:keyword, '%')) then 0 else 1 end,
          t.name asc
    """)
    List<Tag> searchByKeyword(
            @org.springframework.data.repository.query.Param("workspace") Workspace workspace,
            @org.springframework.data.repository.query.Param("keyword") String keyword
    );

    /** 태그별 미아카이브 할 일 수 — 검색 결과에 규모를 함께 보여주기 위함 */
    @org.springframework.data.jpa.repository.Query("""
        select tt.tagId, count(tt)
        from TodoTag tt, Todo td
        where tt.todoId = td.id
          and td.archived = false
          and tt.tagId in :tagIds
        group by tt.tagId
    """)
    List<Object[]> countTodosByTagIds(
            @org.springframework.data.repository.query.Param("tagIds") java.util.Collection<Long> tagIds
    );


    // 게스트 정리: 게스트가 생성한(created_by) 태그 id 목록.
    // 시드 태그는 created_by 가 null 이라 걸리지 않는다 — 체험 데이터는 보존된다.
    @org.springframework.data.jpa.repository.Query("SELECT t.id FROM Tag t WHERE t.createdBy.email IN :emails")
    List<Long> findGuestTagIds(
            @org.springframework.data.repository.query.Param("emails") List<String> emails
    );
}
