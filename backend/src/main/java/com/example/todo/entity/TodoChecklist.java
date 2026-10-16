package com.example.todo.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.time.LocalDateTime;

@Entity
@Table(name = "todo_checklist", schema = "todo")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class TodoChecklist {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long todoId;

    @Column(nullable = false, length = 500)   // 운영 컬럼 varchar(500)
    private String content;

    @Builder.Default
    @Column(nullable = false)
    private boolean checked = false;

    @Builder.Default
    @Column(nullable = false)
    private int orderIndex = 0;

    @CreationTimestamp
    private LocalDateTime createdAt;
    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
