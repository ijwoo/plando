package com.example.todo.controller;

import com.example.todo.dto.LocationTriggerDto;
import com.example.todo.entity.User;
import com.example.todo.entity.Workspace;
import com.example.todo.service.LocationTriggerService;
import com.example.todo.service.UserService;
import com.example.todo.service.WorkspaceResolver;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/triggers")
@RequiredArgsConstructor
public class LocationTriggerController {

    private final LocationTriggerService locationTriggerService;
    private final UserService userService;
    private final WorkspaceResolver workspaceResolver;

    @GetMapping
    public ResponseEntity<Map<Long, LocationTriggerDto.TriggerItem>> getTriggers(
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId,
            Authentication authentication
    ) {
        Workspace workspace = workspaceResolver.resolve(authentication.getName(), workspaceId);
        Long userId = getUserId(authentication);
        return ResponseEntity.ok(locationTriggerService.getTriggers(userId, workspace.getId()));
    }

    @PutMapping
    public ResponseEntity<Map<Long, LocationTriggerDto.TriggerItem>> saveTriggers(
            @RequestBody Map<Long, LocationTriggerDto.TriggerItem> triggers,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId,
            Authentication authentication
    ) {
        Workspace workspace = workspaceResolver.resolve(authentication.getName(), workspaceId);
        Long userId = getUserId(authentication);
        return ResponseEntity.ok(locationTriggerService.saveTriggers(userId, workspace.getId(), triggers));
    }

    /**
     * 장소 반경 진입 시 프론트에서 호출 → 푸시 알림 발송.
     *
     * 이 컨트롤러에서 유일하게 workspaceResolver.resolve()를 건너뛰던 엔드포인트였다.
     * 헤더로 온 workspaceId를 그대로 서비스에 넘겨서, 남의 워크스페이스 id를 위조해 넣을 수 있었다.
     * 다른 엔드포인트와 동일하게 사용자 소속을 확인한 뒤 해석된 id만 사용한다.
     */
    @PostMapping("/enter/{todoId}")
    public ResponseEntity<Void> onLocationEnter(
            @PathVariable Long todoId,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId,
            Authentication authentication
    ) {
        Workspace workspace = workspaceResolver.resolve(authentication.getName(), workspaceId);
        Long userId = getUserId(authentication);
        locationTriggerService.onLocationEnter(userId, todoId, workspace.getId());
        return ResponseEntity.ok().build();
    }

    private Long getUserId(Authentication authentication) {
        User user = userService.findByEmail(authentication.getName());
        return user.getId();
    }
}
