package com.example.todo.repository;

import com.example.todo.entity.TodoFocus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface TodoFocusRepository extends JpaRepository<TodoFocus, Long> {

    boolean existsByUserIdAndTodoId(Long userId, Long todoId);

    @Modifying
    @Query("DELETE FROM TodoFocus f WHERE f.userId = :userId AND f.todoId = :todoId")
    void deleteByUserIdAndTodoId(@Param("userId") Long userId, @Param("todoId") Long todoId);

    // GET /todos 응답 빌드 시 호출자 기준 focused todo id set을 한 번에 가져오기 위한 쿼리
    @Query("SELECT f.todoId FROM TodoFocus f WHERE f.userId = :userId AND f.todoId IN :todoIds")
    List<Long> findTodoIdsByUserIdAndTodoIdIn(@Param("userId") Long userId, @Param("todoIds") Collection<Long> todoIds);

    // 회원 탈퇴 시 정리
    @Modifying
    @Query("DELETE FROM TodoFocus f WHERE f.userId = :userId")
    void deleteByUserId(@Param("userId") Long userId);

    // Todo 삭제 시 정리
    @Modifying
    @Query("DELETE FROM TodoFocus f WHERE f.todoId = :todoId")
    void deleteByTodoId(@Param("todoId") Long todoId);
}
