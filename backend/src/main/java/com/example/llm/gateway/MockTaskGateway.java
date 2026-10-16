package com.example.llm.gateway;

import com.example.llm.domain.Task;
import com.example.llm.domain.TaskPatch;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Component
@Profile("mock")
public class MockTaskGateway implements TaskGateway {

    private final Map<String, Task> store = new ConcurrentHashMap<>();
    private int seq = 1;

    public MockTaskGateway() {
        create(sample("P-1", "로그인 버그 재현",    "TODO",        "HIGH",   LocalDate.now().plusDays(1), "U-1"));
        create(sample("P-1", "대시보드 위젯 정리",  "IN_PROGRESS", "MEDIUM", LocalDate.now().plusDays(3), "U-1"));
        create(sample("P-1", "알림 기능 기획",      "TODO",        "LOW",    null,                        "U-2"));
    }

    private Task sample(String projectId, String title, String status, String priority,
                        LocalDate due, String assignee) {
        Task t = new Task();
        t.projectId  = projectId;
        t.title      = title;
        t.status     = status;
        t.priority   = priority;
        t.dueDate    = due;
        t.assigneeId = assignee;
        t.description = "";
        return t;
    }

    @Override
    public List<Task> search(String query, String status, String priority,
                             String assigneeId, LocalDate dueDate, int limit) {
        return store.values().stream()
                .filter(t -> query    == null || query.isBlank()    || (t.title != null && t.title.contains(query)))
                .filter(t -> status   == null || status.isBlank()   || status.equalsIgnoreCase(t.status))
                .filter(t -> priority == null || priority.isBlank() || priority.equalsIgnoreCase(t.priority))
                .filter(t -> assigneeId == null || assigneeId.isBlank() || assigneeId.equalsIgnoreCase(t.assigneeId))
                .filter(t -> dueDate == null || dueDate.equals(t.dueDate))
                .sorted(Comparator.comparing((Task t) -> t.dueDate == null ? LocalDate.MAX : t.dueDate))
                .limit(Math.max(1, limit))
                .collect(Collectors.toList());
    }

    @Override
    public Task create(Task task) {
        String id = "T-" + (seq++);
        task.id = id;
        if (task.status   == null) task.status   = "TODO";
        if (task.priority == null) task.priority = "MEDIUM";
        store.put(id, task);
        return task;
    }

    @Override
    public Task update(String taskId, TaskPatch patch) {
        Task cur = store.get(taskId);
        if (cur == null) throw new com.example.todo.exception.ApiException(404, "할 일을 찾을 수 없습니다: " + taskId);

        if (patch.title       != null) cur.title       = patch.title;
        if (patch.description != null) cur.description = patch.description;
        if (patch.status      != null) cur.status      = patch.status;
        if (patch.priority    != null) cur.priority    = patch.priority;
        if (patch.assigneeId  != null) cur.assigneeId  = patch.assigneeId;
        if (patch.clearDueDate)        cur.dueDate     = null;
        else if (patch.dueDate != null) cur.dueDate    = patch.dueDate;
        if (patch.clearStartAt)        cur.startAt     = null;
        else if (patch.startAt != null) cur.startAt    = patch.startAt;

        return cur;
    }

    @Override
    public boolean delete(String taskId) {
        return store.remove(taskId) != null;
    }

    @Override
    public Task getById(String taskId) {
        return store.get(taskId);
    }
}
