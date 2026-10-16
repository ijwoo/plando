package com.example.todo.dto;

import com.example.todo.entity.DmTodoSuggestion;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class DmTodoSuggestionResponse {

    private Long id;
    private Long roomId;
    private Long messageId;
    private String title;
    private String dueDate;  // "YYYY-MM-DD"
    private String dueTime;  // "HH:mm"
    private String ownerEmail;
    private String status;

    public static DmTodoSuggestionResponse from(DmTodoSuggestion s) {
        return DmTodoSuggestionResponse.builder()
                .id(s.getId())
                .roomId(s.getRoomId())
                .messageId(s.getMessageId())
                .title(s.getTitle())
                .dueDate(s.getDueDate() != null ? s.getDueDate().toString() : null)
                .dueTime(s.getDueTime())
                .ownerEmail(s.getOwnerEmail())
                .status(s.getStatus())
                .build();
    }
}
