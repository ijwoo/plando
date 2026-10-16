package com.example.todo.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Per-user 포커스(⚡). 존재 = 해당 사용자에게 focused.
 * (userId, todoId) 조합이 unique — 사용자가 같은 todo를 두 번 마킹할 수 없음.
 *
 * Todo.focused boolean 컬럼은 legacy. 새 코드는 이 테이블만 읽고/쓴다.
 */
@Entity
@Table(
        name = "todo_focus",
        schema = "todo",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_todo_focus_user_todo",
                columnNames = {"user_id", "todo_id"}
        ),
        indexes = {
                @Index(name = "idx_todo_focus_user", columnList = "user_id"),
                @Index(name = "idx_todo_focus_todo", columnList = "todo_id")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TodoFocus {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "todo_id", nullable = false)
    private Long todoId;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
