package com.example.todo.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "todo_template", schema = "todo")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TodoTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long workspaceId;

    @Column(nullable = false)
    private String creatorEmail;

    /** 템플릿 이름 (예: "버그 리포트", "회의록") */
    @Column(nullable = false)
    private String name;

    private String defaultTitle;

    @Column(columnDefinition = "TEXT")
    private String defaultContent;

    @Enumerated(EnumType.STRING)
    @Column(length = 10)
    private Priority defaultPriority;

    /** 담당자 이메일 목록 (JSON 배열 문자열) */
    @Column(columnDefinition = "TEXT")
    private String defaultAssigneeEmails;

    /** 서브태스크 내용 목록 (JSON 배열 문자열) */
    @Column(columnDefinition = "TEXT")
    private String defaultSubtasks;

    /** 기본 소속 프로젝트 (null = 인박스) */
    private Long defaultProjectId;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
