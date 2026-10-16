package com.example.todo.repository;

import com.example.todo.entity.EmailVerificationToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Optional;

public interface EmailVerificationTokenRepository extends JpaRepository<EmailVerificationToken, Long> {

    Optional<EmailVerificationToken> findByToken(String token);

    /**
     * 재발송 시 이전 토큰을 무효화한다 — 살아 있는 링크가 여러 개 떠다니지 않게.
     *
     * @Transactional 이 여기 붙어 있는 이유: 호출하는 쪽(EmailVerificationService.issueToken)이
     * 같은 클래스 안에서 호출되기 때문에 그쪽 @Transactional 이 프록시를 타지 않는다.
     * 그래서 트랜잭션 없이 수정 쿼리가 실행돼 "Executing an update/delete query" 로 실패했고,
     * 인증 메일이 한 통도 나가지 않았다. 호출 위치와 무관하게 안전하도록 여기서 보장한다.
     */
    @Modifying
    @org.springframework.transaction.annotation.Transactional
    @Query("DELETE FROM EmailVerificationToken t WHERE t.user.id = :userId")
    void deleteByUserId(@Param("userId") Long userId);

    /** 재발송 남용 방지 — 최근 발송 여부 확인용. */
    @Query("SELECT COUNT(t) FROM EmailVerificationToken t WHERE t.user.id = :userId AND t.createdAt > :since")
    long countRecentByUserId(@Param("userId") Long userId, @Param("since") LocalDateTime since);
}
