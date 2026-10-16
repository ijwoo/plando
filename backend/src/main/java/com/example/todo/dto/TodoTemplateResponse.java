package com.example.todo.dto;

import com.example.todo.entity.TodoTemplate;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;

@Getter
@Builder
public class TodoTemplateResponse {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private Long id;
    private Long workspaceId;
    private String creatorEmail;
    private String name;
    private String defaultTitle;
    private String defaultContent;
    private String defaultPriority;
    private List<String> defaultAssigneeEmails;
    private List<String> defaultSubtasks;
    private Long defaultProjectId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static TodoTemplateResponse from(TodoTemplate t) {
        return TodoTemplateResponse.builder()
                .id(t.getId())
                .workspaceId(t.getWorkspaceId())
                .creatorEmail(t.getCreatorEmail())
                .name(t.getName())
                .defaultTitle(t.getDefaultTitle())
                .defaultContent(t.getDefaultContent())
                .defaultPriority(t.getDefaultPriority() != null ? t.getDefaultPriority().name() : null)
                .defaultAssigneeEmails(parseJson(t.getDefaultAssigneeEmails()))
                .defaultSubtasks(parseJson(t.getDefaultSubtasks()))
                .defaultProjectId(t.getDefaultProjectId())
                .createdAt(t.getCreatedAt())
                .updatedAt(t.getUpdatedAt())
                .build();
    }

    private static List<String> parseJson(String json) {
        if (json == null || json.isBlank()) return Collections.emptyList();
        try {
            return MAPPER.readValue(json, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }
}
