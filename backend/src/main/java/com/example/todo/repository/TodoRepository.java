package com.example.todo.repository;

import com.example.todo.entity.Priority;
import com.example.todo.entity.Todo;
import com.example.todo.entity.Workspace;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

public interface TodoRepository extends JpaRepository<Todo, Long> {

    /** 오프라인 재전송 중복 방지 — 같은 열쇠가 이미 있으면 새로 만들지 않는다. */
    java.util.Optional<Todo> findByWorkspaceAndClientKey(com.example.todo.entity.Workspace workspace, String clientKey);


    // 워크스페이스 전체 목록 (비아카이브)
    List<Todo> findByWorkspaceAndArchivedFalseOrderByIdDesc(Workspace workspace);

    // 목록/캘린더용: JOIN FETCH로 N+1 방지.
    // convertToDto가 assignees·createdBy·project를 모두 건드리는데 셋 다 LAZY라 행마다 SELECT가 나갔다.
    // assignees는 @ManyToMany라 조인 결과 행이 담당자 수만큼 불어나므로 DISTINCT 필수(ManyToOne 둘은 안 불어난다).
    @Query("""
        SELECT DISTINCT t FROM Todo t
        LEFT JOIN FETCH t.assignees
        LEFT JOIN FETCH t.createdBy
        LEFT JOIN FETCH t.project
        WHERE t.workspace = :workspace
          AND t.archived = false
        ORDER BY t.id DESC
    """)
    List<Todo> findByWorkspaceAndArchivedFalseWithAssignees(@Param("workspace") Workspace workspace);

    // 아카이브된 목록
    List<Todo> findByWorkspaceAndArchivedTrueOrderByIdDesc(Workspace workspace);

    // 최근 작업 (비아카이브)
    List<Todo> findTop5ByWorkspaceAndArchivedFalseOrderByIdDesc(Workspace workspace);

    // 특정 날짜 작업 (startAt <= date <= dueDate 범위)
    @Query("""
        SELECT t FROM Todo t
        WHERE t.workspace = :workspace
          AND t.archived = false
          AND t.dueDate IS NOT NULL
          AND t.dueDate >= :date
          AND (t.startAt IS NULL OR t.startAt <= :date)
        ORDER BY t.dueDate ASC, t.id DESC
    """)
    List<Todo> findTodosForDate(
            @Param("workspace") Workspace workspace,
            @Param("date") LocalDate date
    );

    // 우선순위별 작업 (비아카이브)
    List<Todo> findByWorkspaceAndArchivedFalseAndPriorityOrderByIdDesc(Workspace workspace, Priority priority);

    // 상태별 작업 (비아카이브). status는 workflow_status의 key 문자열.
    /**
     * 담당자로 거른 조회.
     *
     * 메모리에서 거르면 안 된다 — 앞단이 최근 몇 건만 가져오면 그 안에 담당 건이 없을 때
     * "없어요" 라고 답하게 된다. 있는데 없다고 답하는 건 오류보다 나쁘다.
     */
    @Query("""
        SELECT DISTINCT t FROM Todo t
        JOIN FETCH t.assignees a
        WHERE t.workspace = :workspace
          AND t.archived = false
          AND LOWER(a.email) = LOWER(:email)
        ORDER BY t.id DESC
    """)
    List<Todo> findByWorkspaceAndAssigneeEmail(@Param("workspace") Workspace workspace,
                                               @Param("email") String email);

    List<Todo> findByWorkspaceAndArchivedFalseAndStatusOrderByIdDesc(Workspace workspace, String status);

    // 다가오는 일정 (비아카이브)
    List<Todo> findByWorkspaceAndArchivedFalseAndDueDateGreaterThanEqualOrderByDueDateAsc(
            Workspace workspace,
            LocalDate dueDate
    );

