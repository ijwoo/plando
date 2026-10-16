package com.example.todo.repository;

import com.example.todo.entity.ApnsToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ApnsTokenRepository extends JpaRepository<ApnsToken, Long> {

    List<ApnsToken> findByUserEmail(String userEmail);

    Optional<ApnsToken> findByDeviceToken(String deviceToken);

    void deleteByDeviceToken(String deviceToken);

    /**
     * 회원 탈퇴 시 반드시 지운다.
     * 이 테이블은 user_email 문자열로만 연결돼 있어서, 탈퇴로 이메일을 익명화해도
     * 여기 남은 행은 **원래 이메일**을 그대로 들고 있다. 그 주소로 누군가 새로 가입하면
     * 탈퇴한 사람의 기기 토큰을 물려받아 그 사람의 푸시를 받게 된다.
     */
    void deleteByUserEmail(String userEmail);
}
