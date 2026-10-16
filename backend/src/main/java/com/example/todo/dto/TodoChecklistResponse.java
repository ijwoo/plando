package com.example.todo.dto;

import com.example.todo.entity.TodoChecklist;
import lombok.Builder;
import lombok.Getter;
import java.time.LocalDateTime;

@Getter @Builder
public class TodoChecklistResponse {
    private Long id;
    private Long todoId;
    private String content;
    private boolean checked;
    private int orderIndex;
    private LocalDateTime createdAt;

    public static TodoChecklistResponse from(TodoChecklist c) {
        return TodoChecklistResponse.builder()
                .id(c.getId())
                .todoId(c.getTodoId())
                .content(c.getContent())
                .checked(c.isChecked())
                .orderIndex(c.getOrderIndex())
                .createdAt(c.getCreatedAt())
                .build();
    }
}
