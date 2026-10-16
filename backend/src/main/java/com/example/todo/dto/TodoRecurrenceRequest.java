package com.example.todo.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import java.time.LocalDate;

@Getter @NoArgsConstructor
public class TodoRecurrenceRequest {
    private String recurrenceType;  // DAILY, WEEKLY, MONTHLY, NONE
    private LocalDate endDate;
}
