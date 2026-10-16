package com.example.todo.controller;

import com.example.todo.dto.CalendarEventDto;
import com.example.todo.service.CalendarService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/calendar")
@RequiredArgsConstructor
public class CalendarController {

    private final CalendarService calendarService;

    @GetMapping
    public List<CalendarEventDto> getCalendarEvents(
            Authentication authentication,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId
    ) {
        String userEmail = authentication.getName();
        return calendarService.getAllCalendarEvents(userEmail, workspaceId);
    }
}