package com.example.todo.repository;

import com.example.todo.entity.TodoRecurrence;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface TodoRecurrenceRepository extends JpaRepository<TodoRecurrence, Long> {
    List<TodoRecurrence> findAll();
    Optional<TodoRecurrence> findBySourceTodoId(Long sourceTodoId);
    void deleteBySourceTodoId(Long sourceTodoId);
    void deleteBySourceTodoIdIn(List<Long> sourceTodoIds);

    // 워크스페이스 내 todo ID 집합으로 필터링 (getTodos N+1 방지)
    List<TodoRecurrence> findBySourceTodoIdIn(Collection<Long> sourceTodoIds);

    // 스케줄러 최적화: 오늘 생성해야 할 활성 반복 일정만 조회
    @Query("SELECT r FROM TodoRecurrence r WHERE (r.endDate IS NULL OR r.endDate >= :today) AND r.lastGeneratedDate < :today")
    List<TodoRecurrence> findActiveForDate(@Param("today") LocalDate today);
}
