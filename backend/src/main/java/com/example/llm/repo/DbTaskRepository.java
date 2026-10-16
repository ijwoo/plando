package com.example.llm.repo;

import com.example.llm.domain.Task;
import com.example.llm.util.WorkspaceHolder;
import com.example.todo.dto.AssigneeDto;
import com.example.todo.dto.TodoResponseDto;
import com.example.todo.entity.Priority;
import com.example.todo.entity.Todo;
import com.example.todo.entity.User;
import com.example.todo.exception.ApiException;
import com.example.todo.entity.Workspace;
import com.example.todo.entity.WorkspaceMember;
import com.example.todo.entity.WorkspaceRole;
import com.example.todo.repository.LocationTriggerRepository;
import com.example.todo.repository.TodoRepository;
import com.example.todo.repository.UserRepository;
import com.example.todo.repository.WorkspaceMemberRepository;
import com.example.todo.repository.WorkspaceRepository;
import com.example.todo.service.KakaoGeocodingService;
import com.example.todo.service.TodoEventPublisher;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Repository
@RequiredArgsConstructor
@Transactional
public class DbTaskRepository implements TaskRepository {

    private final TodoRepository todoRepository;
    private final UserRepository userRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final WorkspaceRepository workspaceRepository;
    private final KakaoGeocodingService geocodingService;
    private final LocationTriggerRepository locationTriggerRepository;
    private final TodoEventPublisher todoEventPublisher;
    private final com.example.todo.service.LogService logService;

    @Override
    public Task create(Task task) {
        User me = getCurrentUserOrThrow();
        Workspace workspace = resolveWorkspace(me);

        Todo todo = new Todo();
        todo.setCreatedBy(me);
        todo.setWorkspace(workspace);
        applyTaskToTodo(task, todo, workspace);

        if (task.locationName != null && !task.locationName.isBlank()) {
            KakaoGeocodingService.GeoResult geo = geocodingService.geocode(task.locationName);
            if (geo != null) {
                todo.setLocationLat(geo.lat());
                todo.setLocationLng(geo.lng());
                todo.setLocationAddress(geo.address());
                todo.setLocationName(geo.placeName());
            }
        }

        Todo saved = todoRepository.save(todo);
        // 생성도 이력에 남긴다 — TodoController 의 직접 생성과 같은 규약(field="created")
        logService.saveLog(saved.getId(), "created", "", saved.getTitle(), me.getEmail());
        // 챗봇으로 만든 것도 사람이 만든 것과 똑같이 남의 보드에 나타나야 한다.
        todoEventPublisher.added(workspace.getId(), toResponseDto(saved), me);
        return toTask(saved);
    }

    @Override
    public Optional<Task> findById(String taskId) {
        Long id = parseId(taskId);
        if (id == null) return Optional.empty();

        User me = getCurrentUserOrThrow();
        Workspace workspace = resolveWorkspace(me);

        return todoRepository.findById(id)
                .filter(t -> t.getWorkspace() != null
                        && Objects.equals(t.getWorkspace().getId(), workspace.getId()))
                .map(this::toTask);
    }

    @Override
    public List<Task> search(String userEmail, String projectId,
                             String keyword, String status, String priority,
                             String assigneeId, LocalDate dueDate, int limit) {
        User user = resolveUser(userEmail);
        Workspace workspace = resolveWorkspace(user);

        List<Todo> found = fetchTodos(workspace, keyword, priority, dueDate,
                upper(status), normalizeAssignee(assigneeId));
        return applyFilters(found, status, priority, assigneeId, limit);
    }

    @Override
    public List<Task> searchRange(String userEmail, LocalDate from, LocalDate to,
                                  String status, String priority, String assigneeId, int limit) {
        User user = resolveUser(userEmail);
        Workspace workspace = resolveWorkspace(user);

        // 거꾸로 들어와도 빈 결과 대신 사용자가 뜻한 기간으로 읽는다
        LocalDate start = from.isAfter(to) ? to : from;
        LocalDate end   = from.isAfter(to) ? from : to;

        List<Todo> found = todoRepository
                .findByWorkspaceAndArchivedFalseAndDueDateBetweenOrderByDueDateAsc(workspace, start, end);
        return applyFilters(found, status, priority, assigneeId, limit);
    }

