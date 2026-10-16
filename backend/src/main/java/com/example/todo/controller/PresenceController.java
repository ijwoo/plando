package com.example.todo.controller;

import com.example.todo.entity.User;
import com.example.todo.entity.Workspace;
import com.example.todo.entity.WorkspaceMember;
import com.example.todo.repository.WorkspaceMemberRepository;
import com.example.todo.service.PresenceService;
import com.example.todo.service.WorkspaceResolver;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * STOMP 세션 기반 사용자 presence 조회.
 *
 * - GET /api/presence            워크스페이스 멤버 전체 presence (Dashboard TeamStatusList)
 * - GET /api/presence/{email}    개별 사용자 presence (DM 등)
 */
@RestController
@RequestMapping("/api/presence")
@RequiredArgsConstructor
public class PresenceController {

    private final PresenceService presenceService;
    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final WorkspaceResolver workspaceResolver;

    @GetMapping
    public Map<String, PresenceDto> getWorkspacePresence(
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId
    ) {
        String userEmail = authentication.getName();
        Workspace workspace = workspaceResolver.resolve(userEmail, workspaceId);

        Set<String> emails = workspaceMemberRepository.findByWorkspace(workspace).stream()
                .map(WorkspaceMember::getUser)
                .filter(Objects::nonNull)
                .map(User::getEmail)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        Map<String, PresenceService.PresenceInfo> snapshot = presenceService.snapshot(emails);
        Map<String, PresenceDto> result = new HashMap<>();
        snapshot.forEach((email, info) ->
                result.put(email, new PresenceDto(info.online(), info.lastSeen())));
        return result;
    }

    @GetMapping("/{email}")
    public PresenceDto getOne(
            @PathVariable String email,
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId
    ) {
        String requesterEmail = authentication.getName();
        Workspace workspace = workspaceResolver.resolve(requesterEmail, workspaceId);

        boolean isMember = workspaceMemberRepository.findByWorkspace(workspace).stream()
                .map(WorkspaceMember::getUser)
                .filter(Objects::nonNull)
                .anyMatch(u -> email.equals(u.getEmail()));
        if (!isMember) {
            return new PresenceDto(false, null);
        }

        return new PresenceDto(presenceService.isOnline(email), presenceService.getLastSeen(email));
    }

    public record PresenceDto(boolean online, Instant lastSeen) {}
}
