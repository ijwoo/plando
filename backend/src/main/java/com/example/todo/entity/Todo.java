package com.example.todo.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "todo", schema = "todo")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Todo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String content;

    /** 상태 key — 워크스페이스 workflow_status의 status_key 참조(문자열). 기본: TODO/IN_PROGRESS/DONE. */
    @Column(nullable = false)
    private String status;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Priority priority;

    private LocalDate startAt;

    private LocalDate dueDate;

    private java.time.LocalTime startTime;

    private java.time.LocalTime endTime;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "workspace_id", nullable = false)
    private Workspace workspace;

    /** 소속 프로젝트 — null = 인박스(소속 없음) */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id")
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    @Builder.Default
    @ManyToMany
    @JoinTable(
            name = "todo_assignees",
            schema = "todo",
            joinColumns = @JoinColumn(name = "todo_id"),
            inverseJoinColumns = @JoinColumn(name = "user_id")
    )
    private List<User> assignees = new ArrayList<>();

    @Builder.Default
    @Column(nullable = false)
    private Boolean isSample = false;

    @Builder.Default
    @Column(nullable = false)
    private Boolean archived = false;

    /**
     * @deprecated per-user 포커스로 마이그됨. {@link TodoFocus} 테이블이 진실 (existence = focused for that user).
     *             컬럼은 호환을 위해 남겨두지만 코드에서 더 이상 읽거나 쓰지 않는다.
     *             FocusMigrationRunner가 부팅 시 1회 작성자에게 이관하면서 이 값을 false로 reset한다.
     */
    @Deprecated
    @Builder.Default
    @Column(nullable = false, columnDefinition = "boolean default false")
    private Boolean focused = false;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    // 완료 시각 (자동 아카이브 기준)
    private LocalDateTime doneAt;

    // 지도 위치 정보 (선택)
    private Double locationLat;
    private Double locationLng;
    private String locationAddress;
    private String locationName;

    // 반복 일정: 스케줄러가 생성한 인스턴스에만 설정 (TodoRecurrence.id 참조)
    @Column(name = "recurrence_source_id")
    private Long recurrenceSourceId;

    // 서브태스크: 부모 할 일 ID (todo.id 자기참조, null = 최상위). 깊이는 1단계만 허용.
    /**
     * 오프라인에서 적은 것의 중복 방지 열쇠(앱이 생성).
     * 보냈는데 응답만 못 받은 경우 앱이 재전송하는데, 그때 같은 열쇠면 새로 만들지 않는다.
     * 열쇠 없이 만든 것(웹·기존 데이터)은 null 이다.
     */
    @Column(name = "client_key", length = 64)
    private String clientKey;

    @Column(name = "parent_id")
    private Long parentId;

    /**
     * 상태 변경 + 완료시각 정합. 완료 여부(done)는 카테고리로 판정한 값을 호출자가 전달
     * (엔티티는 워크스페이스 상태집합을 모르므로 서비스가 WorkflowStatusService.isDone으로 계산).
     */
    public void applyStatus(String newStatus, boolean done) {
        if (done && this.doneAt == null) {
            this.doneAt = LocalDateTime.now();
        } else if (!done) {
            this.doneAt = null;
        }
        this.status = newStatus;
    }
}