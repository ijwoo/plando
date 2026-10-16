package com.example.llm.domain;

import java.time.LocalDate;
import java.time.LocalTime;

public class TaskPatch {
    public String title;
    public String description;
    public String status;
    public String priority;
    public LocalDate startAt;
    public LocalDate dueDate;
    public LocalTime startTime;
    public LocalTime endTime;
    public String assigneeId;
    public boolean clearDueDate;
    public boolean clearStartAt;
}
