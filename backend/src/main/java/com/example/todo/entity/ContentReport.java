package com.example.todo.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * 사용자 신고. 대상은 모집글 · Q&A 질문 · 사용자.
 *
 * targetUserId 는 신고 시점의 콘텐츠 작성자다. 운영자가 "이 사람 신고가 몇 건인지"를 볼 때
 * 대상 종류마다 다시 조인하지 않으려고 같이 남긴다.
 */
@Entity
@Table(name = "content_reports", schema = "todo",
        uniqueConstraints = @UniqueConstraint(name = "uk_report_reporter_target",
                columnNames = {"reporter_id", "target_type", "target_id"}),
        indexes = {
                @Index(name = "idx_report_status_created", columnList = "status, created_at"),
                @Index(name = "idx_report_target", columnList = "target_type, target_id")
        })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ContentReport {

    public enum TargetType { RECRUITMENT, QUESTION, USER }

    /** 신고 사유 — 앱의 선택지와 같다. */
    public enum Reason { SPAM, ABUSE, SEXUAL, ILLEGAL, PRIVACY, OTHER }

    public enum Status { OPEN, RESOLVED, DISMISSED }

    /** 운영자 조치 — RESOLVED 일 때 무엇을 했는지. */
    public enum Resolution { HIDE_CONTENT, SUSPEND_USER, DISMISS }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "reporter_id", nullable = false)
    private Long reporterId;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_type", nullable = false, length = 20)
    private TargetType targetType;

    @Column(name = "target_id", nullable = false)
    private Long targetId;

    @Column(name = "target_user_id")
    private Long targetUserId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Reason reason;

    @Column(length = 500)
    private String detail;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private Status status = Status.OPEN;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "handled_by")
    private Long handledBy;

    @Column(name = "handled_at")
    private LocalDateTime handledAt;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private Resolution resolution;

    @Column(name = "resolution_note", length = 500)
    private String resolutionNote;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
