package com.example.todo.repository;

import com.example.todo.entity.RecruitmentAnswer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface RecruitmentAnswerRepository extends JpaRepository<RecruitmentAnswer, Long> {

    Optional<RecruitmentAnswer> findByQuestionId(Long questionId);

    /**
     * 작성자별 통계 — 답변이 달린 (question.createdAt, answer.createdAt) 쌍.
     * 자바에서 Duration.between으로 평균 산출하면 DB 함수(TIMESTAMPDIFF) 의존이 없어
     * MySQL/H2 양쪽에서 동일하게 동작.
     */
    @Query("SELECT q.createdAt, a.createdAt " +
            "FROM RecruitmentAnswer a JOIN a.question q " +
            "WHERE q.recruitment.author.id = :authorId AND q.hidden = false")
    List<Object[]> findAnswerLatencyPairsByAuthorId(@Param("authorId") Long authorId);
}
