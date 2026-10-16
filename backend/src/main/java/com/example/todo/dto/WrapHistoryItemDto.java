package com.example.todo.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

/**
 * 회고 히스토리 그리드용 brief.
 * 카드 한 장에 들어가는 핵심 수치만.
 */
@Getter @Setter @Builder @AllArgsConstructor @NoArgsConstructor
public class WrapHistoryItemDto {
    private LocalDate weekStart;
    private int year;
    private int month;
    private int weekIndex;
    private String rangeLabel;
    private int totalCount;
    private int pastCount;
    private int pastDoneCount;
    private int pastCompletionRate;
    private boolean current;       // 이번 주 여부
}
