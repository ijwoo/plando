package com.example.todo.controller;

import com.example.todo.dto.AssigneeDto;
import com.example.todo.dto.TodoLocationDto;
import com.example.todo.dto.TodoRequestDto;
import com.example.todo.dto.TodoResponseDto;
import com.example.todo.entity.Priority;
import com.example.todo.entity.Project;
import com.example.todo.entity.Todo;
import com.example.todo.entity.NotificationType;
import com.example.todo.entity.TodoFocus;
import com.example.todo.entity.User;
import com.example.todo.entity.Workspace;
import com.example.todo.exception.ApiException;
import com.example.todo.repository.LocationTriggerRepository;
import com.example.todo.repository.ProjectRepository;
import com.example.todo.repository.TodoChecklistRepository;
import com.example.todo.repository.TodoFocusRepository;
import com.example.todo.repository.TodoRecurrenceRepository;
import com.example.todo.repository.TodoRepository;
import com.example.todo.repository.UserRepository;
import com.example.todo.repository.WorkspaceMemberRepository;
import com.example.todo.service.KakaoGeocodingService;
import com.example.todo.service.LogService;
import com.example.todo.service.NotificationService;
import com.example.todo.service.TodoEventPublisher;
import com.example.todo.service.TodoService;
import com.example.todo.service.WorkspaceResolver;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/todos")
@RequiredArgsConstructor
public class TodoController {

    private final TodoRepository todoRepository;
    private final ProjectRepository projectRepository;
    private final TodoService todoService;
    private final LogService logService;
    private final UserRepository userRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final WorkspaceResolver workspaceResolver;
    private final NotificationService notificationService;
    private final com.example.todo.service.QuickCaptureService quickCaptureService;
    private final TodoRecurrenceRepository recurrenceRepository;
    private final TodoChecklistRepository checklistRepository;
    private final LocationTriggerRepository locationTriggerRepository;
    private final com.example.todo.service.LocationTriggerService locationTriggerService;
    private final TodoFocusRepository todoFocusRepository;
    private final KakaoGeocodingService geocodingService;
    private final com.example.todo.service.PermissionService permissionService;
    private final com.example.todo.repository.CommentRepository commentRepository;
    private final com.example.todo.repository.TodoAttachmentRepository todoAttachmentRepository;
    private final com.example.todo.repository.TagRepository tagRepository;
    private final com.example.todo.repository.TodoTagRepository todoTagRepository;
    private final com.example.todo.service.WorkflowStatusService workflowStatusService;
    private final TodoEventPublisher todoEventPublisher;

    @org.springframework.beans.factory.annotation.Value("${app.upload.dir:uploads}")
    private String uploadDir;

    private List<User> getWorkspaceUsersByEmails(Workspace workspace, List<String> emails) {
        if (emails == null || emails.isEmpty()) {
            return new ArrayList<>();
        }

        List<User> users = userRepository.findByEmailIn(emails);

        Set<Long> workspaceUserIds = workspaceMemberRepository.findByWorkspace(workspace).stream()
                .map(member -> member.getUser().getId())
                .collect(Collectors.toSet());

        return users.stream()
                .filter(user -> workspaceUserIds.contains(user.getId()))
                .collect(Collectors.toList());
    }

    @GetMapping
    public List<TodoResponseDto> getTodos(
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId
    ) {
        String userEmail = authentication.getName();
        Workspace workspace = workspaceResolver.resolve(userEmail, workspaceId);
        User currentUser = workspaceResolver.getUser(userEmail);

        // fetch join 없는 파생 쿼리를 쓰면서 convertToDto가 LAZY 연관을 건드려 할 일 1건당 SELECT가 추가로 나갔다.
        // (캘린더만 쓰던) JOIN FETCH 쿼리로 교체 — 결과 순서·내용은 동일하고 쿼리 수만 1+3N → 1이 된다.
        List<Todo> todos = todoRepository.findByWorkspaceAndArchivedFalseWithAssignees(workspace);
        Set<Long> todoIds = todos.stream().map(Todo::getId).collect(Collectors.toSet());
        Set<Long> recurringSourceIds = recurrenceRepository.findBySourceTodoIdIn(todoIds).stream()
                .map(r -> r.getSourceTodoId())
                .collect(Collectors.toSet());
        Set<Long> focusedIds = resolveFocusedIds(currentUser.getId(), todoIds);
        Map<Long, int[]> subtaskCounts = resolveSubtaskCounts(todoIds);
        var tagsByTodo = resolveTags(todoIds);
        Map<Long, int[]> checklistCounts = resolveChecklistCounts(todoIds);

        return todos.stream()
                .map(todo -> convertToDto(todo, recurringSourceIds, focusedIds, subtaskCounts, tagsByTodo, checklistCounts))
                .collect(Collectors.toList());
    }

    // ─── 서브태스크 ─────────────────────────────────────────────────