    /** 조회 결과에 공통으로 거는 조건. 단일 날짜든 기간이든 같은 규칙이어야 한다. */
    private List<Task> applyFilters(List<Todo> found, String status, String priority,
                                    String assigneeId, int limit) {
        String normStatus    = upper(status);
        String normPriority  = upper(priority);
        String normAssignee  = normalizeAssignee(assigneeId);

        return found.stream()
                .filter(t -> normStatus == null || (t.getStatus() != null
                        && normStatus.equalsIgnoreCase(t.getStatus())))
                .filter(t -> normPriority == null || (t.getPriority() != null
                        && normPriority.equalsIgnoreCase(t.getPriority().name())))
                .filter(t -> {
                    if (normAssignee == null) return true;
                    if (t.getAssignees() == null || t.getAssignees().isEmpty()) return false;
                    return t.getAssignees().stream()
                            .map(User::getEmail).filter(Objects::nonNull)
                            .anyMatch(e -> e.equalsIgnoreCase(normAssignee));
                })
                .limit(limit)
                .map(this::toTask)
                .toList();
    }

    @Override
    public List<Task> searchOverdue(String userEmail, int limit) {
        User user = resolveUser(userEmail);
        Workspace workspace = resolveWorkspace(user);

        return todoRepository.findOverdueTodosByWorkspace(workspace, LocalDate.now())
                .stream()
                .limit(limit)
                .map(this::toTask)
                .toList();
    }

    @Override
    public Task update(Task task) {
        Long id = parseId(task.id);
        if (id == null) throw new com.example.todo.exception.ApiException(400, "할 일 ID가 필요합니다.");

        User me = getCurrentUserOrThrow();
        Workspace workspace = resolveWorkspace(me);

        Todo todo = todoRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("할 일을 찾을 수 없습니다: " + task.id));

        if (todo.getWorkspace() == null
                || !Objects.equals(todo.getWorkspace().getId(), workspace.getId())) {
            throw new com.example.todo.exception.ApiException(403, "현재 워크스페이스의 할 일이 아닙니다.");
        }

        if (todo.getCreatedBy() == null
                || !Objects.equals(todo.getCreatedBy().getId(), me.getId())) {
            throw new com.example.todo.exception.ApiException(403, "본인의 할 일이 아닙니다.");
        }

        if (Boolean.TRUE.equals(todo.getIsSample())) {
            throw new com.example.todo.exception.ApiException(403, "샘플 할 일은 챗봇으로 수정할 수 없어요.");
        }

        /* 바꾸기 **전** 값을 찍어둔다.
           [고치는 결함] AI 수정은 여기서 todoRepository.save() 를 직접 불러서 이력을 남기는
           TodoService 를 거치지 않았다. 그래서 AI 로 다섯 건을 바꿔도 활동 탭에는 아무것도
           안 남았고, "이거 누가 바꿨지" 를 볼 수 없었다. 되돌릴 근거도 사라진다. */
        Map<String, String> before = snapshotForLog(todo);

