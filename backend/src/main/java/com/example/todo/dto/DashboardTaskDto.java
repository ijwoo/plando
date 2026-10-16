package com.example.todo.dto;


import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
@AllArgsConstructor
@Builder
public class DashboardTaskDto {
    private Long id;
    private String title;
    private String status;
    private String priority;
    private LocalDate dueDate;
}
