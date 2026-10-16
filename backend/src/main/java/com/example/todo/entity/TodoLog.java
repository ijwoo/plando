package com.example.todo.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TodoLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long todoId;

    private String field; // 변경된 필드명: title, content, priority 등

    private String beforeValue;

    private String afterValue;

    private String modifier; // 변경한 사용자 이메일

    private LocalDateTime modifiedAt;
}
