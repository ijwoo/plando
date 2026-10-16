package com.example.todo.repository;

import com.example.todo.entity.RecruitmentQuestion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface RecruitmentQuestionRepository extends JpaRepository<RecruitmentQuestion, Long> {

    /** 모집글의 공개 질문 목록: 핀 고정 우선 → 최신순 */
    @Query("SELECT q FROM RecruitmentQuestion q " +
            "WHERE q.recruitment.id = :recruitmentId AND q.hidden = false " +
            "ORDER BY q.pinned DESC, q.createdAt DESC")
    List<RecruitmentQuestion> findVisibleByRecruitmentId(@Param("recruitmentId") Long recruitmentId);

    /** 미답변 질문 수 (작성자 카드 배지용) */
    @Query("SELECT COUNT(q) FROM RecruitmentQuestion q " +
            "WHERE q.recruitment.id = :recruitmentId AND q.hidden = false AND q.answer IS NULL")
    long countUnansweredByRecruitmentId(@Param("recruitmentId") Long recruitmentId);

    /** 공개 질문 총 수 (탭 배지용) */
    long countByRecruitmentIdAndHiddenFalse(Long recruitmentId);

    /** 작성자별 통계 — 본인이 만든 모집글에 달린 비숨김 질문 전체 */
    @Query("SELECT q FROM RecruitmentQuestion q " +
            "WHERE q.recruitment.author.id = :authorId AND q.hidden = false")
    List<RecruitmentQuestion> findVisibleByRecruitmentAuthorId(@Param("authorId") Long authorId);

    /** 작성자별 통계 — 비숨김 질문 총 수 (qa-stats 분모) */
    long countByRecruitmentAuthorIdAndHiddenFalse(Long authorId);
}