    /**
     * 통합 검색용 — 관련도 정렬 + DB 레벨 페이징.
     *
     * 예전 검색은 `order by t.id desc` 로 전부 가져온 뒤 서비스에서 `.stream().limit(20)` 했다.
     * 그래서 최근 20건 밖의 항목은 제목을 정확히 쳐도 결과에 못 들어왔고, 워크스페이스 전체를
     * 메모리에 올리는 비용도 그대로 냈다. 검색은 "오래된 것을 찾는" 기능이라 이 동작은 목적과 반대다.
     *
     * 정렬: 제목 완전일치 → 시작일치 → 부분일치 → 본문일치 → 태그명만 일치, 그다음 미아카이브 우선·최신순.
     * 태그명도 매칭한다 — '긴급'으로 검색하면 그 태그가 붙은 할 일이 나와야 한다(제목엔 그 말이 없어도).
     * 아카이브도 포함한다 — 오래된 항목은 대개 아카이브에 있는데 예전엔 검색 대상이 아니었다.
     */
    @Query("""
        select t
        from Todo t
        where t.workspace = :workspace
          and (:includeArchived = true or t.archived = false)
          and (
                lower(t.title) like lower(concat('%', :keyword, '%'))
                or lower(coalesce(t.content, '')) like lower(concat('%', :keyword, '%'))
                or exists (
                     select 1 from TodoTag tt, Tag tg
                     where tt.todoId = t.id and tg.id = tt.tagId
                       and tg.workspace = :workspace
                       and lower(tg.name) like lower(concat('%', :keyword, '%'))
                   )
              )
        order by
          case
            when lower(t.title) = lower(:keyword) then 0
            when lower(t.title) like lower(concat(:keyword, '%')) then 1
            when lower(t.title) like lower(concat('%', :keyword, '%')) then 2
            when lower(coalesce(t.content, '')) like lower(concat('%', :keyword, '%')) then 3
            else 4
          end,
          case when t.archived = true then 1 else 0 end,
          t.id desc
    """)
    List<Todo> searchRanked(
            @Param("workspace") Workspace workspace,
            @Param("keyword") String keyword,
            @Param("includeArchived") boolean includeArchived,
            org.springframework.data.domain.Pageable pageable
    );

    /** 프로젝트의 미완료 할 일 수 — 검색 결과에 규모를 같이 보여주기 위함 */
    long countByProjectAndArchivedFalseAndDoneAtIsNull(com.example.todo.entity.Project project);

    // 워크스페이스 전체 검색 (비아카이브)
    @Query("""
        select t
        from Todo t
        where t.workspace = :workspace
          and t.archived = false
          and (
                :keyword is null or :keyword = ''
                or lower(t.title) like lower(concat('%', :keyword, '%'))
                or lower(coalesce(t.content, '')) like lower(concat('%', :keyword, '%'))
              )
        order by t.id desc
    """)
    List<Todo> searchByWorkspaceAndKeyword(
            @Param("workspace") Workspace workspace,
            @Param("keyword") String keyword
    );

    // 워크스페이스 전체 검색 + 날짜 (비아카이브)
    @Query("""
        select t
        from Todo t
        where t.workspace = :workspace
          and t.archived = false
          and t.dueDate = :dueDate
          and (
                lower(t.title) like lower(concat('%', :keyword, '%'))
                or lower(coalesce(t.content, '')) like lower(concat('%', :keyword, '%'))
              )
        order by t.id desc
    """)
    List<Todo> searchByWorkspaceAndKeywordAndDueDate(
            @Param("workspace") Workspace workspace,
            @Param("keyword") String keyword,
            @Param("dueDate") LocalDate dueDate
    );

    // 지연 작업 (비아카이브)
    @Query("""
        select t
        from Todo t
        where t.workspace = :workspace
          and t.archived = false
          and t.dueDate is not null
          and t.dueDate < :today
          and t.doneAt is null
        order by t.dueDate asc, t.id desc
    """)
    List<Todo> findOverdueTodosByWorkspace(
            @Param("workspace") Workspace workspace,
            @Param("today") LocalDate today
    );

    // 대시보드 통계: 상태별 카운트 (비아카이브)
    @Query("SELECT t.status, COUNT(t) FROM Todo t WHERE t.workspace = :workspace AND t.archived = false GROUP BY t.status")
    List<Object[]> countByStatusGrouped(@Param("workspace") Workspace workspace);

    // 대시보드 통계: 우선순위별 카운트 (비아카이브)
    @Query("SELECT t.priority, COUNT(t) FROM Todo t WHERE t.workspace = :workspace AND t.archived = false GROUP BY t.priority")
    List<Object[]> countByPriorityGrouped(@Param("workspace") Workspace workspace);

    // 대시보드 통계: 기간 내 마감일별 카운트 (비아카이브)
    @Query("SELECT t.dueDate, COUNT(t) FROM Todo t WHERE t.workspace = :workspace AND t.archived = false AND t.dueDate BETWEEN :start AND :end GROUP BY t.dueDate")
    List<Object[]> countByDueDateBetween(
            @Param("workspace") Workspace workspace,
            @Param("start") LocalDate start,
            @Param("end") LocalDate end
    );

    // 지도 탭: 위치가 등록된 Todo 목록 (비아카이브)
    List<Todo> findByWorkspaceAndArchivedFalseAndLocationLatIsNotNullOrderByIdDesc(Workspace workspace);

    // 완료(doneAt!=null) 전체 — 일괄 보관용. 카테고리 무관 완료 판정(커스텀 완료 상태 포함).
    List<Todo> findByWorkspaceAndArchivedFalseAndDoneAtIsNotNullOrderByIdDesc(Workspace workspace);

