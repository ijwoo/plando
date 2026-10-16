package com.example.todo.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class TodoTemplateRequest {
    @NotBlank(message = "템플릿 이름을 입력해주세요.")
    private String name;
    private String defaultTitle;
    private String defaultContent;
    private String defaultPriority;
    private List<String> defaultAssigneeEmails;
    private List<String> defaultSubtasks;
    private Long defaultProjectId;
}
