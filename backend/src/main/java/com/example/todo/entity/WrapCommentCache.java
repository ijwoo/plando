package com.example.todo.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 주간 회고 AI 한마디 캐시.
 * 같은 사용자 + 같은 주차 + 같은 페르소나에 대한 LLM 응답을 1회만 호출하고 재사용.
 */
@Entity
@Table(
        name = "wrap_comment_cache",
        schema = "todo",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_wrap_comment_user_week_persona",
                columnNames = {"user_id", "week_start", "persona"}
        )
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WrapCommentCache {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "week_start", nullable = false)
    private LocalDate weekStart;

    /** 페르소나 ID — analyst(기본) / cynical / cheer / brutal */
    @Column(name = "persona", nullable = false, length = 32)
    @Builder.Default
    private String persona = "analyst";

    @Column(name = "comment", nullable = false, length = 500)
    private String comment;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
