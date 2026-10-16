package com.example.todo.dto;

import com.example.todo.entity.WorkspaceRole;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class WorkspaceSummaryResponse {
    private Long workspaceId;
    private String workspaceName;
    private String inviteCode;
    private WorkspaceRole role;
    private String iconImageUrl;
    /** 워크스페이스 멤버 수 (프론트 모집 생성 Step2의 현재 팀원수 자동 매핑용) */
    private int memberCount;
}