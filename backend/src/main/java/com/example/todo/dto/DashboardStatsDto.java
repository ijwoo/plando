package com.example.todo.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

import java.util.Map;

@Getter
@Builder
@AllArgsConstructor
public class DashboardStatsDto {
    private Map<String, Long> statusCounts;    // {"TODO": 5, "IN_PROGRESS": 3, "DONE": 40}
    private Map<String, Long> priorityCounts;  // {"HIGH": 10, "MEDIUM": 20, "LOW": 15}
    private Map<String, Long> weeklyDueCounts; // {"2026-03-16": 2, "2026-03-17": 0, ...}
}
