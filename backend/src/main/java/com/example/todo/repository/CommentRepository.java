package com.example.todo.repository;

import com.example.todo.entity.Comment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface CommentRepository extends JpaRepository<Comment, Long> {
    List<Comment> findByTodoIdOrderByCreatedAtAsc(Long todoId);

    @Modifying
    @Query("DELETE FROM Comment c WHERE c.writerEmail IN :emails AND c.createdAt < :threshold")
    void deleteGuestCommentsOlderThan(@Param("emails") List<String> emails, @Param("threshold") LocalDateTime threshold);

    /** 시간 제한 없이 일괄 삭제 — 로그인 시 cleanup용 */
    @Modifying
    @Query("DELETE FROM Comment c WHERE c.writerEmail IN :emails")
    void deleteAllByWriterEmails(@Param("emails") List<String> emails);

    /** 할 일 삭제 시 그 할 일의 코멘트 정리(고아 방지) */
    void deleteByTodoId(Long todoId);

    /**
     * 회원 탈퇴 익명화. 댓글 작성자.
     *
     * 이 컬럼은 users 를 이메일 문자열로만 참조한다(FK 없음). 게다가 이름은 **가입 당시 실명
     * 스냅샷**이라, users.name 을 익명화해도 여기 남아 상대 화면에 계속 실명이 보인다.
     * 이메일은 지우지 않고 익명화된 주소로 바꾼다 — 화면에서 이름을 다시 조회할 때
     * users 행을 찾아 '탈퇴한 사용자'로 표시되게 하려는 것이다(NULL 로 두면 표시가 깨진다).
     */
    @Modifying
    @Query("UPDATE Comment c SET c.writerEmail = :newEmail, c.writerName = '탈퇴한 사용자' WHERE c.writerEmail = :oldEmail")
    void anonymizeByEmail(@Param("oldEmail") String oldEmail, @Param("newEmail") String newEmail);
}
