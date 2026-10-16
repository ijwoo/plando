package com.example.todo.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 작성자(user)의 모집글 Q&A 응답 통계.
 * 프론트는 totalQuestionCount > 0일 때만 사이드바 한 줄 라인 노출.
 * 0건이면 answerRate / avgAnswerLatencyMinutes 는 null.
 */
@Getter
@AllArgsConstructor
@NoArgsConstructor
public class UserQaStatsDto {
    private Long    userId;
    private int     totalQuestionCount;
    private int     answeredCount;
    private Integer answerRate;              // 0~100 (%), null 가능
    private Long    avgAnswerLatencyMinutes; // 분, null 가능
}
