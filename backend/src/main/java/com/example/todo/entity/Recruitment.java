package com.example.todo.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "recruitment", schema = "todo")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Recruitment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String summary;

    /** 카테고리: 토이프로젝트, 사이드프로젝트, 스터디, 해커톤, 창업 */
    @Column(nullable = false)
    private String category;

    /** 상태: 모집중, 모집완료, 진행중 */
    @Column(nullable = false)
    @Builder.Default
    private String status = "모집중";

    private String locationText;
    private Double locationLat;
    private Double locationLng;

    @Column(nullable = false)
    @Builder.Default
    private boolean hasLocation = false;

    @Column(nullable = false)
    @Builder.Default
    private int maxMembers = 4;

    private LocalDate deadline;

    /** 진행 방식: online, offline, mixed */
    @Builder.Default
    private String meetType = "online";

    private String frequency;
    private String duration;

    /** 팀장 직책 (예: "PM/기획", "풀스택 개발자") */
    private String leaderRole;

    /** 팀장 소개 */
    @Column(columnDefinition = "TEXT")
    private String leaderBio;

    /** 지원자에게 바라는 점 */
    @Column(columnDefinition = "TEXT")
    private String requirements;

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "recruitment_tech_stack", schema = "todo",
            joinColumns = @JoinColumn(name = "recruitment_id"))
    @Column(name = "tech_stack")
    @Builder.Default
    private List<String> techStacks = new ArrayList<>();

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "recruitment_tool", schema = "todo",
            joinColumns = @JoinColumn(name = "recruitment_id"))
    @Column(name = "tool")
    @Builder.Default
    private List<String> tools = new ArrayList<>();

    @Builder.Default
    private int viewCount = 0;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "author_id")
    private User author;

    /** 연관 워크스페이스 (생성 시 현재 워크스페이스 연결, nullable) */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "workspace_id")
    private Workspace workspace;

    @OneToMany(mappedBy = "recruitment", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id ASC")
    @Builder.Default
    private List<RecruitmentRole> roles = new ArrayList<>();

    @OneToMany(mappedBy = "recruitment", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("orderIndex ASC")
    @Builder.Default
    private List<RecruitmentChecklist> checklist = new ArrayList<>();

    @OneToMany(mappedBy = "recruitment", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<RecruitmentApplication> applications = new ArrayList<>();

    @OneToMany(mappedBy = "recruitment", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<RecruitmentMember> members = new ArrayList<>();

    @OneToMany(mappedBy = "recruitment", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<RecruitmentBookmark> bookmarks = new ArrayList<>();

    @OneToMany(mappedBy = "recruitment", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<RecruitmentQuestion> questions = new ArrayList<>();

    /** 운영자가 숨긴 시각. null = 공개. 숨긴 글은 목록·검색·상세 어디에도 나오지 않는다(작성자 본인 제외). */
    @Column(name = "hidden_at")
    private LocalDateTime hiddenAt;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    /**
     * 진행 방식 값을 정규 어휘(online/offline/mixed)로 맞춘다.
     *
     * 클라이언트마다 다른 값을 보내 왔다. 운영 DB 5건이 "OFFLINE"(대문자) 3건, "hybrid" 2건으로
     * <b>단 한 건도</b> 정규 어휘가 아니었고, 그 결과 상세의 진행 방식 태그가 전부 비어 나갔다.
     * 클라이언트에서만 읽기 보정을 하면 서버가 만드는 태그는 계속 비므로, 저장 시점에 여기서 맞춘다.
     * 읽기 경로(buildProcessTags)에서도 한 번 더 통과시켜 이미 저장된 옛 값까지 살린다.
     *
     * 모르는 값은 null 로 두고 억지로 online 으로 만들지 않는다 — 대면 모임이 온라인으로
     * 둔갑하는 편이 태그가 없는 것보다 나쁘다.
     */
    public static String normalizeMeetType(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String v = raw.trim().toLowerCase();
        return switch (v) {
            case "online" -> "online";
            case "offline" -> "offline";
            case "mixed", "hybrid" -> "mixed";
            default -> null;
        };
    }
}
