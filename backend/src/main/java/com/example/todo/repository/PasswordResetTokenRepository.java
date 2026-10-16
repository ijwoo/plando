package com.example.todo.repository;

import com.example.todo.entity.PasswordResetToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Long> {

    Optional<PasswordResetToken> findByToken(String token);

    /**
     * @Transactional 이 필요한 이유: 호출하는 PasswordResetService.saveResetToken 은
     * @Transactional 이 붙어 있지만 같은 클래스의 sendResetEmail 에서 호출돼 프록시를 타지 않는다.
     * 그래서 트랜잭션 없이 수정 쿼리가 실행되며 "Executing an update/delete query" 로 실패했다
     * (= 비밀번호 재설정 메일도 나가지 않고 있었다). 호출 위치와 무관하게 여기서 보장한다.
     */
    @Modifying
    @org.springframework.transaction.annotation.Transactional
    @Query("DELETE FROM PasswordResetToken t WHERE t.email = :email")
    void deleteAllByEmail(@Param("email") String email);

}
