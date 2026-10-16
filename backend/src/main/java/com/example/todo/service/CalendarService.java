package com.example.todo.service;

import com.example.todo.dto.CalendarEventDto;
import com.example.todo.entity.Workspace;
import com.example.todo.repository.TodoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CalendarService {

    private final TodoRepository todoRepository;
    private final WorkspaceResolver workspaceResolver;

    public List<CalendarEventDto> getAllCalendarEvents(String userEmail, Long workspaceId) {
        Workspace workspace = workspaceResolver.resolve(userEmail, workspaceId);

        return todoRepository.findByWorkspaceAndArchivedFalseWithAssignees(workspace).stream()
                .map(todo -> CalendarEventDto.builder()
                        .id(todo.getId())
                        .title(todo.getTitle())
                        .start(todo.getDueDate() != null ? todo.getDueDate().toString() : null)
                        .end(todo.getDueDate() != null ? todo.getDueDate().toString() : null)
                        .priority(todo.getPriority() != null ? todo.getPriority().name() : null)
                        .assignees(todo.getAssignees().stream()
                                .map(user -> CalendarEventDto.AssigneeDto.builder()
                                        .name(user.getName())
                                        .email(user.getEmail())
                                        .build())
                                .toList())
                        .build())
                .toList();
    }
}