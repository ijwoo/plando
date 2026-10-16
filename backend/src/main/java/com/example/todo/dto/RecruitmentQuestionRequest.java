package com.example.todo.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class RecruitmentQuestionRequest {
    private String body;

    /**
     * 비공개 질문 여부 — 작성자/질문자만 본문 조회 가능.
     * Lombok이 boolean `isPrivate` 필드에 대해 setter를 `setPrivate()`으로 만들어
     * Jackson이 JSON 키 `isPrivate`을 못 알아보므로 @JsonProperty로 명시.
     */
    @JsonProperty("isPrivate")
    private boolean isPrivate;
}
