package com.example.todo.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class WorkspaceCreateRequest {
    @NotBlank(message = "워크스페이스 이름을 입력해주세요.")
    private String name;
}