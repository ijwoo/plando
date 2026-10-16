package com.example.todo.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.DayOfWeek;
import java.time.LocalDateTime;

/**
 * 예약 실행 — 역할을 시간에 걸어둔 것.
 *
 * 역할만으로는 무엇을 물을지 정해지지 않는다("밀린 일" 인지 "오늘 일정" 인지). 그래서
 * 역할 + 문장 + 시각이 한 벌이다.
 *
 * 결과는 **개인에게** 간다. 워크스페이스 단위로 보내면 팀 전원이 매일 아침 같은 푸시를
 * 받게 되고, 그건 알림이 아니라 소음이다.
 */
@Entity
@Table(name = "ai_schedule")
public class AiSchedule {

    /** 매일. 요일 목록 대신 쓰는 값 — 가장 흔한 설정이라 따로 둔다. */
    public static final String DAILY = "DAILY";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "workspace_id", nullable = false)
    private Long workspaceId;

    @Column(name = "user_email", nullable = false, length = 120)
    private String userEmail;

    /** 내장 역할 id 또는 "custom:N". */
    @Column(name = "agent_id", nullable = false, length = 64)
    private String agentId;

    @Column(nullable = false, length = 300)
    private String prompt;

    /* 컬럼 이름에 hour/minute 를 그대로 못 쓴다 — SQL 예약어라 문법 오류가 난다.
       (H2·PostgreSQL 양쪽에서 깨졌다) 따옴표로 감싸는 대신 이름을 바꾼다. */
    @Column(name = "run_hour", nullable = false)
    private short runHour;

    @Column(name = "run_minute", nullable = false)
    private short runMinute;

    /** "DAILY" 또는 "MON,TUE,..." */
    @Column(nullable = false, length = 32)
    private String days = DAILY;

    @Column(nullable = false)
    private boolean enabled = true;

    /**
     * 마지막 실행 시각 — 기록이자 **잠금**이다.
     * 조건부 UPDATE 로 이 값을 집은 인스턴스만 실행한다. 자세한 사정은 마이그레이션 주석에.
     */
    @Column(name = "last_run_at")
    private LocalDateTime lastRunAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    protected AiSchedule() {}

    public AiSchedule(Long workspaceId, String userEmail) {
        this.workspaceId = workspaceId;
        this.userEmail = userEmail;
        this.createdAt = LocalDateTime.now();
    }

    public void apply(String agentId, String prompt, int hour, int minute, String days, boolean enabled) {
        this.agentId = agentId;
        this.prompt = prompt;
        this.runHour = (short) hour;
        this.runMinute = (short) minute;
        this.days = days;
        this.enabled = enabled;
        this.updatedAt = LocalDateTime.now();
    }

    /**
     * 이 요일에 도는가.
     *
     * 저장은 영어 약자(MON…)로 한다 — DayOfWeek.name() 앞 3글자와 그대로 맞아서 변환 표가
     * 필요 없고, 화면에 보일 한글은 클라이언트가 만든다. DB 에 한글을 넣으면 언어를 늘릴 때
     * 데이터를 고쳐야 한다.
     */
    public boolean runsOn(DayOfWeek day) {
        if (days == null || days.isBlank() || DAILY.equals(days)) return true;
        String token = day.name().substring(0, 3);
        for (String part : days.split(",")) {
            if (part.trim().equalsIgnoreCase(token)) return true;
        }
        return false;
    }

    public Long getId() { return id; }
    public Long getWorkspaceId() { return workspaceId; }
    public String getUserEmail() { return userEmail; }
    public String getAgentId() { return agentId; }
    public String getPrompt() { return prompt; }
    public short getHour() { return runHour; }
    public short getMinute() { return runMinute; }
    public String getDays() { return days; }
    public boolean isEnabled() { return enabled; }
    public LocalDateTime getLastRunAt() { return lastRunAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }

    /** 실행이 불가능해진 예약을 꺼둘 때(역할 삭제 등). */
    public void disable() {
        this.enabled = false;
        this.updatedAt = LocalDateTime.now();
    }

    /**
     * 실행 권리를 집은 뒤 메모리 쪽도 맞춘다.
     *
     * claim() 은 UPDATE 문으로 DB 만 바꾼다. 이 객체는 옛 값을 들고 있어서, 이대로 save()
     * 하면 방금 집은 표시가 **되돌아간다** — 잠금이 풀리는 셈이다.
     */
    public void markRan(LocalDateTime at) {
        this.lastRunAt = at;
    }
}
