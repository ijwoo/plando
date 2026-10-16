package com.example.todo.dto;

import com.example.todo.entity.WorkspaceMember;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class WorkspaceMemberResponse {

    private Long userId;
    private String name;
    private String email;
    private String profileImageUrl;
    private String role;

    public static WorkspaceMemberResponse from(WorkspaceMember wm) {
        return WorkspaceMemberResponse.builder()
                .userId(wm.getUser().getId())
                .name(wm.getUser().getName())
                .email(wm.getUser().getEmail())
                .profileImageUrl(wm.getUser().getProfileImageUrl())
                .role(wm.getRole() != null ? wm.getRole().name() : null)
                .build();
    }
}
