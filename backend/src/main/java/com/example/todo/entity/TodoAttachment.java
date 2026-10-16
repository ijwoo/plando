package com.example.todo.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "todo_attachment", schema = "todo")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TodoAttachment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long todoId;

    @Column(nullable = false)
    private String uploaderEmail;

    private String uploaderName;

    @Column(nullable = false, length = 512)   // 운영 컬럼 varchar(512)
    private String fileUrl;

    @Column(nullable = false)
    private String fileName;

    @Column(length = 100)   // 운영 컬럼 varchar(100) — 기본값 255 로 두면 테스트만 통과한다
    private String fileType;

    private Long fileSize;

    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
    }
}
