package com.example.todo.service;

import com.example.todo.dto.DashboardStatsDto;
import com.example.todo.dto.DashboardTaskDto;
import com.example.todo.dto.PeriodTaskDto;
import com.example.todo.dto.RecentActivityDto;
import com.example.todo.entity.Priority;
import com.example.todo.entity.Todo;
import com.example.todo.entity.TodoLog;
import com.example.todo.entity.Workspace;
import com.example.todo.entity.User;
import com.example.todo.repository.LogRepository;
import com.example.todo.repository.TodoRepository;
import com.example.todo.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final TodoRepository todoRepository;
    private final LogRepository logRepository;
    private final UserRepository userRepository;
    private final WorkspaceResolver workspaceResolver;

    public List<DashboardTaskDto> getRecentTasks(String userEmail, Long workspaceId) {
        Workspace workspace = workspaceResolver.resolve(userEmail, workspaceId);

        return todoRepository.findTop5ByWorkspaceAndArchivedFalseOrderByIdDesc(workspace).stream()
                .map(this::toDashboardDto)
                .toList();
    }

    public List<DashboardTaskDto> getTodayTodos(String userEmail, Long workspaceId) {
        Workspace workspace = workspaceResolver.resolve(userEmail, workspaceId);
        LocalDate today = LocalDate.now();

        return todoRepository.findTodosForDate(workspace, today).stream()
                .map(this::toDashboardDto)
                .toList();
    }

    public List<DashboardTaskDto> getHighPriorityTodos(String userEmail, Long workspaceId) {
        Workspace workspace = workspaceResolver.resolve(userEmail, workspaceId);

        return todoRepository.findByWorkspaceAndArchivedFalseAndPriorityOrderByIdDesc(workspace, Priority.HIGH).stream()
                .map(this::toDashboardDto)
                .toList();
    }

    public List<DashboardTaskDto> getInProgressTasks(String userEmail, Long workspaceId) {
        Workspace workspace = workspaceResolver.resolve(userEmail, workspaceId);

        return todoRepository.findByWorkspaceAndArchivedFalseAndStatusOrderByIdDesc(workspace, "IN_PROGRESS").stream()
                .map(this::toDashboardDto)
                .toList();
    }

    public List<DashboardTaskDto> getOverdueTasks(String userEmail, Long workspaceId) {
        Workspace workspace = workspaceResolver.resolve(userEmail, workspaceId);
        LocalDate today = LocalDate.now();

        return todoRepository.findOverdueTodosByWorkspace(workspace, today).stream()
                .map(this::toDashboardDto)
                .toList();
    }

    /**
     * 기간 + dueDate 기반 통계 데이터. archived 무관하게 응답한다.
     * 프론트의 weeklyCompletionRate / weeklyDelta / weeklyBarData / memberStats 가 사용.
     */
    public List<PeriodTaskDto> getPeriodTasks(String userEmail, Long workspaceId, LocalDate from, LocalDate to) {
        Workspace workspace = workspaceResolver.resolve(userEmail, workspaceId);
        return todoRepository.findByWorkspaceAndDueDateBetweenIgnoreArchived(workspace, from, to).stream()
                .map(PeriodTaskDto::from)
                .toList();
    }

    public DashboardStatsDto getStats(String userEmail, Long workspaceId) {
        Workspace workspace = workspaceResolver.resolve(userEmail, workspaceId);
        LocalDate today = LocalDate.now();

        // 상태별 카운트
        Map<String, Long> statusCounts = new LinkedHashMap<>();
        for (String s : java.util.List.of("TODO","IN_PROGRESS","DONE")) statusCounts.put(s, 0L);
        todoRepository.countByStatusGrouped(workspace)
                .forEach(row -> statusCounts.put((String) row[0], (Long) row[1]));

        // 우선순위별 카운트
        Map<String, Long> priorityCounts = new LinkedHashMap<>();
        for (Priority p : Priority.values()) priorityCounts.put(p.name(), 0L);
        todoRepository.countByPriorityGrouped(workspace)
                .forEach(row -> priorityCounts.put(((Priority) row[0]).name(), (Long) row[1]));

        // 이번 주 월~일 마감일별 카운트
        LocalDate mon = today.with(DayOfWeek.MONDAY);
        LocalDate sun = today.with(DayOfWeek.SUNDAY);
        Map<String, Long> weeklyDueCounts = new LinkedHashMap<>();
        for (int i = 0; i < 7; i++) weeklyDueCounts.put(mon.plusDays(i).toString(), 0L);
        todoRepository.countByDueDateBetween(workspace, mon, sun)
                .forEach(row -> weeklyDueCounts.put(row[0].toString(), (Long) row[1]));

        return DashboardStatsDto.builder()
                .statusCounts(statusCounts)
                .priorityCounts(priorityCounts)
                .weeklyDueCounts(weeklyDueCounts)
                .build();
    }

    public List<RecentActivityDto> getRecentActivity(String userEmail, Long workspaceId) {
        Workspace workspace = workspaceResolver.resolve(userEmail, workspaceId);

        List<TodoLog> logs = logRepository.findRecentByWorkspace(workspace, PageRequest.of(0, 10));
        if (logs.isEmpty()) return List.of();

        // todo 제목 조회
        Set<Long> todoIds = logs.stream().map(TodoLog::getTodoId).collect(Collectors.toSet());
        Map<Long, String> titleMap = todoRepository.findAllById(todoIds).stream()
                .collect(Collectors.toMap(Todo::getId, Todo::getTitle));

        // modifier 이름 조회 (이메일인 경우만 DB 조회, 구 데이터는 이름 그대로 사용)
        Set<String> emails = logs.stream()
                .map(TodoLog::getModifier)
                .filter(m -> m != null && m.contains("@"))
                .collect(Collectors.toSet());
        Map<String, String> emailToName = userRepository.findByEmailIn(new ArrayList<>(emails)).stream()
                .collect(Collectors.toMap(
                        User::getEmail,
                        u -> u.getName() != null ? u.getName() : u.getEmail().split("@")[0]
                ));

        return logs.stream()
                .map(log -> {
                    String modifier = log.getModifier();
                    String modifierName = (modifier != null && modifier.contains("@"))
                            ? emailToName.getOrDefault(modifier, modifier.split("@")[0])
                            : (modifier != null ? modifier : "알 수 없음");
                    return RecentActivityDto.builder()
                            .todoId(log.getTodoId())
                            .todoTitle(titleMap.getOrDefault(log.getTodoId(), "(삭제된 태스크)"))
                            .modifier(modifier)
                            .modifierName(modifierName)
                            .field(log.getField())
                            .afterValue(log.getAfterValue())
                            .modifiedAt(log.getModifiedAt())
                            .build();
                })
                .toList();
    }

    private DashboardTaskDto toDashboardDto(Todo todo) {
        return DashboardTaskDto.builder()
                .id(todo.getId())
                .title(todo.getTitle())
                .status(todo.getStatus())
                .priority(todo.getPriority() != null ? todo.getPriority().name() : null)
                .dueDate(todo.getDueDate())
                .build();
    }
}