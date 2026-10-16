package com.example.todo.controller;

import com.example.todo.dto.TodoTemplateRequest;
import com.example.todo.dto.TodoTemplateResponse;
import com.example.todo.entity.Priority;
import com.example.todo.entity.TodoTemplate;
import com.example.todo.entity.User;
import com.example.todo.entity.Workspace;
import com.example.todo.entity.WorkspaceMember;
import com.example.todo.exception.ApiException;
import com.example.todo.repository.TodoTemplateRepository;
import com.example.todo.repository.UserRepository;
import com.example.todo.repository.WorkspaceMemberRepository;
import com.example.todo.repository.WorkspaceRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;

import java.util.Collections;
import java.util.List;

@RestController
@RequestMapping("/api/workspaces/{workspaceId}/templates")
@RequiredArgsConstructor
public class TodoTemplateController {

    private final TodoTemplateRepository todoTemplateRepository;
    private final WorkspaceRepository workspaceRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    @GetMapping
    public ResponseEntity<List<TodoTemplateResponse>> getTemplates(
            @PathVariable Long workspaceId,
            Authentication authentication) {

        requireMember(workspaceId, authentication.getName());

        List<TodoTemplateResponse> list = todoTemplateRepository
                .findByWorkspaceIdOrderByCreatedAtAsc(workspaceId)
                .stream()
                .map(TodoTemplateResponse::from)
                .toList();
        return ResponseEntity.ok(list);
    }

    @PostMapping
    public ResponseEntity<TodoTemplateResponse> create(
            @PathVariable Long workspaceId,
            @Valid @RequestBody TodoTemplateRequest request,
            Authentication authentication) {

        requireEditor(workspaceId, authentication.getName());

        TodoTemplate template = TodoTemplate.builder()
                .workspaceId(workspaceId)
                .creatorEmail(authentication.getName())
                .name(request.getName())
                .defaultTitle(request.getDefaultTitle())
                .defaultContent(request.getDefaultContent())
                .defaultPriority(parsePriority(request.getDefaultPriority()))
                .defaultAssigneeEmails(toJson(request.getDefaultAssigneeEmails()))
                .defaultSubtasks(toJson(request.getDefaultSubtasks()))
                .defaultProjectId(request.getDefaultProjectId())
                .build();

        return ResponseEntity.ok(TodoTemplateResponse.from(todoTemplateRepository.save(template)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<TodoTemplateResponse> update(
            @PathVariable Long workspaceId,
            @PathVariable Long id,
            @Valid @RequestBody TodoTemplateRequest request,
            Authentication authentication) {

        requireEditor(workspaceId, authentication.getName());

        TodoTemplate template = todoTemplateRepository.findById(id)
                .orElseThrow(() -> new ApiException(404, "템플릿을 찾을 수 없습니다."));

        if (!template.getWorkspaceId().equals(workspaceId)) {
            throw new ApiException(400, "잘못된 요청입니다.");
        }

        template.setName(request.getName());
        template.setDefaultTitle(request.getDefaultTitle());
        template.setDefaultContent(request.getDefaultContent());
        template.setDefaultPriority(parsePriority(request.getDefaultPriority()));
        template.setDefaultAssigneeEmails(toJson(request.getDefaultAssigneeEmails()));
        template.setDefaultSubtasks(toJson(request.getDefaultSubtasks()));
        template.setDefaultProjectId(request.getDefaultProjectId());

        return ResponseEntity.ok(TodoTemplateResponse.from(todoTemplateRepository.save(template)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @PathVariable Long workspaceId,
            @PathVariable Long id,
            Authentication authentication) {

        requireMember(workspaceId, authentication.getName());

        TodoTemplate template = todoTemplateRepository.findById(id)
                .orElseThrow(() -> new ApiException(404, "템플릿을 찾을 수 없습니다."));

        if (!template.getWorkspaceId().equals(workspaceId)) {
            throw new ApiException(400, "잘못된 요청입니다.");
        }

        // 본인이 만든 템플릿만 삭제
        if (!template.getCreatorEmail().equals(authentication.getName())) {
            throw new ApiException(403, "본인이 만든 템플릿만 삭제할 수 있습니다.");
        }

        todoTemplateRepository.delete(template);
        return ResponseEntity.noContent().build();
    }

    private void requireMember(Long workspaceId, String email) {
        Workspace workspace = workspaceRepository.findById(workspaceId)
                .orElseThrow(() -> new ApiException(404, "워크스페이스를 찾을 수 없습니다."));
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ApiException(404, "사용자를 찾을 수 없습니다."));
        workspaceMemberRepository.findByWorkspaceAndUser(workspace, user)
                .orElseThrow(() -> new ApiException(403, "워크스페이스 멤버가 아닙니다."));
    }

    /** 편집(생성·수정) 권한 — MEMBER 이상. VIEWER(읽기 전용) 차단. */
    private void requireEditor(Long workspaceId, String email) {
        Workspace workspace = workspaceRepository.findById(workspaceId)
                .orElseThrow(() -> new ApiException(404, "워크스페이스를 찾을 수 없습니다."));
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ApiException(404, "사용자를 찾을 수 없습니다."));
        com.example.todo.entity.WorkspaceMember m = workspaceMemberRepository.findByWorkspaceAndUser(workspace, user)
                .orElseThrow(() -> new ApiException(403, "워크스페이스 멤버가 아닙니다."));
        if (!m.getRole().atLeast(com.example.todo.entity.WorkspaceRole.MEMBER)) {
            throw new ApiException(403, "읽기 전용 역할은 편집할 수 없습니다.");
        }
    }

    private Priority parsePriority(String value) {
        if (value == null) return Priority.MEDIUM;
        try {
            return Priority.valueOf(value);
        } catch (IllegalArgumentException e) {
            return Priority.MEDIUM;
        }
    }

    private String toJson(List<String> list) {
        if (list == null || list.isEmpty()) return null;
        try {
            return objectMapper.writeValueAsString(list);
        } catch (Exception e) {
            return null;
        }
    }
}
