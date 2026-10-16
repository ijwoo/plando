package com.example.todo.controller;

import com.example.todo.dto.TodoChecklistRequest;
import com.example.todo.dto.TodoChecklistResponse;
import com.example.todo.entity.Todo;
import com.example.todo.entity.TodoChecklist;
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
import java.util.Objects;

@RestController
@RequestMapping("/api/todos/{todoId}/checklists")
@RequiredArgsConstructor
public class TodoChecklistController {

    private final TodoChecklistRepository checklistRepository;
    private final TodoRepository todoRepository;
    private final WorkspaceResolver workspaceResolver;
    private final com.example.todo.service.PermissionService permissionService;

    @GetMapping
    public ResponseEntity<List<TodoChecklistResponse>> list(
            @PathVariable Long todoId,
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId) {

        requireSameWorkspace(todoId, authentication.getName(), workspaceId);
        return ResponseEntity.ok(
            checklistRepository.findByTodoIdOrderByOrderIndex(todoId)
                .stream().map(TodoChecklistResponse::from).toList()
        );
    }

    @PostMapping
    public ResponseEntity<TodoChecklistResponse> create(
            @PathVariable Long todoId,
            @RequestBody TodoChecklistRequest req,
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId) {

        // 체크리스트 생성·수정·삭제 = 부모 할 일 편집 권한(MEMBER 이상, 샘플 차단)
        permissionService.requireCanEditTodo(authentication.getName(), requireSameWorkspace(todoId, authentication.getName(), workspaceId));
        if (req.getContent() == null || req.getContent().isBlank()) {
            throw new ApiException(400, "체크리스트 내용을 입력해주세요.");
        }
        int nextOrder = (int) checklistRepository.countByTodoId(todoId);
        TodoChecklist item = TodoChecklist.builder()
                .todoId(todoId)
                .content(req.getContent())
                .checked(false)
                .orderIndex(req.getOrderIndex() != null ? req.getOrderIndex() : nextOrder)
                .build();
        return ResponseEntity.ok(TodoChecklistResponse.from(checklistRepository.save(item)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<TodoChecklistResponse> update(
            @PathVariable Long todoId,
            @PathVariable Long id,
            @RequestBody TodoChecklistRequest req,
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId) {

        // 체크리스트 생성·수정·삭제 = 부모 할 일 편집 권한(MEMBER 이상, 샘플 차단)
        permissionService.requireCanEditTodo(authentication.getName(), requireSameWorkspace(todoId, authentication.getName(), workspaceId));
        TodoChecklist item = checklistRepository.findById(id)
                .orElseThrow(() -> new ApiException(404, "체크리스트 항목이 없습니다."));
        if (!Objects.equals(item.getTodoId(), todoId)) {
            throw new ApiException(400, "잘못된 요청입니다.");
        }
        if (req.getContent() != null) item.setContent(req.getContent());
        if (req.getChecked() != null) item.setChecked(req.getChecked());
        if (req.getOrderIndex() != null) item.setOrderIndex(req.getOrderIndex());
        return ResponseEntity.ok(TodoChecklistResponse.from(checklistRepository.save(item)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @PathVariable Long todoId,
            @PathVariable Long id,
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId) {

        // 체크리스트 생성·수정·삭제 = 부모 할 일 편집 권한(MEMBER 이상, 샘플 차단)
        permissionService.requireCanEditTodo(authentication.getName(), requireSameWorkspace(todoId, authentication.getName(), workspaceId));
        TodoChecklist item = checklistRepository.findById(id)
                .orElseThrow(() -> new ApiException(404, "체크리스트 항목이 없습니다."));
        if (!Objects.equals(item.getTodoId(), todoId)) {
            throw new ApiException(400, "잘못된 요청입니다.");
        }
        checklistRepository.delete(item);
        return ResponseEntity.noContent().build();
    }

    private Todo requireSameWorkspace(Long todoId, String userEmail, Long workspaceId) {
        Workspace workspace = workspaceResolver.resolve(userEmail, workspaceId);
        Todo todo = todoRepository.findById(todoId)
                .orElseThrow(() -> new ApiException(404, "작업을 찾을 수 없습니다."));
        if (todo.getWorkspace() == null || !Objects.equals(todo.getWorkspace().getId(), workspace.getId())) {
            throw new ApiException(403, "다른 워크스페이스의 작업입니다.");
        }
        return todo;
    }

    private void assertNotSample(Todo todo) {
        if (Boolean.TRUE.equals(todo.getIsSample())) {
            throw new ApiException(403, "샘플 데이터는 수정하거나 삭제할 수 없습니다.");
        }
    }
}
