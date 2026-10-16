package com.example.todo.controller;

import com.example.todo.dto.WorkspaceActionResponse;
import com.example.todo.dto.WorkspaceCreateRequest;
import com.example.todo.dto.WorkspaceJoinRequest;
import com.example.todo.dto.WorkspaceMemberResponse;
import com.example.todo.dto.WorkspaceSummaryResponse;
import com.example.todo.dto.WorkspaceUpdateRequest;
import com.example.todo.service.WorkspaceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/workspaces")
@RequiredArgsConstructor
public class WorkspaceController {

    private final WorkspaceService workspaceService;

    @GetMapping("/my")
    public List<WorkspaceSummaryResponse> getMyWorkspaces(Authentication authentication) {
        String userEmail = authentication.getName();
        return workspaceService.getMyWorkspaces(userEmail);
    }

    @PostMapping
    public WorkspaceActionResponse createWorkspace(
            Authentication authentication,
            @Valid @RequestBody WorkspaceCreateRequest request
    ) {
        String userEmail = authentication.getName();
        return workspaceService.createWorkspace(userEmail, request);
    }

    @PostMapping("/join")
    public WorkspaceActionResponse joinWorkspace(
            Authentication authentication,
            @Valid @RequestBody WorkspaceJoinRequest request
    ) {
        String userEmail = authentication.getName();
        return workspaceService.joinWorkspace(userEmail, request);
    }

    @PatchMapping("/{id}")
    public WorkspaceActionResponse updateWorkspace(
            @PathVariable Long id,
            @Valid @RequestBody WorkspaceUpdateRequest request,
            Authentication authentication
    ) {
        return workspaceService.updateWorkspace(authentication.getName(), id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteWorkspace(
            @PathVariable Long id,
            Authentication authentication
    ) {
        workspaceService.deleteWorkspace(authentication.getName(), id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}/leave")
    public ResponseEntity<Void> leaveWorkspace(
            @PathVariable Long id,
            Authentication authentication
    ) {
        workspaceService.leaveWorkspace(authentication.getName(), id);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}/transfer-owner")
    public ResponseEntity<Void> transferOwner(
            @PathVariable Long id,
            @RequestBody Map<String, Long> body,
            Authentication authentication
    ) {
        workspaceService.transferOwner(authentication.getName(), id, body.get("targetUserId"));
        return ResponseEntity.ok().build();
    }

    /** 멤버 역할 변경 (ADMIN 이상). body: {"role": "ADMIN|MEMBER|VIEWER"} */
    @PatchMapping("/{id}/members/{userId}/role")
    public ResponseEntity<Void> changeMemberRole(
            @PathVariable Long id,
            @PathVariable Long userId,
            @RequestBody Map<String, String> body,
            Authentication authentication
    ) {
        com.example.todo.entity.WorkspaceRole role;
        try {
            role = com.example.todo.entity.WorkspaceRole.valueOf(body.get("role"));
        } catch (Exception e) {
            throw new com.example.todo.exception.ApiException(400, "잘못된 역할입니다.");
        }
        workspaceService.changeMemberRole(authentication.getName(), id, userId, role);
        return ResponseEntity.ok().build();
    }

    /** 멤버 강퇴 (ADMIN 이상, OWNER·본인 불가). */
    @DeleteMapping("/{id}/members/{userId}")
    public ResponseEntity<Void> removeMember(
            @PathVariable Long id,
            @PathVariable Long userId,
            Authentication authentication
    ) {
        workspaceService.removeMember(authentication.getName(), id, userId);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{id}/has-recruitments")
    public ResponseEntity<Map<String, Boolean>> hasRecruitments(
            @PathVariable Long id,
            Authentication authentication
    ) {
        boolean has = workspaceService.hasRecruitments(id, authentication.getName());
        return ResponseEntity.ok(Map.of("hasRecruitments", has));
    }

    @GetMapping("/{id}/members")
    public ResponseEntity<List<WorkspaceMemberResponse>> getMembers(
            @PathVariable Long id,
            Authentication authentication
    ) {
        return ResponseEntity.ok(workspaceService.getMembers(id, authentication.getName()));
    }

    @PostMapping("/{id}/icon")
    public ResponseEntity<?> uploadWorkspaceIcon(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file,
            Authentication authentication
    ) {
        try {
            String url = workspaceService.uploadWorkspaceIcon(authentication.getName(), id, file);
            return ResponseEntity.ok(Map.of("iconImageUrl", url));
        } catch (Exception e) {
            log.error("워크스페이스 아이콘 업로드 실패: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}