    /** 특정 부모의 서브태스크(자식) 목록 조회 */
    @GetMapping("/{id}/subtasks")
    public ResponseEntity<?> getSubtasks(
            @PathVariable Long id,
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId
    ) {
        String userEmail = authentication.getName();
        Workspace workspace = workspaceResolver.resolve(userEmail, workspaceId);
        User currentUser = workspaceResolver.getUser(userEmail);

        Optional<Todo> opt = todoRepository.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();
        Todo parent = opt.get();
        if (!isSameWorkspace(parent, workspace)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("다른 워크스페이스의 작업입니다.");
        }

        List<Todo> subtasks = todoRepository.findByParentIdAndArchivedFalseOrderByIdAsc(id);
        Set<Long> todoIds = subtasks.stream().map(Todo::getId).collect(Collectors.toSet());
        Set<Long> recurringSourceIds = recurrenceRepository.findBySourceTodoIdIn(todoIds).stream()
                .map(r -> r.getSourceTodoId())
                .collect(Collectors.toSet());
        Set<Long> focusedIds = resolveFocusedIds(currentUser.getId(), todoIds);
        // 깊이 1단계 정책상 서브태스크의 카운트는 항상 0이지만, 응답 형태 일관성을 위해 동일 경로 사용
        Map<Long, int[]> subtaskCounts = resolveSubtaskCounts(todoIds);
        var tagsByTodo = resolveTags(todoIds);
        Map<Long, int[]> checklistCounts = resolveChecklistCounts(todoIds);

        List<TodoResponseDto> result = subtasks.stream()
                .map(t -> convertToDto(t, recurringSourceIds, focusedIds, subtaskCounts, tagsByTodo, checklistCounts))
                .collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    // ─── CSV 내보내기 ────────────────────────────────────────────────

    @GetMapping("/export")
    public ResponseEntity<byte[]> exportTodosCsv(
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId
    ) {
        String userEmail = authentication.getName();
        Workspace workspace = workspaceResolver.resolve(userEmail, workspaceId);

        // 앱 라벨이 "내 할 일 CSV 내보내기" 인데 예전엔 **워크스페이스 전원의 할 일**을
        // 통째로 내보냈다(VIEWER 도 가능). 팀 데이터가 개인 백업처럼 빠져나가는 경로였다.
        // 라벨대로 "내 것"(담당자이거나 내가 만든 것)만 내보낸다.
        User exporter = workspaceResolver.getUser(userEmail);
        List<Todo> todos = todoRepository.findByWorkspaceAndArchivedFalseOrderByIdDesc(workspace)
                .stream()
                .filter(t -> {
                    boolean mine = t.getCreatedBy() != null && t.getCreatedBy().getId().equals(exporter.getId());
                    boolean assigned = t.getAssignees() != null
                            && t.getAssignees().stream().anyMatch(u -> u.getId().equals(exporter.getId()));
                    return mine || assigned;
                })
                .toList();

        DateTimeFormatter dateFmt = DateTimeFormatter.ofPattern("yyyy-MM-dd");
        DateTimeFormatter dtFmt = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

        StringBuilder sb = new StringBuilder();
        sb.append("ID,제목,상태,우선순위,시작일,마감일,프로젝트,담당자,작성자,생성일,완료일,내용\n");
        for (Todo t : todos) {
            String assignees = (t.getAssignees() == null) ? "" : t.getAssignees().stream()
                    .map(u -> u.getName() != null ? u.getName() : u.getEmail())
                    .collect(Collectors.joining("; "));
            String creator = (t.getCreatedBy() == null) ? ""
                    : (t.getCreatedBy().getName() != null ? t.getCreatedBy().getName() : t.getCreatedBy().getEmail());
            sb.append(csv(t.getId()))
              .append(',').append(csv(t.getTitle()))
              .append(',').append(csv(statusLabel(t.getStatus())))
              .append(',').append(csv(priorityLabel(t.getPriority())))
              .append(',').append(csv(t.getStartAt() == null ? "" : t.getStartAt().format(dateFmt)))
              .append(',').append(csv(t.getDueDate() == null ? "" : t.getDueDate().format(dateFmt)))
              .append(',').append(csv(t.getProject() == null ? "" : t.getProject().getName()))
              .append(',').append(csv(assignees))
              .append(',').append(csv(creator))
              .append(',').append(csv(t.getCreatedAt() == null ? "" : t.getCreatedAt().format(dtFmt)))
              .append(',').append(csv(t.getDoneAt() == null ? "" : t.getDoneAt().format(dtFmt)))
              .append(',').append(csv(t.getContent()))
              .append('\n');
        }

        // UTF-8 BOM 선행 → Excel에서 한글 깨짐 방지
        byte[] bom = new byte[]{(byte) 0xEF, (byte) 0xBB, (byte) 0xBF};
        byte[] body = sb.toString().getBytes(StandardCharsets.UTF_8);
        byte[] out = new byte[bom.length + body.length];
        System.arraycopy(bom, 0, out, 0, bom.length);
        System.arraycopy(body, 0, out, bom.length, body.length);

        String filename = "plando-todos-" + LocalDate.now() + ".csv";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(out);
    }

    /** RFC 4180 CSV 필드 이스케이프 — 콤마/따옴표/개행 포함 시 따옴표로 감싸고 따옴표는 중복 처리 */
    private static String csv(Object value) {
        if (value == null) return "";
        String s = String.valueOf(value);
        if (s.contains(",") || s.contains("\"") || s.contains("\n") || s.contains("\r")) {
            s = "\"" + s.replace("\"", "\"\"") + "\"";
        }
        return s;
    }

    private static String statusLabel(String s) {
        if (s == null) return "";
        return switch (s) {
            case "TODO" -> "할 일";
            case "IN_PROGRESS" -> "진행 중";
            case "DONE" -> "완료";
            default -> s; // 커스텀 상태는 key 그대로 (CSV 내보내기용)
        };
    }

    private static String priorityLabel(Priority p) {
        if (p == null) return "";
        switch (p) {
            case HIGH: return "높음";
            case MEDIUM: return "중간";
            case LOW: return "낮음";
            default: return p.name();
        }
    }

    // ─── 아카이브 관련 엔드포인트 ─────────────────────────────────────

    @GetMapping("/archived")
    public List<TodoResponseDto> getArchivedTodos(
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId
    ) {
        String userEmail = authentication.getName();
        Workspace workspace = workspaceResolver.resolve(userEmail, workspaceId);
        User currentUser = workspaceResolver.getUser(userEmail);

        List<Todo> todos = todoRepository.findByWorkspaceAndArchivedTrueOrderByIdDesc(workspace);
        Set<Long> todoIds = todos.stream().map(Todo::getId).collect(Collectors.toSet());
        Set<Long> focusedIds = resolveFocusedIds(currentUser.getId(), todoIds);
        Map<Long, int[]> subtaskCounts = resolveSubtaskCounts(todoIds);
        var tagsByTodo = resolveTags(todoIds);
        Map<Long, int[]> checklistCounts = resolveChecklistCounts(todoIds);
        return todos.stream()
                .map(todo -> convertToDto(todo, null, focusedIds, subtaskCounts, tagsByTodo, checklistCounts))
                .collect(Collectors.toList());
    }

    @Transactional
    @PatchMapping("/{id}/archive")
    public ResponseEntity<?> archiveTodo(
            @PathVariable Long id,
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId
    ) {
        String userEmail = authentication.getName();
        Workspace workspace = workspaceResolver.resolve(userEmail, workspaceId);
        Optional<Todo> opt = todoRepository.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();
        Todo todo = opt.get();
        if (!isSameWorkspace(todo, workspace)) return ResponseEntity.status(HttpStatus.FORBIDDEN).body("다른 워크스페이스의 작업입니다.");
        // 보관 = 편집(역할 기반, MEMBER 이상, 샘플 차단)
        permissionService.requireCanEditTodo(userEmail, todo);
        todo.setArchived(true);
        todoRepository.save(todo);
        locationTriggerRepository.deleteAllByTodoId(id);
        // 보관은 DELETED가 아니라 archived=true인 UPDATE로 내보낸다. 웹의 TODO_UPDATED 핸들러가
        // archived가 참이면 그 행을 목록에서 치우고, 복원 시에는 archived=false로 되살아나야 한다.
        User actor = workspaceResolver.getUser(userEmail);
        todoEventPublisher.updated(workspace.getId(), id, patchOf("archived", true), actor);
        // 자식도 함께 보관한다. 부모가 활성 범위 밖인데 자식만 남으면 부모 없는 항목이 목록에 떠돈다.
        cascadeArchive(workspace, id, true, actor);
        return ResponseEntity.ok().build();
    }

    // archiveTodo 와 짝이므로 트랜잭션도 같아야 한다. 없으면 부모 save 와 cascadeArchive 가
    // 따로 커밋돼서, 중간에 실패하면 부모만 복원되고 자식은 보관함에 남는다.
    @Transactional
    @PatchMapping("/{id}/restore")
    public ResponseEntity<?> restoreTodo(
            @PathVariable Long id,
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId
    ) {
        String userEmail = authentication.getName();
        Workspace workspace = workspaceResolver.resolve(userEmail, workspaceId);
        Optional<Todo> opt = todoRepository.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();
        Todo todo = opt.get();
        if (!isSameWorkspace(todo, workspace)) return ResponseEntity.status(HttpStatus.FORBIDDEN).body("다른 워크스페이스의 작업입니다.");
        // 복원 = 편집(역할 기반, MEMBER 이상, 샘플 차단)
        permissionService.requireCanEditTodo(userEmail, todo);
        todo.setArchived(false);
        todoRepository.save(todo);
        User actor = workspaceResolver.getUser(userEmail);
        todoEventPublisher.updated(workspace.getId(), id, patchOf("archived", false), actor);
        /* 자식도 함께 복원한다. 부모를 되살렸는데 자식이 보관함에 남아 있으면 진행률이
           비어 보인다. 부모와 무관하게 따로 보관해 둔 자식까지 함께 돌아오는 한계가 있지만,
           "부모를 복원하면 그 작업이 통째로 돌아온다"가 더 자연스러운 기대다. */
        cascadeArchive(workspace, id, false, actor);
        return ResponseEntity.ok().build();
    }

    @Transactional
    @PostMapping("/archive-done")
    public ResponseEntity<?> archiveDoneTodos(
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId
    ) {
        String userEmail = authentication.getName();
        Workspace workspace = workspaceResolver.resolve(userEmail, workspaceId);
        // 일괄 보관 = 편집 역할(MEMBER 이상). VIEWER 차단.
        permissionService.requireRole(userEmail, workspace, com.example.todo.entity.WorkspaceRole.MEMBER);
        // 샘플은 제외한다. 단건 보관은 requireCanEditTodo 가 샘플을 막는데(403) 여기는 역할만 봐서,
        // 둘러보기에서 "완료된 작업 아카이브"를 누르면 읽기 전용인 체험 데이터가 통째로 사라졌다.
        // 조회 단계에서 걸러 이벤트도 발행되지 않게 한다.
        List<Todo> doneTodos = todoRepository.findByWorkspaceAndArchivedFalseAndDoneAtIsNotNullOrderByIdDesc(workspace)
                .stream()
                .filter(t -> !Boolean.TRUE.equals(t.getIsSample()))
                .toList();
        doneTodos.forEach(t -> t.setArchived(true));
        todoRepository.saveAll(doneTodos);
        doneTodos.forEach(t -> locationTriggerRepository.deleteAllByTodoId(t.getId()));
        // 일괄 보관도 건별로 발행한다. 수신 측은 전부 id로 행을 찾으므로 묶음 형식을 새로 만들 이유가 없다.
        User actor = workspaceResolver.getUser(userEmail);
        doneTodos.forEach(t -> todoEventPublisher.updated(
                workspace.getId(), t.getId(), patchOf("archived", true), actor));
        return ResponseEntity.ok(Map.of("archived", doneTodos.size()));
    }

    /**
     * 한 문장으로 바로 추가 — 시리·단축어용.
     *
     * 왜 따로 두는가: 시리는 문장 하나만 넘겨준다("내일 3시 킥오프 미팅"). 그걸 제목에
     * 통째로 넣으면 마감이 비어서, **말로 넣은 할 일만 날짜가 없는** 상태가 된다.
     * 파싱을 클라이언트(Swift)에 두면 앱의 규칙과 두 벌이 되어 조용히 어긋나므로 서버에서 한다.
     *
     * 생성 자체는 기존 경로를 그대로 탄다 — 권한 검사·기본값이 한 곳에만 있게.
     */
    @PostMapping("/quick")
    public ResponseEntity<TodoResponseDto> quickCreate(
            @RequestBody Map<String, String> body,
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId
    ) {
        String text = body.get("text");
        if (text == null || text.isBlank()) {
            throw new com.example.todo.exception.ApiException(400, "무엇을 추가할지 적어주세요.");
        }
        var draft = quickCaptureService.parse(text);

        TodoRequestDto dto = new TodoRequestDto();
        dto.setTitle(draft.title());
        dto.setStatus("TODO");
        dto.setPriority(com.example.todo.entity.Priority.valueOf(draft.priority()));
        if (draft.dueDate() != null)   dto.setDueDate(java.time.LocalDate.parse(draft.dueDate()));
        if (draft.startTime() != null) dto.setStartTime(java.time.LocalTime.parse(draft.startTime()));

        return createTodo(dto, authentication, workspaceId);
    }

    @PostMapping
    public ResponseEntity<TodoResponseDto> createTodo(
            @Valid @RequestBody TodoRequestDto dto,
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId
    ) {
        String userEmail = authentication.getName();
        User currentUser = workspaceResolver.getUser(userEmail);
        Workspace workspace = workspaceResolver.resolve(userEmail, workspaceId);
        // 생성 = 편집 역할(MEMBER 이상). VIEWER 차단.
        permissionService.requireCanCreateContent(userEmail, workspace);

        /* 같은 열쇠로 이미 만든 것이 있으면 **새로 만들지 않고 그것을 돌려준다.**
           오프라인에서 적은 것을 앱이 재전송할 때, 서버는 이미 만들었는데 응답만 못 받은
           경우가 있다. 그대로 다시 만들면 같은 할 일이 두 개 생긴다.
           재전송이 몇 번을 와도 결과가 같아야 앱이 마음 놓고 다시 보낼 수 있다. */
        if (dto.getClientKey() != null && !dto.getClientKey().isBlank()) {
            var existing = todoRepository.findByWorkspaceAndClientKey(workspace, dto.getClientKey());
            if (existing.isPresent()) {
                return ResponseEntity.ok(convertToDtoForUser(existing.get(), currentUser.getId()));
            }
        }

        todoService.validateParentAssignment(dto.getParentId(), null, workspace);

        Todo todo = Todo.builder()
                .clientKey(dto.getClientKey())   // 재전송 중복 방지 열쇠(없으면 null)
                .title(dto.getTitle())
                .content(dto.getContent())
                .status(dto.getStatus())
                /* 우선순위 미지정이면 MEDIUM.
                   엔티티는 @Column(nullable=false) 인데 운영 DB 컬럼은 실제로 nullable 이라
                   (ddl-auto=validate 는 nullability 를 검사하지 않아 드리프트가 통과했다)
                   지금은 null 이 그대로 저장된다 — 이미 9건이 그렇다. 통합 테스트는 엔티티에서
                   스키마를 만들어 NOT NULL 이 걸리므로 같은 요청이 거기서만 실패한다.
                   값을 채워 양쪽을 같게 만든다. */
                .priority(dto.getPriority() != null ? dto.getPriority() : com.example.todo.entity.Priority.MEDIUM)
                .startAt(dto.getStartAt())
                .dueDate(dto.getDueDate())
                .startTime(dto.getStartTime())
                .endTime(dto.getEndTime())
                .project(resolveProjectRef(dto.getProjectId(), workspace))
                .parentId(dto.getParentId())
                .assignees(getWorkspaceUsersByEmails(workspace, dto.getAssignees()))
                .createdBy(currentUser)
                .workspace(workspace)
                .isSample(false)
                .locationLat(dto.getLocationLat())
                .locationLng(dto.getLocationLng())
                .locationAddress(dto.getLocationAddress())
                .locationName(dto.getLocationName())
                .build();

        // 상태 key 검증 + 완료 상태로 생성 시 doneAt 정합
        if (!workflowStatusService.isValidKey(workspace, todo.getStatus())) {
            todo.setStatus(workflowStatusService.defaultStatusKey(workspace));
        }
        todo.applyStatus(todo.getStatus(), workflowStatusService.isDone(workspace, todo.getStatus()));

        if (dto.getLocationName() != null && !dto.getLocationName().isBlank()
                && dto.getLocationLat() == null && dto.getLocationLng() == null) {
            KakaoGeocodingService.GeoResult geo = geocodingService.geocode(dto.getLocationName());
            if (geo != null) {
                todo.setLocationLat(geo.lat());
                todo.setLocationLng(geo.lng());
                todo.setLocationAddress(geo.address());
                todo.setLocationName(geo.placeName());
            }
        }

        Todo savedTodo = todoRepository.save(todo);

        savedTodo.getAssignees().forEach(assignee -> {
            if (!assignee.getEmail().equals(userEmail)) {
                notificationService.createNotification(
                        assignee.getEmail(),
                        userEmail,
                        NotificationType.TASK_ASSIGNED.name(),
                        "새 작업에 담당자로 지정되었어요",
                        "\"" + savedTodo.getTitle() + "\" 작업에 담당자로 지정되었어요.",
                        savedTodo.getId(),
                        workspace.getId()
                );
            }
        });

        /* 만든 것도 이력에 남긴다.
           [고치는 결함] 생성 기록이 없어서 변경내역이 늘 "무엇을 바꿨다" 부터 시작했다.
           맨 처음이 비어 있으면 이력을 언제부터 믿어야 할지 알 수 없다. */
        logService.saveLog(savedTodo.getId(), "created", "", savedTodo.getTitle(), userEmail);

        // 생성은 patch로 만들 수 없다 — 받는 쪽에 그 행이 아예 없다. 응답과 같은 DTO를 그대로 싣는다.
        TodoResponseDto created = convertToDtoForUser(savedTodo, currentUser.getId());
        todoEventPublisher.added(workspace.getId(), created, currentUser);
        return ResponseEntity.ok(created);
    }

    @Transactional
    @PutMapping("/{id}")
    public ResponseEntity<?> updateTodo(
            @PathVariable Long id,
            @Valid @RequestBody TodoRequestDto dto,
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId
    ) {
        String userEmail = authentication.getName();
        Workspace workspace = workspaceResolver.resolve(userEmail, workspaceId);

        Optional<Todo> optionalTodo = todoRepository.findById(id);
        if (optionalTodo.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Todo todo = optionalTodo.get();

        if (!isSameWorkspace(todo, workspace)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("다른 워크스페이스의 작업입니다.");
        }

        // 편집 = 역할 기반(MEMBER 이상, 샘플 차단). 협업 모델이라 작성자/담당자 제한 없음.
        permissionService.requireCanEditTodo(userEmail, todo);

        Set<String> oldAssigneeEmails = todo.getAssignees().stream()
                .map(User::getEmail)
                .collect(Collectors.toSet());

        todo.setTitle(dto.getTitle());
        todo.setContent(dto.getContent());
        String newStatusForUpdate = dto.getStatus();
        boolean nowDoneUpd = workflowStatusService.isDone(workspace, newStatusForUpdate);
        todo.applyStatus(newStatusForUpdate, nowDoneUpd);
        if (nowDoneUpd) {
            locationTriggerService.disableAllForTodo(todo.getId());
        }
        todo.setPriority(dto.getPriority());
        todo.setStartAt(dto.getStartAt());
        todo.setDueDate(dto.getDueDate());
        todo.setStartTime(dto.getStartTime());
        todo.setEndTime(dto.getEndTime());

        if (!Objects.equals(todo.getParentId(), dto.getParentId())) {
            todoService.validateParentAssignment(dto.getParentId(), todo.getId(), workspace);
            todo.setParentId(dto.getParentId());
        }

        List<User> newAssignees = getWorkspaceUsersByEmails(workspace, dto.getAssignees());
        todo.setAssignees(newAssignees);

        newAssignees.stream()
                .filter(a -> !a.getEmail().equals(userEmail))
                .filter(a -> !oldAssigneeEmails.contains(a.getEmail()))
                .forEach(a -> notificationService.createNotification(
                        a.getEmail(),
                        userEmail,
                        NotificationType.TASK_ASSIGNED.name(),
                        "새 작업에 담당자로 지정되었어요",
                        "\"" + todo.getTitle() + "\" 작업에 담당자로 지정되었어요.",
                        todo.getId(),
                        workspace.getId()
                ));

        User currentUser = workspaceResolver.getUser(userEmail);
        TodoResponseDto updated = convertToDtoForUser(todoRepository.save(todo), currentUser.getId());

        // PUT은 본문을 통째로 덮어쓴다 — 이 엔드포인트가 실제로 쓰는 필드만 싣는다.
        // (위치·프로젝트·보관은 여기서 건드리지 않으므로 넣지 않는다.)
        Map<String, Object> patch = new HashMap<>();
        patch.put("title", updated.getTitle());
        patch.put("content", updated.getContent());
        patch.put("status", updated.getStatus());
        // 완료 여부는 클라이언트가 doneAt으로 먼저 판정한다(isTodoDone). status만 보내면 행이 어긋난다.
        patch.put("doneAt", updated.getDoneAt());
        patch.put("priority", updated.getPriority());
        patch.put("startAt", updated.getStartAt());
        patch.put("dueDate", updated.getDueDate());
        patch.put("startTime", updated.getStartTime());
        patch.put("endTime", updated.getEndTime());
        patch.put("parentId", updated.getParentId());
        patch.put("assignees", updated.getAssignees());
        todoEventPublisher.updated(workspace.getId(), todo.getId(), patch, currentUser);

        return ResponseEntity.ok(updated);
    }

    @Transactional
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteTodo(
            @PathVariable Long id,
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId
    ) {
        String userEmail = authentication.getName();
        Workspace workspace = workspaceResolver.resolve(userEmail, workspaceId);

        Optional<Todo> optionalTodo = todoRepository.findById(id);
        if (optionalTodo.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Todo todo = optionalTodo.get();

        if (!isSameWorkspace(todo, workspace)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("다른 워크스페이스의 작업입니다.");
        }

        // 삭제 = 작성자 본인 || ADMIN 이상 (담당자는 삭제 불가). 샘플 차단.
        permissionService.requireCanDeleteTodo(userEmail, todo);

        final User actor = workspaceResolver.getUser(userEmail);

        // 반복 일정 인스턴스 삭제 (원본인 경우)
        recurrenceRepository.findBySourceTodoId(id).ifPresent(rec -> {
            List<Todo> instances = todoRepository.findByRecurrenceSourceId(rec.getId());
            List<Long> instanceIds = instances.stream().map(Todo::getId).collect(Collectors.toList());
            instanceIds.forEach(instanceId -> {
                locationTriggerRepository.deleteAllByTodoId(instanceId);
                checklistRepository.deleteByTodoId(instanceId);
                purgeTodoAssociations(instanceId);
            });
            if (!instanceIds.isEmpty()) {
                todoRepository.promoteSubtasksOf(instanceIds); // 자식은 삭제하지 않고 최상위로 승격
            }
            todoRepository.deleteAll(instances);
            recurrenceRepository.delete(rec);
            // 원본을 지우면 인스턴스도 같이 사라진다 — 건별로 발행하지 않으면 남의 보드에 유령 행이 남는다.
            instanceIds.forEach(instanceId -> todoEventPublisher.deleted(workspace.getId(), instanceId, actor));
        });

        // 부모 삭제 시 서브태스크는 삭제하지 않고 최상위(parentId = null)로 승격
        todoRepository.promoteSubtasksOf(List.of(id));

        locationTriggerRepository.deleteAllByTodoId(id);
        checklistRepository.deleteByTodoId(id);
        todoFocusRepository.deleteByTodoId(id);
        purgeTodoAssociations(id);
        todoRepository.delete(todo);
        todoEventPublisher.deleted(workspace.getId(), id, actor);
        return ResponseEntity.ok().build();
    }

    @Transactional
    @PutMapping("/{id}/status")
    public ResponseEntity<?> updateTodoStatus(
            @PathVariable Long id,
            @RequestBody Map<String, String> request,
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId
    ) {
        String userEmail = authentication.getName();
        Workspace workspace = workspaceResolver.resolve(userEmail, workspaceId);

        Optional<Todo> optionalTodo = todoRepository.findById(id);
        if (optionalTodo.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("할 일을 찾을 수 없습니다.");
        }

        Todo todo = optionalTodo.get();

        if (!isSameWorkspace(todo, workspace)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("다른 워크스페이스의 작업입니다.");
        }

        // 상태 변경 = 편집(역할 기반, MEMBER 이상, 샘플 차단)
        permissionService.requireCanEditTodo(userEmail, todo);

        String newStatus = request.get("status");
        if (newStatus == null || newStatus.isBlank()) {
            return ResponseEntity.badRequest().body("status 값이 필요합니다.");
        }

        if (!workflowStatusService.isValidKey(workspace, newStatus)) {
            return ResponseEntity.badRequest().body("유효하지 않은 상태입니다.");
        }
        boolean nowDone = workflowStatusService.isDone(workspace, newStatus);

        /* 변경 이력을 여기서도 남긴다.
           [고치는 결함] 이 경로(체크박스 완료·상태 칩)는 로그를 하나도 쓰지 않았고,
           상세 모달의 필드 수정(PATCH /todos/{id})만 남겼다. 그래서 같은 "완료" 인데
           어디서 눌렀느냐에 따라 이력에 남기도 하고 안 남기도 했다 — 이력이 들쭉날쭉하면
           있는 것도 못 믿는다. */
        String beforeStatus = todo.getStatus();
        todo.applyStatus(newStatus, nowDone);
        todoRepository.save(todo);
        logService.saveLog(todo.getId(), "status", beforeStatus, todo.getStatus(), userEmail);
        if (nowDone) {
            locationTriggerService.disableAllForTodo(todo.getId());
        }

        // status만 보내면 안 된다 — 커스텀 상태 때문에 클라이언트는 doneAt으로 완료를 먼저 판정한다(isTodoDone).
        Map<String, Object> patch = new HashMap<>();
        patch.put("status", todo.getStatus());
        patch.put("doneAt", todo.getDoneAt());
        todoEventPublisher.updated(workspace.getId(), todo.getId(), patch,
                workspaceResolver.getUser(userEmail));

        return ResponseEntity.ok().body("상태가 업데이트되었습니다.");
    }

    /**
     * 포커스(⚡) 토글 — per-user. 호출자에 대해서만 focus row 추가/삭제.
     * 다른 워크스페이스 멤버에게는 영향 없음.
     */
    @Transactional
    @PatchMapping("/{id}/focus")
    public ResponseEntity<?> updateFocus(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body,
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId
    ) {
        String userEmail = authentication.getName();
        Workspace workspace = workspaceResolver.resolve(userEmail, workspaceId);
        User currentUser = workspaceResolver.getUser(userEmail);

        Optional<Todo> opt = todoRepository.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();
        Todo todo = opt.get();

        if (!isSameWorkspace(todo, workspace)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("다른 워크스페이스의 작업입니다.");
        }
        ResponseEntity<?> sampleErr = assertNotSample(todo);
        if (sampleErr != null) return sampleErr;

        Object value = body.get("focused");
        boolean focused = (value instanceof Boolean)
                ? (Boolean) value
                : Boolean.parseBoolean(String.valueOf(value));

        Long userId = currentUser.getId();
        if (focused) {
            if (!todoFocusRepository.existsByUserIdAndTodoId(userId, todo.getId())) {
                todoFocusRepository.save(TodoFocus.builder()
                        .userId(userId)
                        .todoId(todo.getId())
                        .build());
            }
        } else {
            todoFocusRepository.deleteByUserIdAndTodoId(userId, todo.getId());
        }
        // 브로드캐스트하지 않는다. 포커스(⚡)는 TodoFocus(userId, todoId)라 호출자에게만 바뀐 값이고,
        // 이 이벤트를 받는 쪽은 자기 이벤트를 걸러낸 "남들"뿐이다. focused를 실어 보내면
        // 아무것도 안 바꾼 사람들의 ⚡가 켜지거나 꺼진다.
        return ResponseEntity.ok().build();
    }

    @PatchMapping("/{id}/priority")
    public ResponseEntity<?> updatePriority(
            @PathVariable Long id,
            @RequestBody Map<String, String> body,
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId
    ) {
        String userEmail = authentication.getName();
        Workspace workspace = workspaceResolver.resolve(userEmail, workspaceId);

        Todo todo = todoRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("작업을 찾을 수 없습니다."));
        if (!isSameWorkspace(todo, workspace)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("다른 워크스페이스의 작업입니다.");
        }

        ResponseEntity<?> sampleErrP = assertNotSample(todo);
        if (sampleErrP != null) return sampleErrP;

        String priority = body.get("priority");
        todoService.updatePriority(id, priority, userEmail, workspaceId);
        // 요청 문자열이 아니라 저장된 값을 싣는다 — 서비스가 대문자 정규화·검증을 거쳐 넣는다.
        Todo savedP = todoRepository.findById(id).orElse(todo);
        todoEventPublisher.updated(workspace.getId(), id, patchOf("priority", savedP.getPriority()),
                workspaceResolver.getUser(userEmail));
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getTodoById(
            @PathVariable Long id,
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId
    ) {
        String userEmail = authentication.getName();
        Workspace workspace = workspaceResolver.resolve(userEmail, workspaceId);

        Todo todo = todoRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("작업을 찾을 수 없습니다."));

        if (!isSameWorkspace(todo, workspace)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("다른 워크스페이스의 작업입니다.");
        }

        User currentUser = workspaceResolver.getUser(userEmail);
        return ResponseEntity.ok(convertToDtoForUser(todo, currentUser.getId()));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<?> updateTodoField(
            @PathVariable Long id,
            @RequestBody Map<String, String> body,
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId
    ) {
        String field = body.get("field");
        String value = body.get("value");

        /* value=null 은 "이 필드를 비운다"는 뜻이다.
           예전엔 null을 무조건 400으로 거절해서, 클라이언트가 마감일·시작일·프로젝트·본문을
           지우면 화면에서는 지워지고 서버에는 그대로 남았다(앱은 롤백도 안 해 사용자가 끝까지
           모름). TodoService.updateField는 이미 이 필드들의 null을 처리한다 —
           막고 있던 건 이 가드뿐이었다.
           제목·상태·우선순위·담당자는 비울 수 없으므로 여전히 거절한다. */
        if (field == null || !body.containsKey("value")) {
            return ResponseEntity.badRequest().body("field와 value는 필수입니다.");
        }
        if (value == null && !CLEARABLE_FIELDS.contains(field)) {
            return ResponseEntity.badRequest().body("'" + field + "'는 비울 수 없는 항목입니다.");
        }

        String userEmail = authentication.getName();
        Workspace workspace = workspaceResolver.resolve(userEmail, workspaceId);

        Todo todo = todoRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("작업을 찾을 수 없습니다."));
        if (!isSameWorkspace(todo, workspace)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("다른 워크스페이스의 작업입니다.");
        }

        ResponseEntity<?> sampleErrF = assertNotSample(todo);
        if (sampleErrF != null) return sampleErrF;

        todoService.updateField(id, field, value, userEmail, workspaceId);
        // 저장 결과로 patch를 만든다 — updateField가 파싱·정규화(프로젝트 참조, 워크스페이스 밖 담당자
        // 제거, 상태→doneAt)를 하므로 요청 문자열을 그대로 내보내면 실제 저장값과 어긋난다.
        todoRepository.findById(id).ifPresent(savedF -> todoEventPublisher.updated(
                workspace.getId(), id, fieldPatch(savedF, field), workspaceResolver.getUser(userEmail)));
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{id}/logs")
    public ResponseEntity<?> getLogs(
            @PathVariable Long id,
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId
    ) {
        String userEmail = authentication.getName();
        Workspace workspace = workspaceResolver.resolve(userEmail, workspaceId);

        Todo todo = todoRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("작업을 찾을 수 없습니다."));
        if (!isSameWorkspace(todo, workspace)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("다른 워크스페이스의 작업입니다.");
        }

        return ResponseEntity.ok(logService.getLogsForTodo(id));
    }

    // ─── 지도 탭 전용 엔드포인트 ───────────────────────────────────

    /** 위치가 등록된 Todo 목록 조회 */
    @GetMapping("/location")
    public List<TodoResponseDto> getLocationTodos(
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId
    ) {
        String userEmail = authentication.getName();
        Workspace workspace = workspaceResolver.resolve(userEmail, workspaceId);
        User currentUser = workspaceResolver.getUser(userEmail);

        List<Todo> todos = todoRepository.findByWorkspaceAndArchivedFalseAndLocationLatIsNotNullOrderByIdDesc(workspace);
        Set<Long> todoIds = todos.stream().map(Todo::getId).collect(Collectors.toSet());
        Set<Long> focusedIds = resolveFocusedIds(currentUser.getId(), todoIds);
        Map<Long, int[]> subtaskCounts = resolveSubtaskCounts(todoIds);
        var tagsByTodo = resolveTags(todoIds);
        Map<Long, int[]> checklistCounts = resolveChecklistCounts(todoIds);
        return todos.stream()
                .map(todo -> convertToDto(todo, null, focusedIds, subtaskCounts, tagsByTodo, checklistCounts))
                .collect(Collectors.toList());
    }

    /** Todo 위치 정보 저장/수정 */
    @PatchMapping("/{id}/location")
    public ResponseEntity<?> updateLocation(
            @PathVariable Long id,
            @Valid @RequestBody TodoLocationDto dto,
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId
    ) {
        String userEmail = authentication.getName();
        Workspace workspace = workspaceResolver.resolve(userEmail, workspaceId);

        Optional<Todo> optionalTodo = todoRepository.findById(id);
        if (optionalTodo.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Todo todo = optionalTodo.get();

        if (!isSameWorkspace(todo, workspace)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("다른 워크스페이스의 작업입니다.");
        }

        // 위치 설정 = 편집(역할 기반, MEMBER 이상, 샘플 차단)
        permissionService.requireCanEditTodo(userEmail, todo);

        todo.setLocationLat(dto.getLocationLat());
        todo.setLocationLng(dto.getLocationLng());
        todo.setLocationAddress(dto.getLocationAddress());
        todo.setLocationName(dto.getLocationName());

        User currentUser = workspaceResolver.getUser(userEmail);
        TodoResponseDto saved = convertToDtoForUser(todoRepository.save(todo), currentUser.getId());

        Map<String, Object> patch = new HashMap<>();
        patch.put("locationLat", saved.getLocationLat());
        patch.put("locationLng", saved.getLocationLng());
        patch.put("locationAddress", saved.getLocationAddress());
        patch.put("locationName", saved.getLocationName());
        todoEventPublisher.updated(workspace.getId(), todo.getId(), patch, currentUser);

        return ResponseEntity.ok(saved);
    }

    /** Todo 위치 정보 삭제 */
    @DeleteMapping("/{id}/location")
    public ResponseEntity<?> deleteLocation(
            @PathVariable Long id,
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId
    ) {
        String userEmail = authentication.getName();
        Workspace workspace = workspaceResolver.resolve(userEmail, workspaceId);

        Optional<Todo> optionalTodo = todoRepository.findById(id);
        if (optionalTodo.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Todo todo = optionalTodo.get();

        if (!isSameWorkspace(todo, workspace)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("다른 워크스페이스의 작업입니다.");
        }

        // 위치 삭제 = 편집(역할 기반, MEMBER 이상, 샘플 차단)
        permissionService.requireCanEditTodo(userEmail, todo);

        todo.setLocationLat(null);
        todo.setLocationLng(null);
        todo.setLocationAddress(null);
        todo.setLocationName(null);

        todoRepository.save(todo);

        // 값이 전부 null이라 Map.of를 못 쓴다(null 값 금지). "비웠다"를 전달하려면 키가 있어야 한다.
        Map<String, Object> patch = new HashMap<>();
        patch.put("locationLat", null);
        patch.put("locationLng", null);
        patch.put("locationAddress", null);
        patch.put("locationName", null);
        todoEventPublisher.updated(workspace.getId(), todo.getId(), patch,
                workspaceResolver.getUser(userEmail));

        return ResponseEntity.ok().build();
    }

    /** 생성 payload의 projectId → Project 참조 (워크스페이스 일치 검증, null = 인박스) */
    private Project resolveProjectRef(Long projectId, Workspace workspace) {
        if (projectId == null) return null;
        return projectRepository.findByIdAndWorkspace(projectId, workspace)
                .orElseThrow(() -> new ApiException(404, "프로젝트를 찾을 수 없습니다."));
    }

    /**
     * 마스터 변환기. focusedIds는 호출자(현재 사용자) 기준으로 미리 계산돼서 들어옴.
     * 리스트 응답에서는 N+1 피하려고 한 번에 fetch해서 전달, 단일 응답에서는 convertToDtoForUser 사용.
     */
    private TodoResponseDto convertToDto(Todo todo, Set<Long> recurringSourceIds, Set<Long> focusedIds, Map<Long, int[]> subtaskCounts,
                                         Map<Long, List<com.example.todo.dto.TagResponse>> tagsByTodo,
                                         Map<Long, int[]> checklistCounts) {
        List<AssigneeDto> assignees = todo.getAssignees().stream()
                .map(user -> new AssigneeDto(user.getEmail(), user.getName(), user.getProfileImageUrl()))
                .collect(Collectors.toList());

        boolean hasRecurrence = recurringSourceIds != null && recurringSourceIds.contains(todo.getId());
        boolean focused = focusedIds != null && focusedIds.contains(todo.getId());
        int[] subCounts = subtaskCounts != null
                ? subtaskCounts.getOrDefault(todo.getId(), EMPTY_SUBTASK_COUNTS)
                : EMPTY_SUBTASK_COUNTS;
        int[] chkCounts = checklistCounts != null
                ? checklistCounts.getOrDefault(todo.getId(), EMPTY_CHECKLIST_COUNTS)
                : EMPTY_CHECKLIST_COUNTS;

        return TodoResponseDto.builder()
                .id(todo.getId())
                .title(todo.getTitle())
                .content(todo.getContent())
                .status(todo.getStatus())
                .priority(todo.getPriority())
                .startAt(todo.getStartAt())
                .dueDate(todo.getDueDate())
                .startTime(todo.getStartTime())
                .endTime(todo.getEndTime())
                .projectId(todo.getProject() != null ? todo.getProject().getId() : null)
                .assignees(assignees)
                .userEmail(todo.getCreatedBy() != null ? todo.getCreatedBy().getEmail() : null)
                .userName(todo.getCreatedBy() != null ? todo.getCreatedBy().getName() : null)
                .locationLat(todo.getLocationLat())
                .locationLng(todo.getLocationLng())
                .locationAddress(todo.getLocationAddress())
                .locationName(todo.getLocationName())
                .archived(todo.getArchived())
                .isSample(todo.getIsSample())
                .createdAt(todo.getCreatedAt())
                .doneAt(todo.getDoneAt())
                .hasRecurrence(hasRecurrence)
                .recurrenceSourceId(todo.getRecurrenceSourceId())
                .parentId(todo.getParentId())
                .subtaskTotal(subCounts[0])
                .subtaskDone(subCounts[1])
                .checklistTotal(chkCounts[0])
                .checklistDone(chkCounts[1])
                .focused(focused)
                .tags(tagsByTodo != null ? tagsByTodo.getOrDefault(todo.getId(), List.of()) : List.of())
                .build();
    }

    private static final int[] EMPTY_SUBTASK_COUNTS = {0, 0};

    /**
     * 부모의 보관 상태를 자식에게 전파한다(깊이 1단계 정책상 한 단계면 충분).
     * 이미 목표 상태인 자식은 건드리지 않는다 — 불필요한 UPDATE와 브로드캐스트를 막는다.
     */
    private void cascadeArchive(Workspace workspace, Long parentId, boolean archived, User actor) {
        // 샘플은 제외. 지금은 부모가 requireCanEditTodo 를 통과한 뒤에만 여기 오므로
        // 샘플 자식에 닿을 경로가 없지만, 호출처가 늘어나도 읽기 전용이 깨지지 않게 한 겹 둔다.
        List<Todo> children = todoRepository.findByParentIdInAndArchived(List.of(parentId), !archived)
                .stream()
                .filter(t -> !Boolean.TRUE.equals(t.getIsSample()))
                .toList();
        if (children.isEmpty()) return;
        for (Todo child : children) {
            child.setArchived(archived);
            if (archived) locationTriggerRepository.deleteAllByTodoId(child.getId());
        }
        todoRepository.saveAll(children);
        for (Todo child : children) {
            todoEventPublisher.updated(workspace.getId(), child.getId(), patchOf("archived", archived), actor);
        }
    }

    /** value=null 로 "비우기"가 허용되는 필드 (TodoService.updateField가 null을 처리하는 것들). */
    private static final Set<String> CLEARABLE_FIELDS = Set.of(
            "startAt", "dueDate", "startTime", "endTime", "projectId", "parentId", "content");
    private static final int[] EMPTY_CHECKLIST_COUNTS = {0, 0};

    /** 단일 todo 응답용 — 호출자 userId 기준으로 recurringSourceIds / focused / 서브태스크·체크리스트 카운트 즉시 fetch. */
    private TodoResponseDto convertToDtoForUser(Todo todo, Long currentUserId) {
        Set<Long> recurringSourceIds = recurrenceRepository.findBySourceTodoIdIn(Set.of(todo.getId())).stream()
                .map(r -> r.getSourceTodoId())
                .collect(Collectors.toSet());
        boolean focused = todoFocusRepository.existsByUserIdAndTodoId(currentUserId, todo.getId());
        Set<Long> focusedIds = focused ? Set.of(todo.getId()) : Collections.emptySet();
        Map<Long, int[]> subtaskCounts = resolveSubtaskCounts(Set.of(todo.getId()));
        var tagsByTodo = resolveTags(Set.of(todo.getId()));
        Map<Long, int[]> checklistCounts = resolveChecklistCounts(Set.of(todo.getId()));
        return convertToDto(todo, recurringSourceIds, focusedIds, subtaskCounts, tagsByTodo, checklistCounts);
    }

    /** 리스트 응답용 — 각 todo의 서브태스크 카운트 [전체, 완료]를 groupBy 한 번에 집계 (N+1 방지). */
    private Map<Long, int[]> resolveSubtaskCounts(Collection<Long> todoIds) {
        if (todoIds == null || todoIds.isEmpty()) return Collections.emptyMap();
        Map<Long, int[]> counts = new HashMap<>();
        for (Object[] row : todoRepository.countSubtasksByParentIds(todoIds)) {
            counts.put((Long) row[0], new int[]{((Number) row[1]).intValue(), ((Number) row[2]).intValue()});
        }
        return counts;
    }

    /** 리스트 응답용 — 각 todo의 체크리스트 카운트 [전체, 체크됨]을 groupBy 한 번에 집계 (N+1 방지). */
    private Map<Long, int[]> resolveChecklistCounts(Collection<Long> todoIds) {
        if (todoIds == null || todoIds.isEmpty()) return Collections.emptyMap();
        Map<Long, int[]> counts = new HashMap<>();
        for (Object[] row : checklistRepository.countChecklistsByTodoIds(todoIds)) {
            counts.put((Long) row[0], new int[]{((Number) row[1]).intValue(), ((Number) row[2]).intValue()});
        }
        return counts;
    }

    /** 리스트 응답용 — 여러 할 일의 태그를 한 번에 fetch (N+1 방지). */
    private Map<Long, List<com.example.todo.dto.TagResponse>> resolveTags(Collection<Long> todoIds) {
        if (todoIds == null || todoIds.isEmpty()) return Collections.emptyMap();
        List<com.example.todo.entity.TodoTag> links = todoTagRepository.findByTodoIdIn(todoIds);
        if (links.isEmpty()) return Collections.emptyMap();
        Set<Long> tagIds = links.stream().map(com.example.todo.entity.TodoTag::getTagId).collect(Collectors.toSet());
        Map<Long, com.example.todo.dto.TagResponse> tagById = new HashMap<>();
        for (com.example.todo.entity.Tag t : tagRepository.findAllById(tagIds)) {
            tagById.put(t.getId(), com.example.todo.dto.TagResponse.from(t));
        }
        Map<Long, List<com.example.todo.dto.TagResponse>> out = new HashMap<>();
        for (com.example.todo.entity.TodoTag link : links) {
            com.example.todo.dto.TagResponse tr = tagById.get(link.getTagId());
            if (tr != null) out.computeIfAbsent(link.getTodoId(), k -> new java.util.ArrayList<>()).add(tr);
        }
        return out;
    }

    /** 리스트 응답용 — todos에 대해 호출자 기준 focusedIds를 한 번에 fetch. */
    private Set<Long> resolveFocusedIds(Long currentUserId, Collection<Long> todoIds) {
        if (todoIds == null || todoIds.isEmpty()) return Collections.emptySet();
        return new HashSet<>(todoFocusRepository.findTodoIdsByUserIdAndTodoIdIn(currentUserId, todoIds));
    }

    /**
     * 반복 일정 변경 전파: 이 todo에 적용된 field 변경을 형제 인스턴스에 전파한다.
     * scope: ALL | THIS_AND_FOLLOWING
     */
    @Transactional
    @PostMapping("/{id}/recurrence-propagate")
    public ResponseEntity<?> propagateRecurrenceChange(
            @PathVariable Long id,
            @RequestBody Map<String, String> body,
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId
    ) {
        String userEmail = authentication.getName();
        Workspace workspace = workspaceResolver.resolve(userEmail, workspaceId);

        String scope = body.get("scope"); // ALL | THIS_AND_FOLLOWING
        String field = body.get("field");
        String value = body.get("value");

        if (scope == null || field == null) {
            return ResponseEntity.badRequest().body("scope와 field는 필수입니다.");
        }

        Todo todo = todoRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("작업을 찾을 수 없습니다."));
        if (!isSameWorkspace(todo, workspace)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("다른 워크스페이스의 작업입니다.");
        }
        // 반복 전파 = 편집(역할 기반, MEMBER 이상, 샘플 차단). 각 sibling은 updateField에서 재차 검증.
        permissionService.requireCanEditTodo(userEmail, todo);

        final List<Todo> siblings;
        // 실제로 값이 바뀐 대상만 모아 두었다가 커밋 후 건별로 발행한다.
        final List<Long> propagatedIds = new ArrayList<>();

        if (todo.getRecurrenceSourceId() != null) {
            Long recId = todo.getRecurrenceSourceId();
            if ("THIS_AND_FOLLOWING".equals(scope)) {
                siblings = todoRepository.findByRecurrenceSourceIdAndDueDateGreaterThanEqual(
                        recId, todo.getDueDate() != null ? todo.getDueDate() : java.time.LocalDate.now()
                );
            } else { // ALL
                siblings = todoRepository.findByRecurrenceSourceId(recId);
                recurrenceRepository.findById(recId).ifPresent(rec -> {
                    todoService.updateField(rec.getSourceTodoId(), field, value, userEmail, workspaceId);
                    propagatedIds.add(rec.getSourceTodoId());
                });
            }
        } else {
            // 원본 todo인 경우: 생성된 인스턴스 전부
            siblings = recurrenceRepository.findBySourceTodoId(id)
                    .map(rec -> todoRepository.findByRecurrenceSourceId(rec.getId()))
                    .orElse(new ArrayList<>());
        }

        siblings.stream()
                .filter(s -> !s.getId().equals(id))
                .forEach(s -> {
                    todoService.updateField(s.getId(), field, value, userEmail, workspaceId);
                    propagatedIds.add(s.getId());
                });

        // 전파는 인스턴스 여러 건을 건드린다 — 수신 측이 id로 행을 찾으므로 건별로 발행한다.
        // (호출자 자신의 항목 id는 이 요청 직전의 PATCH가 이미 발행했다.)
        if (!propagatedIds.isEmpty()) {
            User actor = workspaceResolver.getUser(userEmail);
            for (Todo propagated : todoRepository.findAllById(propagatedIds)) {
                todoEventPublisher.updated(workspace.getId(), propagated.getId(),
                        fieldPatch(propagated, field), actor);
            }
        }

        return ResponseEntity.ok().build();
    }

    // ─── 실시간 브로드캐스트 헬퍼 ───────────────────────────────────

    /** 한 칸짜리 patch. Map.of는 null 값을 못 담는데, "비웠다"를 알리려면 null이 실려야 한다. */
    private static Map<String, Object> patchOf(String key, Object value) {
        Map<String, Object> patch = new HashMap<>();
        patch.put(key, value);
        return patch;
    }

    /**
     * TodoService.updateField의 field 하나 → 브로드캐스트할 patch.
     *
     * 키 이름은 반드시 TodoResponseDto와 같아야 한다. 수신 측(웹)이 이 키를 캐시된 행 객체에
     * 그대로 얹기 때문에, 이름이 틀리면 에러도 없이 아무 일도 일어나지 않는다.
     * 값은 저장된 엔티티에서 읽는다 — 요청 문자열과 저장값이 다를 수 있다(프로젝트 id → 참조 등).
     */
    private Map<String, Object> fieldPatch(Todo todo, String field) {
        Map<String, Object> patch = new HashMap<>();
        switch (field) {
            case "title" -> patch.put("title", todo.getTitle());
            case "content" -> patch.put("content", todo.getContent());
            case "priority" -> patch.put("priority", todo.getPriority());
            case "startAt" -> patch.put("startAt", todo.getStartAt());
            case "dueDate" -> patch.put("dueDate", todo.getDueDate());
            case "startTime" -> patch.put("startTime", todo.getStartTime());
            case "endTime" -> patch.put("endTime", todo.getEndTime());
            case "projectId" -> patch.put("projectId", todo.getProject() != null ? todo.getProject().getId() : null);
            case "parentId" -> patch.put("parentId", todo.getParentId());
            case "assignees" -> patch.put("assignees", todo.getAssignees() == null ? List.of()
                    : todo.getAssignees().stream()
                        .map(u -> new AssigneeDto(u.getEmail(), u.getName(), u.getProfileImageUrl()))
                        .collect(Collectors.toList()));
            // 완료 판정은 doneAt 우선(isTodoDone) — status만 보내면 행이 어중간하게 보인다.
            case "status" -> {
                patch.put("status", todo.getStatus());
                patch.put("doneAt", todo.getDoneAt());
            }
            // updateField가 이미 400으로 거른 값. 빈 patch는 publisher가 버린다.
            default -> { }
        }
        return patch;
    }

    private boolean isSameWorkspace(Todo todo, Workspace workspace) {
        return todo.getWorkspace() != null
                && workspace != null
                && Objects.equals(todo.getWorkspace().getId(), workspace.getId());
    }

    /** 할 일 삭제 시 딸린 코멘트·첨부(레코드+파일)를 정리 — 고아 데이터·디스크 누수 방지. */
    private void purgeTodoAssociations(Long todoId) {
        for (com.example.todo.entity.TodoAttachment a : todoAttachmentRepository.findByTodoIdOrderByCreatedAtAsc(todoId)) {
            if (a.getFileUrl() == null) continue;
            try {
                String fn = a.getFileUrl().substring(a.getFileUrl().lastIndexOf("/") + 1);
                java.nio.file.Files.deleteIfExists(
                        java.nio.file.Paths.get(uploadDir).toAbsolutePath().resolve("todo-attachments").resolve(fn));
            } catch (Exception ignored) {}
        }
        todoAttachmentRepository.deleteByTodoId(todoId);
        commentRepository.deleteByTodoId(todoId);
    }

    private ResponseEntity<?> assertNotSample(Todo todo) {
        if (Boolean.TRUE.equals(todo.getIsSample())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "샘플 데이터는 수정하거나 삭제할 수 없습니다."));
        }
        return null;
    }
}