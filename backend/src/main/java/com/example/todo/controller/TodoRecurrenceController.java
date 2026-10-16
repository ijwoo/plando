package com.example.todo.controller;

import com.example.todo.dto.TodoRecurrenceRequest;
import com.example.todo.dto.TodoRecurrenceResponse;
import com.example.todo.entity.Todo;
import com.example.todo.entity.TodoRecurrence;
import com.example.todo.entity.Workspace;
import com.example.todo.exception.ApiException;
import com.example.todo.repository.TodoRecurrenceRepository;
import com.example.todo.repository.TodoRepository;
import com.example.todo.service.WorkspaceResolver;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;

import java.time.LocalDate;
import java.util.Objects;
import java.util.Optional;

@RestController
@RequestMapping("/api/todos/{todoId}/recurrence")
@RequiredArgsConstructor
public class TodoRecurrenceController {

    private final TodoRecurrenceRepository recurrenceRepository;
    private final TodoRepository todoRepository;
    private final WorkspaceResolver workspaceResolver;
    private final com.example.todo.service.PermissionService permissionService;

    @GetMapping
    public ResponseEntity<?> get(
            @PathVariable Long todoId,
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId) {
        requireTodoAccess(todoId, authentication.getName(), workspaceId);
        Long seriesSourceId = resolveSeriesSourceTodoId(todoId);
        return recurrenceRepository.findBySourceTodoId(seriesSourceId)
                .map(r -> ResponseEntity.ok(TodoRecurrenceResponse.from(r)))
                .orElse(ResponseEntity.noContent().build());
    }

    @PutMapping
    public ResponseEntity<?> upsert(
            @PathVariable Long todoId,
            @Valid @RequestBody TodoRecurrenceRequest req,
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId) {

        // 권한/워크스페이스 검증은 호출된 todoId(인스턴스 가능)로 수행하되,
        // 시리즈 자체 조작은 항상 원본(source) 기준으로 한다. 반복 설정 변경 = 편집(MEMBER 이상).
        permissionService.requireCanEditTodo(authentication.getName(),
                requireTodoAccess(todoId, authentication.getName(), workspaceId));
        Long seriesSourceId = resolveSeriesSourceTodoId(todoId);

        // NONE이면 시리즈 종료 — 원본 기준으로 삭제
        if ("NONE".equals(req.getRecurrenceType())) {
            recurrenceRepository.findBySourceTodoId(seriesSourceId)
                    .ifPresent(recurrenceRepository::delete);
            return ResponseEntity.noContent().build();
        }

        TodoRecurrence.RecurrenceType type =
                TodoRecurrence.RecurrenceType.valueOf(req.getRecurrenceType());

        Optional<TodoRecurrence> existing = recurrenceRepository.findBySourceTodoId(seriesSourceId);
        TodoRecurrence recurrence = existing.orElse(
                TodoRecurrence.builder()
                        .sourceTodoId(seriesSourceId)
                        .lastGeneratedDate(LocalDate.now())
                        .build()
        );
        recurrence.setRecurrenceType(type);
        recurrence.setEndDate(req.getEndDate());

        return ResponseEntity.ok(TodoRecurrenceResponse.from(recurrenceRepository.save(recurrence)));
    }

    /**
     * 호출된 todoId가 시리즈 인스턴스라면 원본(source) todo id로 redirect.
     * 원본이거나 비반복 todo면 자기 자신을 반환.
     *
     * 사용자가 어떤 인스턴스에서 호출하더라도 시리즈 자체(=원본 source) 단일 row를 조작하기 위함.
     */
    private Long resolveSeriesSourceTodoId(Long todoId) {
        Todo todo = todoRepository.findById(todoId).orElse(null);
        if (todo == null) return todoId;
        Long recurrenceId = todo.getRecurrenceSourceId();
        if (recurrenceId == null) return todoId;
        return recurrenceRepository.findById(recurrenceId)
                .map(TodoRecurrence::getSourceTodoId)
                .orElse(todoId);
    }

    private Todo requireTodoAccess(Long todoId, String userEmail, Long workspaceId) {
        Workspace workspace = workspaceResolver.resolve(userEmail, workspaceId);
        Todo todo = todoRepository.findById(todoId)
                .orElseThrow(() -> new ApiException(404, "작업을 찾을 수 없습니다."));
        if (todo.getWorkspace() == null || !Objects.equals(todo.getWorkspace().getId(), workspace.getId())) {
            throw new ApiException(403, "다른 워크스페이스의 작업입니다.");
        }
        if (Boolean.TRUE.equals(todo.getIsSample())) {
            throw new ApiException(403, "샘플 데이터는 수정하거나 삭제할 수 없습니다.");
        }
        return todo;
    }
}
