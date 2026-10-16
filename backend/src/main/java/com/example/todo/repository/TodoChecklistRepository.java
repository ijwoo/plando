package com.example.todo.repository;

import com.example.todo.entity.TodoChecklist;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Collection;
import java.util.List;

public interface TodoChecklistRepository extends JpaRepository<TodoChecklist, Long> {
    List<TodoChecklist> findByTodoIdOrderByOrderIndex(Long todoId);
    List<TodoChecklist> findByTodoIdInOrderByTodoIdAscOrderIndexAsc(Collection<Long> todoIds);
    void deleteByTodoId(Long todoId);
    void deleteByTodoIdIn(Collection<Long> todoIds);
    long countByTodoId(Long todoId);

    /**
     * 체크리스트 카운트 집계 — [todoId, 전체 수, 체크된 수]. 목록 응답 N+1 방지용 일괄 조회.
     */
    @Query("""
        SELECT c.todoId, COUNT(c), SUM(CASE WHEN c.checked = true THEN 1 ELSE 0 END)
        FROM TodoChecklist c
        WHERE c.todoId IN :todoIds
        GROUP BY c.todoId
    """)
    List<Object[]> countChecklistsByTodoIds(
            @Param("todoIds") Collection<Long> todoIds
    );
}
