package com.example.todo.dto;

import com.example.todo.entity.Priority;
import com.example.todo.entity.Todo;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TodoResponseDto {
    private Long id;
    private String title;
    private String content;
    private String status;
    private Priority priority;
    private LocalDate startAt;
    private LocalDate dueDate;
    private java.time.LocalTime startTime;
    private java.time.LocalTime endTime;
    /** 소속 프로젝트 — null = 인박스 */
    private Long projectId;
    private List<AssigneeDto> assignees;
    private String userEmail;
    private String userName;

    // 지도 위치 정보
    private Double locationLat;
    private Double locationLng;
    private String locationAddress;
    private String locationName;
    private Boolean archived;
    private Boolean isSample;
    private LocalDateTime createdAt;
    /** 완료 시각 — null이 아니면 완료(카테고리 DONE). 커스텀 상태 완료 판정용. */
    private LocalDateTime doneAt;

    // 반복 일정 정보
    private Boolean hasRecurrence;      // 이 Todo가 반복 원본인지 (recurrence config 보유)
    private Long recurrenceSourceId;    // 스케줄러가 생성한 인스턴스의 경우 TodoRecurrence.id

    // 서브태스크 정보
    private Long parentId;              // 부모 할 일 ID (null = 최상위)
    private int subtaskTotal;           // 자식(서브태스크) 전체 수
    private int subtaskDone;            // 자식 중 status=DONE 수

    // 체크리스트 정보 — 목록 배지(N/M)용. 항목 본문은 상세 조회에서만 내려감.
    private int checklistTotal;         // 체크리스트 항목 전체 수
    private int checklistDone;          // 체크리스트 항목 중 checked=true 수

    /**
     * 포커스(⚡). per-user. TodoController가 호출자(현재 사용자)의 TodoFocus 존재 여부로 채운다.
     * Todo.focused legacy boolean 컬럼은 더 이상 응답에 사용되지 않는다.
     */
    private Boolean focused;

    /** 태그(라벨) — 워크스페이스 태그 중 이 할 일에 부착된 것. 배치 조회로 채움. */
    @Builder.Default
    private List<TagResponse> tags = List.of();

    /**
     * @deprecated builder를 사용하는 convertToDto 경로만 호출자 기준 focused를 채울 수 있다.
     *             이 생성자는 미사용 상태이며, 사용할 경우 focused는 항상 false가 된다.
     */
    @Deprecated
    public TodoResponseDto(Todo todo) {
        this.id = todo.getId();
        this.title = todo.getTitle();
        this.content = todo.getContent();
        this.status = todo.getStatus();
        this.priority = todo.getPriority();
        this.startAt = todo.getStartAt();
        this.dueDate = todo.getDueDate();
        this.startTime = todo.getStartTime();
        this.endTime = todo.getEndTime();
        this.assignees = todo.getAssignees().stream()
                .map(user -> new AssigneeDto(user.getEmail(), user.getName(), user.getProfileImageUrl()))
                .collect(Collectors.toList());
        this.userEmail = todo.getCreatedBy() != null ? todo.getCreatedBy().getEmail() : null;
        this.userName = todo.getCreatedBy() != null ? todo.getCreatedBy().getName() : null;
        this.locationLat = todo.getLocationLat();
        this.locationLng = todo.getLocationLng();
        this.locationAddress = todo.getLocationAddress();
        this.locationName = todo.getLocationName();
        this.archived = todo.getArchived();
        this.isSample = todo.getIsSample();
        this.createdAt = todo.getCreatedAt();
        this.focused = false;
        this.parentId = todo.getParentId();
    }
}
