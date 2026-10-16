package com.example.todo.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * 태그(라벨) — 워크스페이스 안에서 할 일을 프로젝트·우선순위와 별개로 가로질러 분류하는 꼬리표.
 * 예: #긴급 #버그 #회의 #대기중. 재사용 가능(이름+색), 여러 할 일에 부착(TodoTag 조인).
 */
@Entity
@Table(
        name = "tag",
        schema = "todo",
        uniqueConstraints = @UniqueConstraint(columnNames = {"workspace_id", "name"})
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Tag {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 40)
    private String name;

    /** 표시 색 (#RRGGBB) */
    @Column(length = 16)
    private String color;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "workspace_id", nullable = false)
    private Workspace workspace;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    @CreationTimestamp
    @Column(updatable = false, nullable = false)
    private LocalDateTime createdAt;
}
