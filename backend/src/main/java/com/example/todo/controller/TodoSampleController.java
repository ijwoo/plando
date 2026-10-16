package com.example.todo.controller;

import com.example.todo.entity.User;
import com.example.todo.entity.Workspace;
import com.example.todo.service.PermissionService;
import com.example.todo.service.TodoSampleService;
import com.example.todo.service.UserService;
import com.example.todo.service.WorkspaceResolver;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 온보딩 샘플 할 일.
 *
 * 예전엔 워크스페이스 개념이 아예 없었다. X-Workspace-Id 도 안 받고 WorkspaceResolver·
 * PermissionService 도 안 거쳐서, 서비스가 "OWNER 인 워크스페이스가 없으면 아무 워크스페이스나"
 * 로 대체하는 바람에 초대 코드로만 들어온 사용자는 **남의 워크스페이스**에 샘플을 만들었다.
 * 게다가 그렇게 만들어진 할 일은 isSample=true 라 일반 삭제 경로에서 전원 403 이 나서
 * 그 워크스페이스의 OWNER 조차 치울 수 없었다.
 * 이제 헤더로 워크스페이스를 정하고 콘텐츠 생성 권한(MEMBER+)을 요구한다.
 */
@RestController
@RequestMapping("/api/sample-todos")
@RequiredArgsConstructor
public class TodoSampleController {

    private final TodoSampleService todoSampleService;
    private final UserService userService;
    private final WorkspaceResolver workspaceResolver;
    private final PermissionService permissionService;

    @DeleteMapping
    public ResponseEntity<Void> deleteSampleTodos(
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId
    ) {
        User user = getCurrentUser(authentication);
        Workspace workspace = workspaceResolver.resolve(authentication.getName(), workspaceId);
        permissionService.requireCanCreateContent(authentication.getName(), workspace);
        todoSampleService.deleteSampleTodos(user, workspace);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/recreate")
    public ResponseEntity<Void> recreateSampleTodos(
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId
    ) {
        User user = getCurrentUser(authentication);
        Workspace workspace = workspaceResolver.resolve(authentication.getName(), workspaceId);
        permissionService.requireCanCreateContent(authentication.getName(), workspace);
        todoSampleService.recreateSampleTodos(user, workspace);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/exists")
    public ResponseEntity<Map<String, Boolean>> hasSampleTodos(
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId
    ) {
        User user = getCurrentUser(authentication);
        // 조회라 멤버면 충분(VIEWER 포함).
        Workspace workspace = workspaceResolver.resolve(authentication.getName(), workspaceId);
        permissionService.requireMember(authentication.getName(), workspace);
        boolean exists = todoSampleService.hasSampleTodos(user, workspace);
        return ResponseEntity.ok(Map.of("hasSampleTodos", exists));
    }

    private User getCurrentUser(Authentication authentication) {
        String email = authentication.getName();
        return userService.findByEmail(email);
    }
}
