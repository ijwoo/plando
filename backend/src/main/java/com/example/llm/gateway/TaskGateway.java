package com.example.llm.gateway;

import com.example.llm.domain.Task;
import com.example.llm.domain.TaskPatch;

import java.time.LocalDate;
import java.util.List;

public interface TaskGateway {

    List<Task> search(String query, String status, String priority,
                      String assigneeId, LocalDate dueDate, int limit);

    Task create(Task task);

    Task update(String taskId, TaskPatch patch);

    boolean delete(String taskId);

    Task getById(String taskId);

    /** 기한이 지난 일정 조회. 구현체가 없으면 빈 목록 반환. */
    /** 기간 조회. 지원하지 않는 구현(목 등)은 빈 결과를 돌려준다. */
    default List<Task> searchRange(java.time.LocalDate from, java.time.LocalDate to,
                                   String status, String priority, String assigneeId, int limit) {
        return List.of();
    }

    default List<Task> searchOverdue(int limit) {
        return List.of();
    }
}
