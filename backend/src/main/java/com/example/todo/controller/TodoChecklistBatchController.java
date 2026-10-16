package com.example.todo.controller;

import com.example.todo.dto.TodoChecklistResponse;
import com.example.todo.entity.Todo;
import com.example.todo.entity.Workspace;
import com.example.todo.exception.ApiException;
import com.example.todo.repository.TodoChecklistRepository;
import com.example.todo.repository.TodoRepository;
import com.example.todo.service.WorkspaceResolver;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/todos/checklists")
@RequiredArgsConstructor
public class TodoChecklistBatchController {

    private final TodoChecklistRepository checklistRepository;
    private final TodoRepository todoRepository;
    private final WorkspaceResolver workspaceResolver;

    /**
     * 여러 todo의 체크리스트를 한 번에 조회
     * GET /api/todos/checklists/batch?ids=1,2,3
     * 반환: { todoId: [checklist, ...], ... }
     */
    @GetMapping("/batch")
    public ResponseEntity<Map<Long, List<TodoChecklistResponse>>> batch(
            @RequestParam List<Long> ids,
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId) {

        if (ids == null || ids.isEmpty()) {
            return ResponseEntity.ok(Map.of());
        }
        if (ids.size() > 100) {
            throw new ApiException(400, "한 번에 최대 100개까지 조회할 수 있습니다.");
        }

        Workspace workspace = workspaceResolver.resolve(authentication.getName(), workspaceId);

        List<Todo> todos = todoRepository.findAllById(ids);
        if (todos.size() != ids.size()) {
            throw new ApiException(404, "작업을 찾을 수 없습니다.");
        }
        for (Todo todo : todos) {
            if (todo.getWorkspace() == null
                    || !Objects.equals(todo.getWorkspace().getId(), workspace.getId())) {
                throw new ApiException(403, "다른 워크스페이스의 작업입니다.");
            }
        }

        Map<Long, List<TodoChecklistResponse>> result =
            checklistRepository.findByTodoIdInOrderByTodoIdAscOrderIndexAsc(ids)
                .stream()
                .map(TodoChecklistResponse::from)
                .collect(Collectors.groupingBy(TodoChecklistResponse::getTodoId));
        return ResponseEntity.ok(result);
    }
}
