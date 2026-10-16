package com.example.llm.repo;

import com.example.llm.domain.Task;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface TaskRepository {

    Task create(Task task);

    Optional<Task> findById(String taskId);

    List<Task> search(String userEmail, String projectId,
                      String keyword, String status, String priority,
                      String assigneeId, LocalDate dueDate, int limit);

    /** 기간 조회. "이번주"처럼 하루가 아닌 요청을 처리한다. */
    List<Task> searchRange(String userEmail, java.time.LocalDate from, java.time.LocalDate to,
                           String status, String priority, String assigneeId, int limit);

    List<Task> searchOverdue(String userEmail, int limit);

    Task update(Task task);

    boolean deleteById(String taskId, String userEmail);
}
