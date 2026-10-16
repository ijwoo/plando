package com.example.todo.dto;

import com.example.todo.entity.Recruitment;
import com.example.todo.entity.RecruitmentChecklist;
import com.example.todo.entity.RecruitmentMember;
import com.example.todo.entity.RecruitmentRole;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Getter
@Setter
@NoArgsConstructor
public class RecruitmentDetailResponse {

    // ── 목록과 동일 ─────────────────────────
    private Long id;
    private String title;
    private String summary;
    private String typeLabel;
    private String statusLabel;
    private List<String> techStacks;
    private String locationText;
    private Double locationLat;
    private Double locationLng;
    private boolean hasLocation;
    private String headCount;   // "현재/최대명"
    private String dueDate;     // "MM/dd" 포맷
    private String dueText;
    private boolean bookmarked;

    // ── 수정용 raw 필드 ──────────────────────
    private int maxMembers;
    private int currentMembers;
    private String meetType;
    private String frequency;
    private String duration;
    private List<String> tools;
    private LocalDate deadline;
    private String leaderRole;
    private String leaderBio;
    private String requirements;

    // ── 상세 전용 ────────────────────────────
    private int applicants;     // 총 지원자 수 (PENDING 포함)
    /**
     * 아직 수락/거절되지 않은 신청 수. applicants 는 PENDING+ACCEPTED 총합이라
     * "검토 대기 N명" 문구에 쓸 수 없었다(수락을 끝낸 팀도 대기 중인 것처럼 보였다).
     */
    private int pendingApplicants;
    private int views;
    private List<RoleDto> roles;
    private List<String> processTags;
    private LeaderDto leader;
    private List<ProgressDto> progress;
    private List<MemberDto> members;
    private String appliedStatus;  // 현재 사용자의 지원 상태: null / "PENDING" / "ACCEPTED" / "CANCELLED"
    @JsonProperty("isAuthor")
    private boolean isAuthor;      // 현재 사용자가 작성자인지

    // ── 워크스페이스 (수락된 경우 노출) ──────────
    private Long workspaceId;          // 연관 워크스페이스 ID
    private String workspaceInviteCode; // 수락된 사용자에게만 공개

    // ── Q&A 카운트 (서비스에서 setter로 주입) ──────────
    private int questionCount;     // 비숨김 질문 총 수 (탭 배지용)
    private int unansweredCount;   // 미답변 비숨김 질문 수 (작성자 강조용)

    public RecruitmentDetailResponse(Recruitment r, boolean bookmarked, int applicantsCount, String appliedStatus, boolean isAuthor,
                                     Map<Long, Integer> roleAcceptedCounts) {
        this.id = r.getId();
        this.title = r.getTitle();
        this.summary = r.getSummary();
        this.typeLabel = r.getCategory();
        this.statusLabel = r.getStatus();
        this.techStacks = r.getTechStacks();
        this.locationText = r.getLocationText();
        this.locationLat = r.getLocationLat();
        this.locationLng = r.getLocationLng();
        this.hasLocation = r.isHasLocation();
        this.headCount = r.getMembers().size() + "/" + r.getMaxMembers() + "명";
        this.dueDate = formatDueDate(r.getDeadline());
        this.dueText = computeDueText(r.getDeadline());
        this.bookmarked = bookmarked;
        this.maxMembers = r.getMaxMembers();
        this.currentMembers = r.getMembers().size();
        this.meetType = r.getMeetType();
        this.frequency = r.getFrequency();
        this.duration = r.getDuration();
        this.tools = r.getTools() != null ? r.getTools() : new ArrayList<>();
        this.deadline = r.getDeadline();
        this.leaderRole = r.getLeaderRole();
        this.leaderBio = r.getLeaderBio();
        this.requirements = r.getRequirements();
        this.applicants = applicantsCount;
        this.views = r.getViewCount();
        this.roles = r.getRoles().stream()
                .map(role -> new RoleDto(role,
                        roleAcceptedCounts != null
                                ? roleAcceptedCounts.getOrDefault(role.getId(), 0)
                                : 0))
                .collect(Collectors.toList());
        this.processTags = buildProcessTags(r);
        this.leader = buildLeader(r);
        this.progress = r.getChecklist().stream().map(ProgressDto::new).collect(Collectors.toList());
        this.members = r.getMembers().stream().map(MemberDto::new).collect(Collectors.toList());
        this.appliedStatus = appliedStatus;
        this.isAuthor = isAuthor;
        // 워크스페이스 정보: 수락된 사용자 또는 작성자에게 공개
        if (r.getWorkspace() != null && ("ACCEPTED".equals(appliedStatus) || isAuthor)) {
            this.workspaceId = r.getWorkspace().getId();
            this.workspaceInviteCode = r.getWorkspace().getInviteCode();
        }
    }

