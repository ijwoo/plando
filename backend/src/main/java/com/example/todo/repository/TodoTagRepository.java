package com.example.todo.repository;

import com.example.todo.entity.TodoTag;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface TodoTagRepository extends JpaRepository<TodoTag, Long> {

    List<TodoTag> findByTodoId(Long todoId);

    /** 리스트 응답 배치 조회 — 여러 할 일의 태그를 한 번에(N+1 방지). */
    List<TodoTag> findByTodoIdIn(Collection<Long> todoIds);

    void deleteByTodoId(Long todoId);

    void deleteByTodoIdAndTagId(Long todoId, Long tagId);

    void deleteByTagId(Long tagId);

    /** 게스트 정리 — 여러 태그의 부착 관계를 한 번에 */
    void deleteByTagIdIn(Collection<Long> tagIds);

    boolean existsByTodoIdAndTagId(Long todoId, Long tagId);
}
