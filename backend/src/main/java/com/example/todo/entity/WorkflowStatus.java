package com.example.todo.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * 커스텀 상태(워크플로우) 정의 — 워크스페이스 단위. 예: 요청→진행→검토→반려→배포대기→완료.
 * Todo.status는 여기의 statusKey(불변)를 참조하는 문자열. label/color는 편집 가능.
 * "완료됐나?"는 category==DONE으로 판정(상태 문자열 아님).
 */
@Entity
@Table(
        name = "workflow_status",
        schema = "todo",
        uniqueConstraints = @UniqueConstraint(columnNames = {"workspace_id", "status_key"})
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WorkflowStatus {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "workspace_id", nullable = false)
    private Workspace workspace;

    /** 불변 식별자 — Todo.status가 참조. 기본 상태는 TODO/IN_PROGRESS/DONE, 커스텀은 st_xxxxxxxx. */
    @Column(name = "status_key", nullable = false, length = 64)
    private String statusKey;

    /** 표시명 (편집 가능) */
    @Column(nullable = false, length = 64)
    private String label;

    /** 표시 색 (#RRGGBB) */
    @Column(length = 16)
    private String color;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private StatusCategory category;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    /** 새 할 일이 받는 기본 상태(워크스페이스당 1개, category=TODO). */
    @Column(name = "is_default", nullable = false)
    private boolean isDefault;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false, nullable = false)
    private LocalDateTime createdAt;
}
