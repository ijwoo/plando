package com.example.todo.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
public class RecruitmentCreateRequest {

    private String category;       // 토이프로젝트, 사이드프로젝트, 스터디, 해커톤, 창업
    private String title;
    private String summary;        // 프로젝트 소개
    private List<String> techStacks;
    private List<RoleRequest> roles;
    private int maxMembers;

    private String meetType;       // online, offline, mixed
    private String locationText;
    private Double locationLat;
    private Double locationLng;
    private boolean hasLocation;

    private String frequency;      // 주 1회, 주 2회 등
    private String duration;       // 1개월, 3개월 등
    private LocalDate deadline;
    private List<String> tools;    // Discord, Slack, Notion 등

    private String leaderRole;     // 팀장 직책
    private String leaderBio;      // 팀장 소개
    private String requirements;   // 지원자에게 바라는 점

    private Long workspaceId;      // 연관 워크스페이스 ID (nullable)

    @Getter
    @Setter
    @NoArgsConstructor
    public static class RoleRequest {
        private String name;
        private int count;
        private String description;
    }
}
