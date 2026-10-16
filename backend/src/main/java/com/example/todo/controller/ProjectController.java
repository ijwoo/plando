package com.example.todo.controller;

import com.example.todo.dto.ProjectRequestDto;
import com.example.todo.dto.ProjectResponseDto;
import com.example.todo.dto.TodoLogResponseDto;
import com.example.todo.entity.Project;
import com.example.todo.entity.User;
import com.example.todo.entity.Workspace;
import com.example.todo.exception.ApiException;
import com.example.todo.repository.ProjectRepository;
import com.example.todo.repository.TodoRepository;
import com.example.todo.service.LogService;
import com.example.todo.service.WorkspaceResolver;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 프로젝트 CRUD — 워크스페이스 스코프.
 * 인박스(소속 없음)는 별도 행 없이 todo.project = null 로 표현한다.
 */
@RestController
@RequestMapping("/api/projects")
@RequiredArgsConstructor
public class ProjectController {

    private final ProjectRepository projectRepository;
    private final TodoRepository todoRepository;
    private final WorkspaceResolver workspaceResolver;
    private final LogService logService;
    private final com.example.todo.service.PermissionService permissionService;

    @GetMapping
    @Transactional(readOnly = true)
    public List<ProjectResponseDto> getProjects(
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId
    ) {
        Workspace workspace = workspaceResolver.resolve(authentication.getName(), workspaceId);

        // 카운트 집계를 한 번에 — N+1 방지
        Map<Long, long[]> counts = new HashMap<>();
        for (Object[] row : todoRepository.countTodosByProject(workspace)) {
            counts.put((Long) row[0], new long[]{ (Long) row[1], (Long) row[2] });
        }

        return projectRepository.findByWorkspaceOrderByIdAsc(workspace).stream()
                .map(p -> {
                    long[] c = counts.getOrDefault(p.getId(), new long[]{0, 0});
                    return ProjectResponseDto.from(p, c[0], c[1]);
                })
                .toList();
    }

    @PostMapping
    public ResponseEntity<ProjectResponseDto> createProject(
            @Valid @RequestBody ProjectRequestDto dto,
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId
    ) {
        String userEmail = authentication.getName();
        Workspace workspace = workspaceResolver.resolve(userEmail, workspaceId);
        User user = workspaceResolver.getUser(userEmail);
        // 생성 = 편집 역할(MEMBER 이상). VIEWER 차단.
        permissionService.requireCanCreateContent(userEmail, workspace);

        Project project = Project.builder()
                .name(dto.getName().trim())
                .color(dto.getColor())
                .icon(dto.getIcon())
                .workspace(workspace)
                .createdBy(user)
                .build();

        Project saved = projectRepository.save(project);
        return ResponseEntity.status(HttpStatus.CREATED).body(ProjectResponseDto.from(saved, 0, 0));
    }

    @PutMapping("/{id}")
    public ProjectResponseDto updateProject(
            @PathVariable Long id,
            @Valid @RequestBody ProjectRequestDto dto,
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId
    ) {
        Workspace workspace = workspaceResolver.resolve(authentication.getName(), workspaceId);
        Project project = requireProject(id, workspace);
        // 수정 = 역할 기반(MEMBER 이상). VIEWER 차단.
        permissionService.requireCanEditProject(authentication.getName(), project);

        project.setName(dto.getName().trim());
        if (dto.getColor() != null) project.setColor(dto.getColor());
        if (dto.getIcon() != null) project.setIcon(dto.getIcon());

        Project saved = projectRepository.save(project);
        // 수정 응답의 카운트는 프론트가 사용하지 않음(목록 재조회) — 0으로 둠
        return ProjectResponseDto.from(saved, 0, 0);
    }

    /** 삭제 — 소속 할 일은 인박스(project = null)로 이동 */
    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> deleteProject(
            @PathVariable Long id,
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId
    ) {
        Workspace workspace = workspaceResolver.resolve(authentication.getName(), workspaceId);
        Project project = requireProject(id, workspace);
        // 삭제 = 작성자 본인 || ADMIN 이상.
        permissionService.requireCanDeleteProject(authentication.getName(), project);

        todoRepository.clearProject(project);
        projectRepository.delete(project);
        return ResponseEntity.noContent().build();
    }

    /** 프로젝트 개요 활동 피드 — 소속 할 일들의 최근 변경 로그 */
    @GetMapping("/{id}/activity")
    @Transactional(readOnly = true)
    public List<TodoLogResponseDto> getProjectActivity(
            @PathVariable Long id,
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId
    ) {
        Workspace workspace = workspaceResolver.resolve(authentication.getName(), workspaceId);
        Project project = requireProject(id, workspace);
        return logService.getRecentForProject(project, 12);
    }

    private Project requireProject(Long id, Workspace workspace) {
        return projectRepository.findByIdAndWorkspace(id, workspace)
                .orElseThrow(() -> new ApiException(404, "프로젝트를 찾을 수 없습니다."));
    }
}
