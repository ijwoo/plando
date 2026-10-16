package com.example.todo.repository;

import com.example.todo.entity.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    List<Notification> findByReceiverEmailAndWorkspaceIdOrderByCreatedAtDesc(String receiverEmail, Long workspaceId);

    long countByReceiverEmailAndWorkspaceIdAndIsReadFalse(String receiverEmail, Long workspaceId);

    List<Notification> findByReceiverEmailAndWorkspaceIdAndIsReadFalseOrderByCreatedAtDesc(String receiverEmail, Long workspaceId);

    List<Notification> findByReceiverEmailAndTypeInOrderByCreatedAtDesc(String receiverEmail, List<String> types);

    List<Notification> findByReceiverEmailAndTypeInAndIsReadFalse(String receiverEmail, List<String> types);

    /** Dashboard PriorityStack용 — 워크스페이스 + 타입 필터. */
    List<Notification> findByReceiverEmailAndWorkspaceIdAndTypeInOrderByCreatedAtDesc(
            String receiverEmail, Long workspaceId, List<String> types);

    void deleteByReceiverEmail(String receiverEmail);

    void deleteByWorkspaceId(Long workspaceId);

    /** 게스트가 보낸 또는 받은 알림 일괄 삭제 — 로그인 시 cleanup용 (시간 제한 없음) */
    @Modifying
    @Query("DELETE FROM Notification n WHERE n.receiverEmail IN :emails OR n.senderEmail IN :emails")
    void deleteAllByGuestEmails(@Param("emails") List<String> emails);

    /**
     * 회원 탈퇴 익명화. 알림 발신자.
     *
     * 이 컬럼은 users 를 이메일 문자열로만 참조한다(FK 없음). 게다가 이름은 **가입 당시 실명
     * 스냅샷**이라, users.name 을 익명화해도 여기 남아 상대 화면에 계속 실명이 보인다.
     * 이메일은 지우지 않고 익명화된 주소로 바꾼다 — 화면에서 이름을 다시 조회할 때
     * users 행을 찾아 '탈퇴한 사용자'로 표시되게 하려는 것이다(NULL 로 두면 표시가 깨진다).
     */
    @Modifying
    @Query("UPDATE Notification n SET n.senderEmail = :newEmail WHERE n.senderEmail = :oldEmail")
    void anonymizeByEmail(@Param("oldEmail") String oldEmail, @Param("newEmail") String newEmail);
}
