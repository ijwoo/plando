package com.example.todo.dto;

import lombok.*;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SearchResultDto {

    private List<TaskResult>    tasks;
    private List<MessageResult> messages;
    private List<MemberResult>  members;
    private List<ProjectResult> projects;
    private List<TagResult>     tags;
    /** 할 일 결과가 더 있는지 — 클라이언트의 '더 보기' 판단용 (검색은 전체를 훑어야 하므로 페이징한다) */
    private boolean             hasMoreTasks;

    // ── 태그 ───────────────────────────────────────────────────
    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TagResult {
        private Long   id;
        private String name;
        private String color;
        /** 이 태그가 붙은 미아카이브 할 일 수 */
        private long   todoCount;
    }

    // ── 프로젝트 ───────────────────────────────────────────────
    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ProjectResult {
        private Long   id;
        private String name;
        private String color;
        /** 이 프로젝트의 미완료 할 일 수 — 목록에서 바로 규모를 가늠할 수 있게 */
        private long   openCount;
    }

    // ── 할 일 ──────────────────────────────────────────────────
    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TaskResult {
        private Long             id;
        private String           title;
        private String           status;    // TODO | IN_PROGRESS | DONE
        private String           priority;  // HIGH | MEDIUM | LOW
        private String           dueDate;   // yyyy-MM-dd (nullable)
        /** 보관 여부 — 검색이 아카이브도 훑게 되면서 결과에 섞이므로 클라이언트가 구분 표시해야 한다.
         *  이게 없으면 클라이언트가 /todos/archived를 따로 불러 id를 대조해야 했다. */
        private boolean          archived;
        private List<AssigneeInfo> assignees;
    }

    // ── 메시지 (DM 룸 기준) ────────────────────────────────────
    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MessageResult {
        private Long          roomId;
        private Long          partnerId;
        private String        partnerName;
        private String        partnerProfileImageUrl;
        private String        lastMessage;
        private LocalDateTime sentAt;
    }

    // ── 멤버 ──────────────────────────────────────────────────
    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MemberResult {
        private Long   userId;
        private String name;
        private String email;
        private String profileImageUrl;
        private String role;  // OWNER | MEMBER
    }

    // ── 담당자 공통 ────────────────────────────────────────────
    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AssigneeInfo {
        private String name;
        private String profileImageUrl;
    }
}
