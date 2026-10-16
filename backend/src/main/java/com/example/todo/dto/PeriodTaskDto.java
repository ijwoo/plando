package com.example.todo.dto;

import com.example.todo.entity.Todo;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 대시보드의 "기간 기반 / 완료 통계" 전용 가벼운 DTO.
 * 활성 워크로드 통계와 달리 archived 무관하게 응답되므로 별도 타입으로 분리.
 *
 * weekly completion rate / weekly bar / member stats 계산에 필요한 최소 필드만 포함.
 */
@Getter
@Setter
@AllArgsConstructor
@Builder
public class PeriodTaskDto {
    private Long id;
    private String title;
    private String status;
    /** Priority enum 이름 (HIGH/MEDIUM/LOW). null 가능. 모바일 WeeklyTasksCard의 PriorityPill 노출용. */
    private String priority;
    private LocalDate dueDate;
    /**
     * 완료 시각. 이게 빠져 있어서 클라이언트가 status == "DONE" 문자열 비교로 폴백했고,
     * **커스텀 완료 상태를 쓰는 워크스페이스에서 완료 항목이 미완료로 집계**됐다.
     * 더 나빴던 건 주간 할 일 카드의 체크박스가 풀린 채로 보이고, 누르면 이미 완료인 걸
     * 다시 완료로 PATCH 했다는 점이다(해제할 방법이 없었다).
     * 완료 판정의 단일 출처는 doneAt 이다 — 서버가 완료 카테고리로 바뀔 때 스탬프한다.
     */
    private java.time.LocalDateTime doneAt;
    /** assignee 이메일 리스트 (프론트 memberStats 계산용) */
    private List<String> assignees;

    public static PeriodTaskDto from(Todo todo) {
        return PeriodTaskDto.builder()
                .id(todo.getId())
                .title(todo.getTitle())
                .status(todo.getStatus())
                .priority(todo.getPriority() != null ? todo.getPriority().name() : null)
                .dueDate(todo.getDueDate())
                .doneAt(todo.getDoneAt())
                .assignees(todo.getAssignees() == null ? List.of() :
                        todo.getAssignees().stream()
                                .map(u -> u.getEmail())
                                .filter(e -> e != null && !e.isBlank())
                                .collect(Collectors.toList()))
                .build();
    }
}
