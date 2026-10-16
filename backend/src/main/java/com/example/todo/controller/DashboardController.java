package com.example.todo.controller;

import com.example.todo.dto.DashboardStatsDto;
import com.example.todo.dto.DashboardTaskDto;
import com.example.todo.dto.PeriodTaskDto;
import com.example.todo.dto.RecentActivityDto;
import com.example.todo.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping("/stats")
    public ResponseEntity<DashboardStatsDto> getStats(
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId
    ) {
        String userEmail = authentication.getName();
        return ResponseEntity.ok(dashboardService.getStats(userEmail, workspaceId));
    }

    @GetMapping("/recent-tasks")
    public ResponseEntity<List<DashboardTaskDto>> getRecentTasks(
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId
    ) {
        String userEmail = authentication.getName();
        return ResponseEntity.ok(dashboardService.getRecentTasks(userEmail, workspaceId));
    }

    @GetMapping("/today-todos")
    public List<DashboardTaskDto> getTodayTodos(
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId
    ) {
        String userEmail = authentication.getName();
        return dashboardService.getTodayTodos(userEmail, workspaceId);
    }

    @GetMapping("/high-priority")
    public List<DashboardTaskDto> getHighPriority(
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId
    ) {
        String userEmail = authentication.getName();
        return dashboardService.getHighPriorityTodos(userEmail, workspaceId);
    }

    @GetMapping("/in-progress")
    public List<DashboardTaskDto> getInProgressTasks(
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId
    ) {
        String userEmail = authentication.getName();
        return dashboardService.getInProgressTasks(userEmail, workspaceId);
    }

    @GetMapping("/overdue")
    public List<DashboardTaskDto> getOverdueTasks(
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId
    ) {
        String userEmail = authentication.getName();
        return dashboardService.getOverdueTasks(userEmail, workspaceId);
    }

    /**
     * 기간 + dueDate 기반 통계 데이터. archived 무관하게 응답.
     * weekly completion rate, weekly bar, member stats 계산용.
     */
    @GetMapping("/period-tasks")
    public ResponseEntity<List<PeriodTaskDto>> getPeriodTasks(
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        if (from != null && to != null && java.time.temporal.ChronoUnit.DAYS.between(from, to) > 365) {
            throw new com.example.todo.exception.ApiException(400, "조회 기간은 최대 365일까지 가능합니다.");
        }
        String userEmail = authentication.getName();
        return ResponseEntity.ok(dashboardService.getPeriodTasks(userEmail, workspaceId, from, to));
    }

    @GetMapping("/recent-activity")
    public ResponseEntity<List<RecentActivityDto>> getRecentActivity(
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId
    ) {
        String userEmail = authentication.getName();
        return ResponseEntity.ok(dashboardService.getRecentActivity(userEmail, workspaceId));
    }
}