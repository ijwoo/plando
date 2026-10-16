package com.example.todo.repository;

import com.example.todo.entity.LocationTrigger;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface LocationTriggerRepository extends JpaRepository<LocationTrigger, Long> {
    List<LocationTrigger> findAllByUserIdAndWorkspaceId(Long userId, Long workspaceId);
    Optional<LocationTrigger> findByUserIdAndTodoIdAndWorkspaceId(Long userId, Long todoId, Long workspaceId);
    List<LocationTrigger> findAllByTodoId(Long todoId);
    void deleteAllByTodoId(Long todoId);
    void deleteAllByTodoIdIn(List<Long> todoIds);
}
