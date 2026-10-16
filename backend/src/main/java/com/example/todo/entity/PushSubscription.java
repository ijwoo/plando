package com.example.todo.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "push_subscriptions", schema = "todo")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PushSubscription {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 512)
    private String endpoint;

    @Column(nullable = false, length = 256)
    private String p256dhKey;

    @Column(nullable = false, length = 128)
    private String authKey;

    @Column(nullable = false)
    private String userEmail;

    @Column(nullable = false)
    private LocalDateTime createdAt;
}
