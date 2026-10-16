package com.example.todo.controller;

import com.example.todo.dto.WorkflowStatusResponse;
import com.example.todo.entity.StatusCategory;
import com.example.todo.entity.Workspace;
import com.example.todo.entity.WorkspaceRole;
import com.example.todo.exception.ApiException;
import com.example.todo.service.PermissionService;
import com.example.todo.service.WorkflowStatusService;
import com.example.todo.service.WorkspaceResolver;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 커스텀 상태(워크플로우) API. 조회=멤버 전원, 관리(생성·수정·순서·삭제·기본)=ADMIN+(워크스페이스 설정).
 */
@RestController
@RequestMapping("/api/statuses")
@RequiredArgsConstructor
public class WorkflowStatusController {

    private final WorkflowStatusService statusService;
    private final WorkspaceResolver workspaceResolver;
    private final PermissionService permissionService;

    private Workspace ws(Authentication auth, Long workspaceId) {
        return workspaceResolver.resolve(auth.getName(), workspaceId);
    }

    private void requireManage(Authentication auth, Workspace w) {
        permissionService.requireRole(auth.getName(), w, WorkspaceRole.ADMIN);
    }

    @GetMapping
    public List<WorkflowStatusResponse> list(Authentication auth,
                                             @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId) {
        Workspace w = ws(auth, workspaceId);
        permissionService.requireMember(auth.getName(), w);
        return statusService.list(w).stream().map(WorkflowStatusResponse::from).toList();
    }

    @PostMapping
    public WorkflowStatusResponse create(@RequestBody Map<String, String> body, Authentication auth,
                                         @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId) {
        Workspace w = ws(auth, workspaceId);
        requireManage(auth, w);
        return WorkflowStatusResponse.from(
                statusService.create(w, body.get("label"), body.get("color"), parseCategory(body.get("category"))));
    }

    @PatchMapping("/reorder")
    public ResponseEntity<Void> reorder(@RequestBody Map<String, List<Long>> body, Authentication auth,
                                        @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId) {
        Workspace w = ws(auth, workspaceId);
        requireManage(auth, w);
        statusService.reorder(w, body.getOrDefault("orderedIds", List.of()));
        return ResponseEntity.ok().build();
    }

    @PatchMapping("/{id}")
    public WorkflowStatusResponse update(@PathVariable Long id, @RequestBody Map<String, String> body, Authentication auth,
                                         @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId) {
        Workspace w = ws(auth, workspaceId);
        requireManage(auth, w);
        StatusCategory cat = body.containsKey("category") ? parseCategory(body.get("category")) : null;
        return WorkflowStatusResponse.from(statusService.update(w, id, body.get("label"), body.get("color"), cat));
    }

    @PatchMapping("/{id}/default")
    public ResponseEntity<Void> setDefault(@PathVariable Long id, Authentication auth,
                                           @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId) {
        Workspace w = ws(auth, workspaceId);
        requireManage(auth, w);
        statusService.setDefault(w, id);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, @RequestParam(value = "reassignTo", required = false) String reassignTo,
                                       Authentication auth,
                                       @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId) {
        Workspace w = ws(auth, workspaceId);
        requireManage(auth, w);
        statusService.delete(w, id, reassignTo);
        return ResponseEntity.noContent().build();
    }

    private StatusCategory parseCategory(String v) {
        if (v == null) return null;
        try {
            return StatusCategory.valueOf(v);
        } catch (Exception e) {
            throw new ApiException(400, "잘못된 카테고리입니다. (TODO/IN_PROGRESS/DONE)");
        }
    }
}