        applyTaskToTodo(task, todo, workspace);
        Todo saved = todoRepository.save(todo);
        writeChangeLogs(saved, before, me.getEmail());
        todoEventPublisher.updated(workspace.getId(), saved.getId(), mutatedPatch(task, saved), me);
        return toTask(saved);
    }

    @Override
    public boolean deleteById(String taskId, String userEmail) {
        Long id = parseId(taskId);
        if (id == null) return false;

        User me = resolveUser(userEmail);
        Workspace workspace = resolveWorkspace(me);

        Todo todo = todoRepository.findById(id).orElse(null);
        if (todo == null) return false;

        if (todo.getWorkspace() == null
                || !Objects.equals(todo.getWorkspace().getId(), workspace.getId())) return false;

        if (todo.getCreatedBy() == null
                || !Objects.equals(todo.getCreatedBy().getId(), me.getId())) return false;

        if (Boolean.TRUE.equals(todo.getIsSample())) return false;

        // 일정에 걸려있던 위치 트리거 같이 정리 (안 그러면 삭제된 일정 알림이 계속 옴)
        locationTriggerRepository.deleteAllByTodoId(id);

        todoRepository.delete(todo);
        todoEventPublisher.deleted(workspace.getId(), id, me);
        return true;
    }

    // ── 내부 헬퍼 ────────────────────────────────────────────────────────────

    /**
     * 브로드캐스트(ADDED)용 DTO. 챗봇 경로에는 컨트롤러의 변환기(태그·서브태스크·체크리스트를
     * 배치 조회해 채우는)가 없으므로, 이 시점에 확실히 아는 필드만 담는다. 나머지는 기본값이고
     * 받는 쪽이 다음 조회에서 메운다. focused는 per-user라 항상 false로 둔다.
     */
    private TodoResponseDto toResponseDto(Todo todo) {
        List<AssigneeDto> assignees = (todo.getAssignees() == null) ? List.of()
                : todo.getAssignees().stream()
                    .map(u -> new AssigneeDto(u.getEmail(), u.getName(), u.getProfileImageUrl()))
                    .collect(Collectors.toList());
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
                .parentId(todo.getParentId())
                .focused(false)
                .build();
    }

    /**
     * 챗봇 수정(UPDATED)의 patch. applyTaskToTodo가 "값이 들어온 필드만" 덮어쓰므로,
     * 그 조건을 그대로 따라가며 실제로 바뀐 것만 담는다. 키는 TodoResponseDto와 같은 이름이어야
     * 수신 측이 캐시된 행에 얹을 수 있다.
     */
    private Map<String, Object> mutatedPatch(Task task, Todo saved) {
        Map<String, Object> patch = new HashMap<>();
        if (task == null) return patch;

        if (task.title != null) patch.put("title", saved.getTitle());
        if (task.description != null) patch.put("content", saved.getContent());
        if (task.status != null && !task.status.isBlank()) {
            patch.put("status", saved.getStatus());
            patch.put("doneAt", saved.getDoneAt()); // 완료 판정은 doneAt 우선(isTodoDone)
        }
        if (task.priority != null && !task.priority.isBlank()) patch.put("priority", saved.getPriority());
        if (task.clearDueDate || task.dueDate != null) patch.put("dueDate", saved.getDueDate());
        if (task.clearStartAt || task.startAt != null) patch.put("startAt", saved.getStartAt());
        if (task.startTime != null) patch.put("startTime", saved.getStartTime());
        if (task.endTime != null) patch.put("endTime", saved.getEndTime());
        // 수정 경로는 지오코딩을 하지 않는다 — 좌표는 그대로고 이름만 바뀐다.
        if (task.locationName != null && !task.locationName.isBlank()) {
            patch.put("locationName", saved.getLocationName());
        }
        if (task.assigneeId != null && !task.assigneeId.isBlank()) {
            patch.put("assignees", saved.getAssignees() == null ? List.of()
                    : saved.getAssignees().stream()
                        .map(u -> new AssigneeDto(u.getEmail(), u.getName(), u.getProfileImageUrl()))
                        .collect(Collectors.toList()));
        }
        return patch;
    }

    private List<Todo> fetchTodos(Workspace workspace, String keyword,
                                  String priority, LocalDate dueDate,
                                  String status, String assigneeEmail) {
        boolean hasKeyword  = keyword  != null && !keyword.isBlank();
        boolean hasDue      = dueDate  != null;
        boolean hasPriority = priority != null && !priority.isBlank();

        /* 담당자·상태만으로 찾을 때는 DB 에서 걸러야 한다.
           [고치는 결함] 좁힐 조건이 없으면 맨 아래 "최근 5건" 으로 떨어졌고, 담당자 필터는
           그 5건에 대해서만 돌았다. 할 일이 수백 개인 워크스페이스에서 "내 담당 할일만
           조회" 가 늘 0건이었다 — 담당자 뱃지가 화면에 붙어 있는데도. */
        if (!hasKeyword && !hasDue && !hasPriority) {
            if (assigneeEmail != null && assigneeEmail.contains("@")) {
                return todoRepository.findByWorkspaceAndAssigneeEmail(workspace, assigneeEmail);
            }
            if (status != null && !status.isBlank()) {
                return todoRepository.findByWorkspaceAndArchivedFalseAndStatusOrderByIdDesc(workspace, status);
            }
        }

        // priority 단독 조회
        if (hasPriority && !hasKeyword && !hasDue) {
            Priority p = safePriority(priority);
            if (p != null) return todoRepository.findByWorkspaceAndArchivedFalseAndPriorityOrderByIdDesc(workspace, p);
        }

        if (hasKeyword && hasDue) {
            List<Todo> found = todoRepository.searchByWorkspaceAndKeywordAndDueDate(workspace, keyword, dueDate);
            if (!found.isEmpty()) return found;
            return todoRepository.searchByWorkspaceAndKeyword(workspace, keyword);
        }
        if (hasKeyword) {
            return todoRepository.searchByWorkspaceAndKeyword(workspace, keyword);
        }
        if (hasDue) {
            return todoRepository.findTodosForDate(workspace, dueDate);
        }

        return todoRepository.findTop5ByWorkspaceAndArchivedFalseOrderByIdDesc(workspace);
    }

    /**
     * 이력 비교용 스냅샷. 활동 탭이 쓰는 필드명을 **그대로** 쓴다 —
     * 이름이 어긋나면 같은 변경이 AI 것만 다르게 그려진다.
     */
    private Map<String, String> snapshotForLog(Todo t) {
        Map<String, String> m = new LinkedHashMap<>();
        m.put("title",    nz(t.getTitle()));
        m.put("content",  nz(t.getContent()));
        m.put("status",   nz(t.getStatus()));
        m.put("priority", t.getPriority() == null ? "" : t.getPriority().name());
        m.put("dueDate",  t.getDueDate()   == null ? "" : t.getDueDate().toString());
        m.put("startAt",  t.getStartAt()   == null ? "" : t.getStartAt().toString());
        return m;
    }

    /** 바뀐 필드만 이력으로. LogService 가 같은 값이면 스스로 걸러내지만 여기서도 줄여 둔다. */
    private void writeChangeLogs(Todo saved, Map<String, String> before, String modifierEmail) {
        Map<String, String> after = snapshotForLog(saved);
        for (Map.Entry<String, String> e : after.entrySet()) {
            String was = before.getOrDefault(e.getKey(), "");
            if (!was.equals(e.getValue())) {
                logService.saveLog(saved.getId(), e.getKey(), was, e.getValue(), modifierEmail);
            }
        }
    }

    private String nz(String v) { return v == null ? "" : v; }

    private void applyTaskToTodo(Task task, Todo todo, Workspace workspace) {
        if (task == null) return;

        if (task.title       != null) todo.setTitle(task.title);
        if (task.description != null) todo.setContent(task.description);

        if (task.status != null && !task.status.isBlank()) {
            String s = safeTodoStatus(task.status);
            if (s != null) todo.applyStatus(s, "DONE".equals(s));
        } else if (todo.getStatus() == null) {
            todo.setStatus("TODO");
        }

        if (task.priority != null && !task.priority.isBlank()) {
            Priority p = safePriority(task.priority);
            if (p != null) todo.setPriority(p);
        } else if (todo.getPriority() == null) {
            todo.setPriority(Priority.MEDIUM);
        }

        // 마감일
        if (task.clearDueDate) {
            todo.setDueDate(null);
        } else if (task.dueDate != null) {
            todo.setDueDate(task.dueDate);
        }

        // 시작일
        if (task.clearStartAt) {
            todo.setStartAt(null);
        } else if (task.startAt != null) {
            todo.setStartAt(task.startAt);
        }

        // 시간 (null이면 종일 일정 유지)
        if (task.startTime != null) todo.setStartTime(task.startTime);
        if (task.endTime != null) todo.setEndTime(task.endTime);

        if (task.locationName != null && !task.locationName.isBlank()) {
            todo.setLocationName(task.locationName);
        }

        if (todo.getWorkspace() == null) todo.setWorkspace(workspace);
        if (todo.getCreatedBy() == null) todo.setCreatedBy(getCurrentUserOrThrow());

        if (task.assigneeId != null && !task.assigneeId.isBlank()) {
            List<String> emails = Arrays.stream(task.assigneeId.split(","))
                    .map(String::trim).filter(s -> !s.isBlank()).distinct().toList();

            if (!emails.isEmpty()) {
                Set<Long> wsUserIds = workspaceMemberRepository.findByWorkspace(workspace)
                        .stream().map(m -> m.getUser().getId()).collect(Collectors.toSet());

                todo.setAssignees(userRepository.findByEmailIn(emails).stream()
                        .filter(u -> wsUserIds.contains(u.getId()))
                        .collect(Collectors.toList()));
            }
        }
    }

    /**
     * AI 가 다룰 워크스페이스를 정한다.
     *
     * **여기서 멤버십을 한 번 더 확인하는 이유(방어 심화):**
     * 예전에는 WorkspaceHolder 의 id 로 findById 만 하고 끝냈다. 지금은 그 값을 넣는 곳이
     * 두 군데뿐이고 둘 다 안전하다 — ChatController 는 WorkspaceResolver 로 멤버십을 검증한
     * 워크스페이스를 넣고, 데모는 자기 워크스페이스를 넣는다. 그래서 당장 뚫리지는 않았다.
     *
     * 문제는 **검증이 호출부에만 있었다**는 점이다. 나중에 누군가 헤더 값을 그대로
     * WorkspaceHolder 에 넣는 순간 남의 워크스페이스 할 일을 읽고 고치는 구멍이 된다.
     * 데이터에 닿는 이 계층에서도 막아 두면 그 실수가 사고로 이어지지 않는다.
     */
    private Workspace resolveWorkspace(User user) {
        Long workspaceId = WorkspaceHolder.get();
        if (workspaceId != null) {
            Workspace workspace = workspaceRepository.findById(workspaceId)
                    .orElseThrow(() -> new IllegalArgumentException("워크스페이스를 찾을 수 없습니다: " + workspaceId));
            if (user != null && !workspaceMemberRepository.existsByWorkspaceAndUser(workspace, user)) {
                throw new ApiException(403, "해당 워크스페이스에 접근 권한이 없습니다.");
            }
            return workspace;
        }
        return getDefaultWorkspaceOrThrow(user);
    }

    private Workspace getDefaultWorkspaceOrThrow(User user) {
        return workspaceMemberRepository
                .findFirstByUserAndRoleOrderByIdAsc(user, WorkspaceRole.OWNER)
                .map(WorkspaceMember::getWorkspace)
                .or(() -> workspaceMemberRepository.findFirstByUserOrderByIdAsc(user)
                        .map(WorkspaceMember::getWorkspace))
                .orElseThrow(() -> new IllegalArgumentException("소속 워크스페이스가 없습니다."));
    }

    private Task toTask(Todo todo) {

        Task t = new Task();
        t.id          = "T-" + todo.getId();
        t.title       = todo.getTitle();
        t.description = todo.getContent();
        t.status      = todo.getStatus();
        t.priority    = todo.getPriority() != null ? todo.getPriority().name() : null;
        t.startAt     = todo.getStartAt();
        t.dueDate     = todo.getDueDate();
        t.startTime   = todo.getStartTime();
        t.endTime     = todo.getEndTime();
        t.userEmail   = todo.getCreatedBy() != null ? todo.getCreatedBy().getEmail() : null;

        if (todo.getAssignees() != null && !todo.getAssignees().isEmpty()) {
            t.assigneeId = todo.getAssignees().stream()
                    .map(User::getEmail).filter(Objects::nonNull)
                    .collect(Collectors.joining(","));
        }
        t.locationName = todo.getLocationName();
        t.isSample = Boolean.TRUE.equals(todo.getIsSample());
        return t;
    }

    private String safeTodoStatus(String s) {
        String u = s.trim().toUpperCase(); return (u.equals("TODO") || u.equals("IN_PROGRESS") || u.equals("DONE")) ? u : null;
    }

    private Priority safePriority(String s) {
        try { return Priority.valueOf(s.trim().toUpperCase()); } catch (Exception e) { return null; }
    }

    private Long parseId(String taskId) {
        if (taskId == null) return null;
        String s = taskId.trim();
        if (s.startsWith("T-")) s = s.substring(2);
        try { return Long.parseLong(s); } catch (Exception e) { return null; }
    }

    private String currentUserEmail() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) return null;
        if ("anonymousUser".equals(auth.getName())) return null;
        return auth.getName();
    }

    private User getCurrentUserOrThrow() {
        String email = currentUserEmail();
        if (email == null || email.isBlank()) throw new com.example.todo.exception.ApiException(401, "로그인 사용자 정보를 찾을 수 없습니다.");
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
    }

    private User resolveUser(String userEmail) {
        String email = (userEmail != null && !userEmail.isBlank()) ? userEmail : currentUserEmail();
        if (email == null || email.isBlank()) throw new com.example.todo.exception.ApiException(401, "사용자 이메일이 없습니다.");
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
    }

    private static String upper(String s) {
        return (s == null || s.isBlank()) ? null : s.trim().toUpperCase();
    }

    private static String normalizeAssignee(String s) {
        if (s == null || s.isBlank()) return null;
        String v = s.trim();
        return v.matches("\\d+") ? null : v;   // 순수 숫자는 이메일이 아님 → 무시
    }
}
