package com.example.todo.dto;

import com.example.todo.entity.RecruitmentAnswer;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class RecruitmentAnswerDto {

    private Long id;
    private String body;
    private Long authorId;
    private String authorName;
    private String createdAt;  // ISO-8601
    private String updatedAt;  // ISO-8601

    public RecruitmentAnswerDto(RecruitmentAnswer a) {
        this.id = a.getId();
        this.body = a.getBody();
        if (a.getAuthor() != null) {
            this.authorId = a.getAuthor().getId();
            this.authorName = a.getAuthor().getName();
        }
        this.createdAt = a.getCreatedAt() != null ? a.getCreatedAt().toString() : null;
        this.updatedAt = a.getUpdatedAt() != null ? a.getUpdatedAt().toString() : null;
    }

    /**
     * 비공개 질문의 답변 — "답변이 등록되었다는 사실"만 노출하고 본문/작성자는 가림.
     * frontend는 body==null && createdAt!=null 이면 "비공개 답변" 마스킹 카드로 렌더.
     */
    public static RecruitmentAnswerDto maskedFrom(RecruitmentAnswer a) {
        RecruitmentAnswerDto dto = new RecruitmentAnswerDto();
        dto.id = a.getId();
        dto.createdAt = a.getCreatedAt() != null ? a.getCreatedAt().toString() : null;
        dto.updatedAt = a.getUpdatedAt() != null ? a.getUpdatedAt().toString() : null;
        return dto;
    }
}
