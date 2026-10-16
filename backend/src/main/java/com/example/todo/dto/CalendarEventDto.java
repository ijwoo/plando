package com.example.todo.dto;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@Builder
public class CalendarEventDto {
    private Long id;
    private String title;
    private String start;
    private String end;
    private String priority;
    private List<AssigneeDto> assignees;

    @Getter
    @Setter
    @Builder
    public static class AssigneeDto {
        private String name;
        private String email;
    }
}
