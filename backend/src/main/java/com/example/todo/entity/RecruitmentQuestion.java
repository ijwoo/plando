package com.example.todo.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "recruitment_question", schema = "todo",
        indexes = {
                @Index(name = "idx_rq_recruitment_hidden_pinned_created",
                        columnList = "recruitment_id, is_hidden, is_pinned, created_at"),
                @Index(name = "idx_rq_asker", columnList = "asker_id")
        })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RecruitmentQuestion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recruitment_id", nullable = false)
    private Recruitment recruitment;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "asker_id", nullable = false)
    private User asker;

    @Column(nullable = false, length = 500)
    private String body;

    @Column(name = "is_hidden", nullable = false)
    @Builder.Default
    private boolean hidden = false;

    @Column(name = "is_pinned", nullable = false)
    @Builder.Default
    private boolean pinned = false;

    /**
     * 비공개 질문 — 작성자(모집글 author) + 질문자(asker)만 본문/답변 내용 조회 가능.
     * 다른 사용자에게는 카드/카운트는 노출되지만 본문은 "비공개" placeholder 처리.
     */
    @Column(name = "is_private", nullable = false)
    @Builder.Default
    private boolean isPrivate = false;

    @OneToOne(mappedBy = "question", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private RecruitmentAnswer answer;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
