package com.example.todo.dto;

import com.example.todo.entity.WorkspaceRole;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class WorkspaceActionResponse {
    private Long workspaceId;
    private String workspaceName;
    private String inviteCode;
    private WorkspaceRole role;
    private String message;
    private String iconImageUrl;
}