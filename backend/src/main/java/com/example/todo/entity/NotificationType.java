package com.example.todo.entity;

public enum NotificationType {
    TASK_ASSIGNED,
    TASK_DUE,
    COMMENT,
    MENTION,
    DM_RECEIVED,
    // 그룹 DM 멘션. MENTION으로 보내면 targetId(=DM 방 id)를 클라이언트가 todoId로 오해해
    // 할 일 상세로 라우팅됐다. "DM" 접두사를 붙여 기존 DM 분기(startsWith("DM"))가 그대로 태우도록 한다.
    DM_MENTION,
    LOCATION_ENTER,
    RECRUITMENT_APPLIED,
    RECRUITMENT_ACCEPTED,
    RECRUITMENT_REJECTED,
    RECRUITMENT_QUESTION_RECEIVED,
    RECRUITMENT_QUESTION_ANSWERED,
    WRAP_WEEKLY,
    // 예약해 둔 AI 역할의 실행 결과. targetId 가 없다 — 특정 할 일이 아니라 요약이라서,
    // 탭하면 AI 화면으로 보낸다.
    AI_SCHEDULE
}