package com.example.todo.dto;

import com.example.todo.entity.TodoRecurrence;
import lombok.Builder;
import lombok.Getter;
import java.time.LocalDate;

@Getter @Builder
public class TodoRecurrenceResponse {
    private Long id;
    private Long sourceTodoId;
    private String recurrenceType;
    private LocalDate endDate;
    private LocalDate lastGeneratedDate;

    public static TodoRecurrenceResponse from(TodoRecurrence r) {
        return TodoRecurrenceResponse.builder()
                .id(r.getId())
                .sourceTodoId(r.getSourceTodoId())
                .recurrenceType(r.getRecurrenceType().name())
                .endDate(r.getEndDate())
                .lastGeneratedDate(r.getLastGeneratedDate())
                .build();
    }
}