    // ── 중첩 DTO ─────────────────────────────

    @Getter
    @Setter
    @NoArgsConstructor
    public static class RoleDto {
        private Long id;
        private String name;
        private int count;          // 모집 정원
        private int acceptedCount;  // 현재 수락된 신청자 수 — 프론트에서 "N/M명" 진행도 표시
        private String description;
        private String status;

        RoleDto(RecruitmentRole role, int acceptedCount) {
            this.id = role.getId();
            this.name = role.getName();
            this.count = role.getCount();
            this.acceptedCount = acceptedCount;
            this.description = role.getDescription();
            this.status = role.getStatus();
        }
    }

    @Getter
    @Setter
    @NoArgsConstructor
    public static class LeaderDto {
        private Long userId;
        private String name;
        private String role;
        private String bio;
        private boolean online;

        LeaderDto(Recruitment r) {
            if (r.getAuthor() != null) {
                this.userId = r.getAuthor().getId();
                this.name = r.getAuthor().getName();
            }
            this.role = r.getLeaderRole();
            this.bio = r.getLeaderBio();
            this.online = false;
        }
    }

    @Getter
    @Setter
    @NoArgsConstructor
    public static class ProgressDto {
        private Long id;
        private String label;
        private boolean done;

        ProgressDto(RecruitmentChecklist c) {
            this.id = c.getId();
            this.label = c.getLabel();
            this.done = c.isDone();
        }
    }

    @Getter
    @Setter
    @NoArgsConstructor
    public static class MemberDto {
        private Long id;
        private String name;
        private String role;

        MemberDto(RecruitmentMember m) {
            this.id = m.getId();
            this.name = m.getUser() != null ? m.getUser().getName() : "";
            this.role = m.getRoleLabel();
        }
    }

    // ── 유틸 ─────────────────────────────────

    private static String computeDueText(LocalDate deadline) {
        if (deadline == null) return "마감일 미정";
        long days = ChronoUnit.DAYS.between(LocalDate.now(), deadline);
        if (days < 0) return "마감됨";
        if (days == 0) return "D-Day";
        return days + "일 남음";
    }

    private static String formatDueDate(LocalDate deadline) {
        if (deadline == null) return "미정";
        return String.format("%02d/%02d", deadline.getMonthValue(), deadline.getDayOfMonth());
    }

    private static List<String> buildProcessTags(Recruitment r) {
        List<String> tags = new ArrayList<>();
        // 옛 데이터에 "OFFLINE"/"hybrid" 같은 비정규 값이 남아 있어 그대로 switch 하면 태그가 빈다.
        String meet = Recruitment.normalizeMeetType(r.getMeetType());
        if (meet != null) {
            switch (meet) {
                case "online"  -> tags.add("온라인");
                case "offline" -> tags.add("대면 중심");
                case "mixed"   -> tags.add("온·오프라인 혼합");
            }
        }
        if (r.getFrequency() != null && !r.getFrequency().isBlank())
            tags.add(r.getFrequency());
        if (r.getDuration() != null && !r.getDuration().isBlank())
            tags.add(r.getDuration());
        if (r.getTools() != null)
            tags.addAll(r.getTools());
        return tags;
    }

    private static LeaderDto buildLeader(Recruitment r) {
        return new LeaderDto(r);
    }
}
