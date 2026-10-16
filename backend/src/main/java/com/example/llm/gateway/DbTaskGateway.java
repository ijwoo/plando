package com.example.llm.gateway;

import com.example.llm.domain.Task;
import com.example.llm.domain.TaskPatch;
import com.example.llm.repo.TaskRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Primary;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

@Component
@Primary
@RequiredArgsConstructor
public class DbTaskGateway implements TaskGateway {

    private final TaskRepository repo;

    @Override
    public List<Task> search(String query, String status, String priority,
                             String assigneeId, LocalDate dueDate, int limit) {
        String userEmail = currentUserEmail();
        if (userEmail == null || userEmail.isBlank()) return List.of();

        return repo.search(userEmail, null, query, status, priority, assigneeId, dueDate, limit);
    }

    @Override
    public List<Task> searchRange(java.time.LocalDate from, java.time.LocalDate to,
                                  String status, String priority, String assigneeId, int limit) {
        String userEmail = SecurityContextHolder.getContext().getAuthentication().getName();
        return repo.searchRange(userEmail, from, to, status, priority, assigneeId, limit);
    }

    @Override
    public List<Task> searchOverdue(int limit) {
        String userEmail = currentUserEmail();
        if (userEmail == null || userEmail.isBlank()) return List.of();
        return repo.searchOverdue(userEmail, limit);
    }

    @Override
    public Task create(Task task) {
        if (task != null && (task.userEmail == null || task.userEmail.isBlank())) {
            task.userEmail = currentUserEmail();
        }
        return repo.create(task);
    }

    @Override
    public Task update(String taskId, TaskPatch patch) {
        Task existing = repo.findById(taskId)
                .orElseThrow(() -> new IllegalArgumentException("할 일을 찾을 수 없습니다: " + taskId));

        if (patch.title       != null) existing.title       = patch.title;
        if (patch.description != null) existing.description = patch.description;
        if (patch.status      != null) existing.status      = patch.status;
        if (patch.priority    != null) existing.priority    = patch.priority;
        if (patch.assigneeId  != null) existing.assigneeId  = patch.assigneeId;

        // 마감일
        if (patch.clearDueDate) {
            existing.dueDate     = null;
            existing.clearDueDate = true;
        } else if (patch.dueDate != null) {
            existing.dueDate = patch.dueDate;
        }

        // 시작일
        if (patch.clearStartAt) {
            existing.startAt     = null;
            existing.clearStartAt = true;
        } else if (patch.startAt != null) {
            existing.startAt = patch.startAt;
        }

        existing.userEmail = currentUserEmail();
        return repo.update(existing);
    }

    @Override
    public Task getById(String taskId) {
        return repo.findById(taskId).orElse(null);
    }

    @Override
    public boolean delete(String taskId) {
        return repo.deleteById(taskId, currentUserEmail());
    }

    private String currentUserEmail() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) return null;
        if ("anonymousUser".equals(auth.getName())) return null;
        return auth.getName();
    }
}
