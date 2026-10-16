package com.example.todo.entity;

/**
 * 상태 카테고리 — 커스텀 상태의 "완료 여부"를 상태 문자열이 아니라 카테고리로 판정하기 위한 3구분.
 *  - TODO       : 미시작
 *  - IN_PROGRESS: 진행 중
 *  - DONE       : 완료 (완료율·자동보관·리마인더 등 모든 완료 파급의 기준)
 */
public enum StatusCategory {
    TODO,
    IN_PROGRESS,
    DONE
}
