package com.example.todo.repository;

import com.example.todo.entity.PushSubscription;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PushSubscriptionRepository extends JpaRepository<PushSubscription, Long> {

    List<PushSubscription> findByUserEmail(String userEmail);

    Optional<PushSubscription> findByEndpoint(String endpoint);

    void deleteByEndpoint(String endpoint);

    /** 회원 탈퇴 시 반드시 지운다 — 이유는 {@link ApnsTokenRepository#deleteByUserEmail}과 같다(웹 푸시 버전). */
    void deleteByUserEmail(String userEmail);
}
