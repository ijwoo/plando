package com.example.todo.repository;

import com.example.todo.entity.ContentReport;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface ContentReportRepository extends JpaRepository<ContentReport, Long> {

    boolean existsByReporterIdAndTargetTypeAndTargetId(Long reporterId, ContentReport.TargetType targetType, Long targetId);

    long countByReporterIdAndCreatedAtAfter(Long reporterId, LocalDateTime after);

    long countByStatus(ContentReport.Status status);

    Page<ContentReport> findByStatusOrderByCreatedAtDesc(ContentReport.Status status, Pageable pageable);

    Page<ContentReport> findAllByOrderByCreatedAtDesc(Pageable pageable);

    /** 같은 대상의 대기 신고 — 하나를 처리하면 같은 대상의 나머지도 함께 닫는다. */
    List<ContentReport> findByTargetTypeAndTargetIdAndStatus(ContentReport.TargetType targetType, Long targetId,
                                                             ContentReport.Status status);

    @Query("SELECT COUNT(r) FROM ContentReport r WHERE r.targetUserId = :userId")
    long countAgainstUser(@Param("userId") Long userId);
}