    // 자동 아카이브 스케줄러: 완료(doneAt!=null) 후 N일 경과한 항목. doneAt<threshold라 null은 자동 제외.
    List<Todo> findByArchivedFalseAndDoneAtBefore(LocalDateTime threshold);

    // 샘플 데이터
    void deleteByWorkspaceAndCreatedByEmailAndIsSampleTrue(Workspace workspace, String email);

    boolean existsByWorkspaceAndCreatedByEmailAndIsSampleTrue(Workspace workspace, String email);

    // DM 관련 할 일: 두 사용자가 함께 담당자인 할 일 (비아카이브)
    @Query("SELECT DISTINCT t FROM Todo t JOIN t.assignees a1 JOIN t.assignees a2 WHERE t.workspace = :workspace AND t.archived = false AND a1.id = :userId1 AND a2.id = :userId2 ORDER BY t.id DESC")
    List<Todo> findSharedTodos(
            @Param("workspace") Workspace workspace,
            @Param("userId1") Long userId1,
            @Param("userId2") Long userId2
    );

    // 마감일 알림 스케줄러: 특정 날짜가 마감일이고 완료되지 않은 Todo (담당자 포함)
    @Query("""
        SELECT DISTINCT t FROM Todo t
        JOIN FETCH t.assignees a
        WHERE t.dueDate = :dueDate
          AND t.doneAt is null
    """)
    List<Todo> findByDueDateAndNotDone(
            @Param("dueDate") LocalDate dueDate
    );

    // 게스트 정리: 삭제 대상 todo ID 조회
    @Query("SELECT t.id FROM Todo t WHERE t.createdBy.email IN :emails AND t.isSample = false AND t.createdAt < :threshold")
    List<Long> findGuestTodoIdsOlderThan(@Param("emails") List<String> emails, @Param("threshold") LocalDateTime threshold);

    /** 시간 제한 없이 게스트가 만든 비샘플 Todo ID 전부 — 로그인 시 cleanup용 */
    @Query("SELECT t.id FROM Todo t WHERE t.createdBy.email IN :emails AND t.isSample = false")
    List<Long> findAllGuestTodoIds(@Param("emails") List<String> emails);

    // 게스트 정리: todo_assignees 선행 삭제 (FK 제약 해소)
    @Modifying
    @Query(value = "DELETE FROM todo.todo_assignees WHERE todo_id IN :todoIds", nativeQuery = true)
    void deleteAssigneesByTodoIds(@Param("todoIds") List<Long> todoIds);

    // 게스트 정리: 게스트가 생성한 비샘플 Todo 중 24시간 지난 것 삭제
    @Modifying
    @Query("DELETE FROM Todo t WHERE t.id IN :todoIds")
    void deleteGuestTodosByIds(@Param("todoIds") List<Long> todoIds);

    // 게스트 정리: 삭제 예정 프로젝트를 참조하는 todo의 project_id를 null 처리 (FK 제약 해소)
    //  - 게스트가 샘플 todo를 자기 프로젝트로 옮겨둔 경우 등 비게스트 todo도 끊어줘야 함
    @Modifying
    @Query(value = "UPDATE todo.todo SET project_id = NULL WHERE project_id IN :projectIds", nativeQuery = true)
    void clearProjectByProjectIds(@Param("projectIds") List<Long> projectIds);

    // 반복 일정: 동일 recurrence에서 생성된 todo 목록
    List<Todo> findByRecurrenceSourceId(Long recurrenceSourceId);

    // 반복 일정: 특정 날짜 이후(this and following)
    List<Todo> findByRecurrenceSourceIdAndDueDateGreaterThanEqual(Long recurrenceSourceId, LocalDate date);

    // 회원 탈퇴 시: todo_assignees 조인 테이블에서 해당 유저 제거
    @Modifying
    @Query(value = "DELETE FROM todo.todo_assignees WHERE user_id = :userId", nativeQuery = true)
    void deleteAssigneesByUserId(@Param("userId") Long userId);

    // 회원 탈퇴 시: 남아있는 워크스페이스 할 일의 createdBy null 처리
    @Modifying
    @Query("UPDATE Todo t SET t.createdBy = null WHERE t.createdBy.id = :userId")
    void nullifyCreatedBy(@Param("userId") Long userId);

    // FocusMigrationRunner: legacy 워크스페이스-공유 focused boolean 이 true인 todo들
    List<Todo> findByFocusedTrue();

    /** AI 기간 조회용 — 보관된 것은 제외한다(사용자가 "이번주 할 일"이라 하면 살아 있는 것만 뜻한다). */
    List<Todo> findByWorkspaceAndArchivedFalseAndDueDateBetweenOrderByDueDateAsc(
            Workspace workspace, LocalDate from, LocalDate to);

