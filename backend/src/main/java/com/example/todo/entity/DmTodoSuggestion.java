package com.example.todo.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * DM 대화에서 AI가 감지한 "할 일 제안".
 * 메시지당 최대 1건. 수락 시 클라이언트가 만든 todoId를 메시지에 연결(linkedTodoId)하고 ACCEPTED로 종결.
 */
@Entity
@Table(name = "dm_todo_suggestions", schema = "todo")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DmTodoSuggestion {

    public static final String STATUS_PENDING = "PENDING";
    public static final String STATUS_ACCEPTED = "ACCEPTED";
    public static final String STATUS_DISMISSED = "DISMISSED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long roomId;

    /** 감지 대상 메시지 — 메시지당 1건 */
    @Column(nullable = false, unique = true)
    private Long messageId;

    @Column(nullable = false)
    private Long workspaceId;

    @Column(nullable = false, length = 200)
    private String title;

    private LocalDate dueDate;

    @Column(length = 5)
    private String dueTime; // "HH:mm"

    /** AI가 추론한 담당 후보(약속한 사람) — 확인 시트의 기본값일 뿐 강제 아님 */
    @Column(length = 255)
    private String ownerEmail;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = STATUS_PENDING;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
