package com.example.llm.demo;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 데모 전용 공유 자원 보호 — IP당 레이트리밋 + 전역 일일예산 킬스위치.
 *
 * 전역 필터/인터셉터가 아니라 데모 컨트롤러에서만 호출된다(다른 라우트 무영향).
 * 인메모리(단일 프로세스) — 데모 용도로 충분. 재시작 시 리셋.
 */
@Slf4j
@Component
public class DemoRateLimiter {

    public enum Verdict { OK, RATE_LIMITED, BUDGET_EXCEEDED }

    @Value("${demo.assistant.rate-per-minute:5}")
    private int perMinute;
    @Value("${demo.assistant.rate-per-day:50}")
    private int perDay;
    /** 전역 일일 호출 상한(킬스위치). 실서비스와 무관하게 데모만 차단. */
    @Value("${demo.assistant.daily-budget:500}")
    private int dailyBudget;

    private final ConcurrentHashMap<String, Bucket> minute = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Bucket> day = new ConcurrentHashMap<>();

    // 전역 일일예산
    private final AtomicLong budgetDayEpoch = new AtomicLong(epochDay());
    private final AtomicInteger budgetCount = new AtomicInteger(0);

    /** 호출 허용 여부 판정 + 허용 시 카운트 증가(원자적). */
    public synchronized Verdict check(String ip) {
        rollBudgetIfNewDay();
        if (budgetCount.get() >= dailyBudget) {
            return Verdict.BUDGET_EXCEEDED;
        }
        long nowMin = Instant.now().truncatedTo(ChronoUnit.MINUTES).getEpochSecond();
        long today = epochDay();
        String key = ip == null ? "unknown" : ip;

        Bucket mb = minute.compute(key, (k, b) -> (b == null || b.window != nowMin) ? new Bucket(nowMin) : b);
        Bucket db = day.compute(key, (k, b) -> (b == null || b.window != today) ? new Bucket(today) : b);

        if (mb.count >= perMinute) return Verdict.RATE_LIMITED;
        if (db.count >= perDay) return Verdict.RATE_LIMITED;

        mb.count++;
        db.count++;
        budgetCount.incrementAndGet();

        if (minute.size() > 10_000) minute.clear(); // 메모리 상한(러프)
        if (day.size() > 10_000) day.clear();
        return Verdict.OK;
    }

    private void rollBudgetIfNewDay() {
        long today = epochDay();
        if (budgetDayEpoch.get() != today) {
            budgetDayEpoch.set(today);
            budgetCount.set(0);
        }
    }

    private static long epochDay() {
        return Instant.now().getEpochSecond() / 86_400L;
    }

    private static final class Bucket {
        final long window;
        int count;
        Bucket(long window) { this.window = window; }
    }
}
