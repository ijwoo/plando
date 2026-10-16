package com.example.todo.repository;

import com.example.todo.entity.User;
import com.example.todo.entity.WrapCommentCache;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Optional;

public interface WrapCommentCacheRepository extends JpaRepository<WrapCommentCache, Long> {

    Optional<WrapCommentCache> findByUserAndWeekStartAndPersona(User user, LocalDate weekStart, String persona);

    // 회원 탈퇴 시: 본인 통계로 만든 AI 문장 캐시라 남길 이유가 없다.
    // 실측상 탈퇴를 가장 많이 막던 참조 중 하나였다(주간 회고를 한 번 보면 생긴다).
    @Modifying
    @Query("DELETE FROM WrapCommentCache c WHERE c.user.id = :userId")
    void deleteByUserId(@Param("userId") Long userId);
}
