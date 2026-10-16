package com.example.todo.dto;

import com.example.todo.entity.RecruitmentQuestion;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class RecruitmentQuestionDto {

    private Long id;
    private String body;          // 비공개 + 권한 없으면 null (마스킹)
    private Long askerId;
    private String askerName;     // 비공개 + 권한 없으면 null (익명 처리)
    private String askerAvatar;
    private String createdAt;   // ISO-8601
    private String updatedAt;   // ISO-8601
    @JsonProperty("isPinned")
    private boolean isPinned;
    @JsonProperty("isPrivate")
    private boolean isPrivate;
    private RecruitmentAnswerDto answer;  // 비공개 + 권한 없으면 body가 null

    public RecruitmentQuestionDto(RecruitmentQuestion q) {
        this(q, true);
    }

    /**
     * @param canView true면 본문 노출, false면 비공개 마스킹 (id/isPrivate/시각 정보만 노출)
     */
    public RecruitmentQuestionDto(RecruitmentQuestion q, boolean canView) {
        this.id = q.getId();
        this.isPrivate = q.isPrivate();
        this.createdAt = q.getCreatedAt() != null ? q.getCreatedAt().toString() : null;
        this.updatedAt = q.getUpdatedAt() != null ? q.getUpdatedAt().toString() : null;
        this.isPinned = q.isPinned();

        if (canView) {
            this.body = q.getBody();
            if (q.getAsker() != null) {
                this.askerId = q.getAsker().getId();
                this.askerName = q.getAsker().getName();
                this.askerAvatar = q.getAsker().getProfileImageUrl();
            }
            this.answer = q.getAnswer() != null ? new RecruitmentAnswerDto(q.getAnswer()) : null;
        } else {
            // 비공개 — 본문/답변 본문 마스킹, asker 식별 정보도 비노출
            this.body = null;
            this.askerId = null;
            this.askerName = null;
            this.askerAvatar = null;
            this.answer = q.getAnswer() != null
                    ? RecruitmentAnswerDto.maskedFrom(q.getAnswer())
                    : null;
        }
    }
}