    /**
     * 대시보드 "완료/기간 기반" 통계용. archived 무관하게 워크스페이스 + dueDate 범위로 조회.
     * (활성 워크로드 통계와 달리 자동 아카이브된 완료 항목도 통계에 포함되어야 사용자가 보상감을 느낄 수 있음)
     */
    @Query("""
        SELECT DISTINCT t FROM Todo t
        LEFT JOIN FETCH t.assignees
        WHERE t.workspace = :workspace
          AND t.dueDate IS NOT NULL
          AND t.dueDate BETWEEN :from AND :to
    """)
    List<Todo> findByWorkspaceAndDueDateBetweenIgnoreArchived(
            @Param("workspace") Workspace workspace,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to
    );

    /**
     * 프로젝트 목록의 카운트 집계 — [projectId, 전체 수, 완료 수].
     * 보관(archived)된 할 일은 제외.
     */
    @Query("""
        SELECT t.project.id, COUNT(t), SUM(CASE WHEN t.doneAt IS NOT NULL THEN 1 ELSE 0 END)
        FROM Todo t
        WHERE t.workspace = :workspace
          AND t.project IS NOT NULL
          AND (t.archived = false OR t.archived IS NULL)
        GROUP BY t.project.id
    """)
    List<Object[]> countTodosByProject(
            @Param("workspace") Workspace workspace
    );

    /** 프로젝트 삭제 시 소속 할 일을 인박스(project = null)로 이동 */
    @Modifying
    @Query("UPDATE Todo t SET t.project = null WHERE t.project = :project")
    int clearProject(@Param("project") com.example.todo.entity.Project project);

    // ─── 서브태스크 ───────────────────────────────────────────────

    /** 보관 상태별 자식 — 부모 보관/복원을 자식까지 전파할 때 사용 */
    List<Todo> findByParentIdInAndArchived(Collection<Long> parentIds, boolean archived);

    /**
     * 서브태스크 목록 — 보관된 자식은 뺀다(부모의 워크스페이스 검증은 호출부에서).
     * 목록 배지(countSubtasksByParentIds)가 보관을 제외하므로 여기서도 같은 기준이어야 한다.
     * 안 그러면 상세의 항목 수와 목록 배지 숫자가 서로 다르게 보인다.
     */
    List<Todo> findByParentIdAndArchivedFalseOrderByIdAsc(Long parentId);

    /** 자식 존재 여부 — 자식이 있는 할 일은 남의 서브태스크가 될 수 없음 */
    boolean existsByParentId(Long parentId);

    /**
     * 서브태스크 카운트 집계 — [parentId, 전체 수, 완료 수]. 목록 응답 N+1 방지용 일괄 조회.
     */
    @Query("""
        SELECT t.parentId, COUNT(t), SUM(CASE WHEN t.doneAt IS NOT NULL THEN 1 ELSE 0 END)
        FROM Todo t
        WHERE t.parentId IN :parentIds
          AND t.archived = false
        GROUP BY t.parentId
    """)
    List<Object[]> countSubtasksByParentIds(
            @Param("parentIds") Collection<Long> parentIds
    );

    /** 부모 삭제 시 자식들을 최상위로 승격 (parentId = null) */
    @Modifying
    @Query("UPDATE Todo t SET t.parentId = null WHERE t.parentId IN :parentIds")
    int promoteSubtasksOf(@Param("parentIds") Collection<Long> parentIds);

    // ── 커스텀 상태 재배정/doneAt 정합 (varchar status 컬럼 직접 — 네이티브) ──
    /** 상태 삭제 시 그 상태의 할 일을 다른 상태 key로 이동. */
    @Modifying
    @Query(value = "UPDATE todo.todo SET status = :newKey WHERE workspace_id = :workspaceId AND status = :oldKey", nativeQuery = true)
    int reassignStatus(@Param("workspaceId") Long workspaceId, @Param("oldKey") String oldKey, @Param("newKey") String newKey);

    /** 상태가 DONE 카테고리로 바뀐 경우 — doneAt 미설정분을 now로 백필. */
    @Modifying
    @Query(value = "UPDATE todo.todo SET done_at = now() WHERE workspace_id = :workspaceId AND status = :statusKey AND done_at IS NULL", nativeQuery = true)
    int setDoneAtForStatusIfNull(@Param("workspaceId") Long workspaceId, @Param("statusKey") String statusKey);

    /** 상태가 비완료 카테고리로 바뀐 경우 — doneAt 해제. */
    @Modifying
    @Query(value = "UPDATE todo.todo SET done_at = NULL WHERE workspace_id = :workspaceId AND status = :statusKey", nativeQuery = true)
    int clearDoneAtForStatus(@Param("workspaceId") Long workspaceId, @Param("statusKey") String statusKey);
}
