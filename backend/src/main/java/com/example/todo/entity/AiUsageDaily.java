package com.example.todo.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.LocalDate;

/**
 * 사용자별 하루 AI 호출량.
 *
 * **왜 DB 인가:** 메모리에 세면 배포할 때마다 0 으로 돌아간다. 이 프로젝트는 하루에도 여러 번
 * 배포하므로(오늘만 열 번 넘게) 메모리 카운터는 사실상 제한이 아니다. 제한이 있는 척하면서
 * 실제로는 안 막는 게 제일 나쁘다.
 *
 * **왜 요청이 아니라 LLM 호출을 세는가:** 다단계 루프가 생겨 요청 하나가 LLM 을 최대 5번 부른다.
 * 요청 수로 세면 실제 비용과 5배까지 어긋난다. 돈이 나가는 단위로 세야 한다.
 */
@Entity
@Table(
        name = "ai_usage_daily",
        uniqueConstraints = @UniqueConstraint(name = "uk_ai_usage_user_date", columnNames = {"user_id", "usage_date"})
)
public class AiUsageDaily {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** KST 기준 날짜. 사용자가 체감하는 "오늘"과 맞춘다. */
    @Column(name = "usage_date", nullable = false)
    private LocalDate usageDate;

    @Column(name = "llm_calls", nullable = false)
    private int llmCalls;

    protected AiUsageDaily() {}

    public AiUsageDaily(Long userId, LocalDate usageDate) {
        this.userId = userId;
        this.usageDate = usageDate;
        this.llmCalls = 0;
    }

    public void increment() {
        this.llmCalls++;
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public LocalDate getUsageDate() { return usageDate; }
    public int getLlmCalls() { return llmCalls; }
}
