package com.example.todo.dto;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class NotificationResponseDto {
    private Long id;
    private String type;
    private String title;
    private String message;
    private String senderName;
    private Long targetId;
    private Boolean read;
    private LocalDateTime createdAt;
}