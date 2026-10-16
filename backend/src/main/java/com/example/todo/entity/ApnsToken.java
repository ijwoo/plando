package com.example.todo.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "apns_tokens", schema = "todo",
        uniqueConstraints = @UniqueConstraint(columnNames = {"deviceToken"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ApnsToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String deviceToken;

    @Column(nullable = false)
    private String userEmail;

    @Column(nullable = false, length = 100)
    private String bundleId;

    @Column(nullable = false)
    private LocalDateTime createdAt;
}
