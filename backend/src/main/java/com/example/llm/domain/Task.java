package com.example.llm.domain;

import java.time.LocalDate;
import java.time.LocalTime;

public class Task {
    public String id;
    public String projectId;
    public String title;
    public String description;
    public String status;
    public String priority;
    public LocalDate startAt;
    public LocalDate dueDate;
    public LocalTime startTime;
    public LocalTime endTime;
    public String assigneeId;
    public String userEmail;
    public String locationName;
    /** AI 인식 태그 — 서버에서 실존 태그로 매핑된 것만 [{id,name,color}] */
    public java.util.List<java.util.Map<String, Object>> tags;

    // 날짜 초기화 플래그 (patch 시 null-set 신호)
    public boolean clearDueDate;
    public boolean clearStartAt;

    // 온보딩용 샘플 할 일 여부 — true 인 경우 챗봇 수정/삭제 차단
    public boolean isSample;
}
