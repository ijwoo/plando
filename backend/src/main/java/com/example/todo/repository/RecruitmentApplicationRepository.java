package com.example.todo.repository;

import com.example.todo.entity.Recruitment;
import com.example.todo.entity.RecruitmentApplication;
import com.example.todo.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface RecruitmentApplicationRepository extends JpaRepository<RecruitmentApplication, Long> {

    Optional<RecruitmentApplication> findByRecruitmentAndApplicant(Recruitment recruitment, User applicant);

    List<RecruitmentApplication> findByApplicantOrderByAppliedAtDesc(User applicant);

    List<RecruitmentApplication> findByRecruitmentAndStatusNotOrderByAppliedAtDesc(Recruitment recruitment, String excludeStatus);

    long countByRecruitmentAndStatus(Recruitment recruitment, String status);

    /** 특정 사용자가 모집글 목록에 지원한 상태를 한 번에 조회 (N+1 방지) */
    @Query("SELECT a FROM RecruitmentApplication a WHERE a.applicant = :user AND a.status != 'CANCELLED'")
    List<RecruitmentApplication> findActiveByApplicant(@Param("user") User user);
}
