package com.example.todo.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
@AllArgsConstructor
public class RecentActivityDto {
    private Long todoId;
    private String todoTitle;
    private String modifier;
    private String modifierName;
    private String field;
    private String afterValue;
    private LocalDateTime modifiedAt;
}
