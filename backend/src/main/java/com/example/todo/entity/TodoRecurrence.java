package com.example.todo.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "todo_recurrence", schema = "todo")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class TodoRecurrence {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long sourceTodoId;   // 원본 할 일 ID

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private RecurrenceType recurrenceType;  // DAILY, WEEKLY, MONTHLY

    private LocalDate endDate;   // 반복 종료일 (null이면 무기한)

    @Column(nullable = false)
    private LocalDate lastGeneratedDate;  // 마지막으로 생성된 날짜

    @CreationTimestamp
    private LocalDateTime createdAt;

    public enum RecurrenceType {
        DAILY, WEEKLY, MONTHLY
    }
}
