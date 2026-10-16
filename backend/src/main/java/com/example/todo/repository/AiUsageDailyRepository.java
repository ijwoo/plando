package com.example.todo.repository;

import com.example.todo.entity.AiUsageDaily;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Optional;

public interface AiUsageDailyRepository extends JpaRepository<AiUsageDaily, Long> {

    Optional<AiUsageDaily> findByUserIdAndUsageDate(Long userId, LocalDate usageDate);

    /** 백오피스 — 기간 합계(LLM 호출 수). */
    @org.springframework.data.jpa.repository.Query(
            "SELECT COALESCE(SUM(a.llmCalls), 0) FROM AiUsageDaily a WHERE a.usageDate >= :from")
    long sumCallsSince(@org.springframework.data.repository.query.Param("from") LocalDate from);

    /** 백오피스 — 날짜별 합계, 오래된 날부터. [usageDate, sum] */
    @org.springframework.data.jpa.repository.Query(
            "SELECT a.usageDate, SUM(a.llmCalls) FROM AiUsageDaily a WHERE a.usageDate >= :from " +
            "GROUP BY a.usageDate ORDER BY a.usageDate")
    java.util.List<Object[]> dailyCallsSince(@org.springframework.data.repository.query.Param("from") LocalDate from);
}
