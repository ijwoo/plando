package com.example.todo.service;

import com.example.todo.entity.*;
import com.example.todo.exception.ApiException;
import com.example.todo.repository.ProjectRepository;
import com.example.todo.repository.TodoRepository;
import com.example.todo.repository.UserRepository;
import com.example.todo.repository.WorkspaceMemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TodoService {

    private final TodoRepository todoRepository;
    private final ProjectRepository projectRepository;
    private final LogService logService;
    private final UserRepository userRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final NotificationService notificationService;
    private final WorkspaceResolver workspaceResolver;
    private final LocationTriggerService locationTriggerService;
    private final PermissionService permissionService;
    private final WorkflowStatusService workflowStatusService;

    @Transactional
    public void updatePriority(Long id, String priority, String userEmail, Long workspaceId) {
        Todo todo = requireMutableTodo(id, userEmail, workspaceId);
        todo.setPriority(parsePriority(priority));
    }

    // ── 값 파싱 (프레임워크/자바 예외 원문이 사용자에게 새지 않도록 전부 여기서 감싼다) ──

    private Priority parsePriority(String value) {
        try {
            return Priority.valueOf(value.trim().toUpperCase());
        } catch (RuntimeException e) {
            throw new ApiException(400, "잘못된 priority 값입니다: " + value);
        }
    }

    private LocalDate parseDate(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return LocalDate.parse(value);
        } catch (RuntimeException e) {
            throw new ApiException(400, "날짜 형식이 올바르지 않습니다: " + value);
        }
    }

    private java.time.LocalTime parseTime(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return java.time.LocalTime.parse(value);
        } catch (RuntimeException e) {
            throw new ApiException(400, "시간 형식이 올바르지 않습니다: " + value);
        }
    }

    @Transactional
    public void updateField(Long id, String field, String newValue, String modifierEmail, Long workspaceId) {
        Todo todo = requireMutableTodo(id, modifierEmail, workspaceId);

        String beforeValue = "";
        String afterLogValue = newValue;

        switch (field) {
            case "title":
                beforeValue = todo.getTitle();
                // title 컬럼은 varchar(255). 넘기면 DB 오류가 그대로 올라와 원문이 새고 저장도 실패한다.
                if (newValue != null && newValue.length() > 255) {
                    throw new ApiException(400, "제목은 255자 이하로 입력해주세요.");
                }
                todo.setTitle(newValue);
                break;

            case "content":
                beforeValue = todo.getContent();
                todo.setContent(newValue);
                break;

            case "priority":
                beforeValue = todo.getPriority() != null ? todo.getPriority().name() : "";
                // valueOf/parse 를 맨몸으로 부르면 "No enum constant com.example.todo.entity.Priority.X"
                // 같은 자바 원문이 그대로 사용자에게 나간다(패키지 구조 노출). updatePriority 처럼 감싼다.
                todo.setPriority(parsePriority(newValue));
                break;

            case "startAt":
                beforeValue = todo.getStartAt() != null ? todo.getStartAt().toString() : "";
                requireOrderedDates(parseDate(newValue), todo.getDueDate());
                todo.setStartAt(parseDate(newValue));
                break;

            case "dueDate":
                beforeValue = todo.getDueDate() != null ? todo.getDueDate().toString() : "";
                requireOrderedDates(todo.getStartAt(), parseDate(newValue));
                todo.setDueDate(parseDate(newValue));
                break;

            case "startTime":
                beforeValue = todo.getStartTime() != null ? todo.getStartTime().toString() : "";
                todo.setStartTime(parseTime(newValue));
                break;

            case "endTime":
                beforeValue = todo.getEndTime() != null ? todo.getEndTime().toString() : "";
                todo.setEndTime(parseTime(newValue));
                break;

            case "projectId":
                beforeValue = todo.getProject() != null ? todo.getProject().getName() : "인박스";
                if (newValue == null || newValue.isBlank() || "null".equals(newValue) || "inbox".equals(newValue)) {
                    todo.setProject(null);
                    afterLogValue = "인박스";
                } else {
                    long projectId;
                    try {
                        projectId = Long.parseLong(newValue);
                    } catch (NumberFormatException e) {
                        throw new ApiException(400, "잘못된 프로젝트 값입니다: " + newValue);
                    }
                    Project newProject = projectRepository.findByIdAndWorkspace(projectId, todo.getWorkspace())
                            .orElseThrow(() -> new ApiException(404, "프로젝트를 찾을 수 없습니다."));
                    todo.setProject(newProject);
                    afterLogValue = newProject.getName();
                }
                break;

            case "parentId":
                beforeValue = todo.getParentId() != null ? todo.getParentId().toString() : "";
                if (newValue == null || newValue.isBlank() || "null".equals(newValue)) {
                    todo.setParentId(null);
                    afterLogValue = "";
                } else {
                    long parsedParentId;
                    try {
                        parsedParentId = Long.parseLong(newValue);
                    } catch (NumberFormatException e) {
                        throw new ApiException(400, "잘못된 parentId 값입니다: " + newValue);
                    }
                    if (!Objects.equals(todo.getParentId(), parsedParentId)) {
                        validateParentAssignment(parsedParentId, todo.getId(), todo.getWorkspace());
                        todo.setParentId(parsedParentId);
                    }
                }
                break;

            case "status":
                beforeValue = todo.getStatus() != null ? todo.getStatus() : "";
                if (!workflowStatusService.isValidKey(todo.getWorkspace(), newValue)) {
                    throw new ApiException(400, "유효하지 않은 상태입니다.");
                }
                boolean nowDone = workflowStatusService.isDone(todo.getWorkspace(), newValue);
                todo.applyStatus(newValue, nowDone);
                if (nowDone) {
                    locationTriggerService.disableAllForTodo(todo.getId());
                }
                break;

            case "assignees":
                Set<String> oldEmails = todo.getAssignees().stream()
                        .map(User::getEmail)
                        .collect(Collectors.toSet());

                beforeValue = todo.getAssignees().stream()
                        .map(User::getName)
                        .collect(Collectors.joining(","));

                List<String> emailList = Arrays.stream(newValue.split(","))
                        .map(String::trim)
                        .filter(s -> !s.isEmpty())
                        .toList();

                List<User> users = userRepository.findByEmailIn(emailList);

                Workspace workspace = todo.getWorkspace();
                if (workspace == null) {
                    throw new ApiException(400, "작업의 워크스페이스 정보가 없습니다.");
                }

                Set<Long> workspaceUserIds = workspaceMemberRepository.findByWorkspace(workspace).stream()
                        .map(member -> member.getUser().getId())
                        .collect(Collectors.toSet());

                List<User> filteredUsers = users.stream()
                        .filter(user -> workspaceUserIds.contains(user.getId()))
                        .collect(Collectors.toList());

                todo.setAssignees(filteredUsers);

                afterLogValue = filteredUsers.stream()
                        .map(User::getName)
                        .collect(Collectors.joining(","));

                filteredUsers.stream()
                        .filter(u -> !u.getEmail().equals(modifierEmail))
                        .filter(u -> !oldEmails.contains(u.getEmail()))
                        .forEach(u -> notificationService.createNotification(
                                u.getEmail(),
                                modifierEmail,
                                NotificationType.TASK_ASSIGNED.name(),
                                "새 작업에 담당자로 지정되었어요",
                                "\"" + todo.getTitle() + "\" 작업에 담당자로 지정되었어요.",
                                todo.getId(),
                                workspace.getId()
                        ));
                break;

            default:
                throw new ApiException(400, "지원하지 않는 필드입니다.");
        }

        logService.saveLog(id, field, beforeValue, afterLogValue, modifierEmail);
    }

    /**
     * 시작일이 마감일보다 뒤면 막는다.
     *
     * 화면에서도 막지만 서버에서 한 번 더 본다 — 클라이언트는 여러 개고(웹·앱·AI), 한 곳만
     * 뚫려도 데이터가 뒤집힌 채로 들어온다. 그렇게 저장되면 **캘린더에서 통째로 사라진다**
     * (끝이 시작보다 앞이라 어느 칸에도 안 그려진다). 목록에만 남아 원인을 찾기 어렵다.
     */
    private void requireOrderedDates(LocalDate startAt, LocalDate dueDate) {
        if (startAt != null && dueDate != null && startAt.isAfter(dueDate)) {
            throw new ApiException(400, "시작일이 마감일보다 늦을 수 없어요.");
        }
    }

    /**
     * 서브태스크 부모 지정 검증 — 깊이 1단계만 허용.
     *
     * @param parentId 지정하려는 부모 할 일 ID (null이면 검증 없이 통과)
     * @param selfId   수정 대상 자신의 ID (생성 시 null)
     * @param workspace 요청 워크스페이스 (부모와 일치해야 함)
     */
    public void validateParentAssignment(Long parentId, Long selfId, Workspace workspace) {
        if (parentId == null) return;
        if (parentId.equals(selfId)) {
            throw new ApiException(400, "자기 자신을 서브태스크로 지정할 수 없어요");
        }
        Todo parent = todoRepository.findById(parentId)
                .orElseThrow(() -> new ApiException(404, "부모 할 일을 찾을 수 없습니다."));
        if (parent.getWorkspace() == null || workspace == null
                || !Objects.equals(parent.getWorkspace().getId(), workspace.getId())) {
            throw new ApiException(403, "다른 워크스페이스의 작업입니다.");
        }
        if (parent.getParentId() != null) {
            throw new ApiException(400, "서브태스크에는 하위 항목을 추가할 수 없어요");
        }
        if (selfId != null && todoRepository.existsByParentId(selfId)) {
            throw new ApiException(400, "하위 항목이 있는 할 일은 서브태스크로 만들 수 없어요");
        }
    }

    private Todo requireMutableTodo(Long todoId, String userEmail, Long workspaceId) {
        Workspace workspace = workspaceResolver.resolve(userEmail, workspaceId);
        Todo todo = todoRepository.findById(todoId)
                .orElseThrow(() -> new ApiException(404, "작업을 찾을 수 없습니다."));
        if (todo.getWorkspace() == null || !Objects.equals(todo.getWorkspace().getId(), workspace.getId())) {
            throw new ApiException(403, "다른 워크스페이스의 작업입니다.");
        }
        // 편집 권한(MEMBER 이상 + 샘플 차단)을 단일 지점에서 강제 → priority/field/archive/restore 등
        // 이 헬퍼를 지나는 모든 경로의 VIEWER 우회를 봉쇄한다.
        permissionService.requireCanEditTodo(userEmail, todo);
        return todo;
    }
}
