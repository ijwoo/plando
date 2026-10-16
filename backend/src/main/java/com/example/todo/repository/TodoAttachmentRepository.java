package com.example.todo.repository;

import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import com.example.todo.entity.TodoAttachment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TodoAttachmentRepository extends JpaRepository<TodoAttachment, Long> {
    List<TodoAttachment> findByTodoIdOrderByCreatedAtAsc(Long todoId);

    /** 할 일 삭제 시 그 할 일의 첨부 레코드 정리(파일은 컨트롤러에서 먼저 삭제) */
    void deleteByTodoId(Long todoId);

    /**
     * 회원 탈퇴 익명화. 첨부 업로더.
     *
     * 이 컬럼은 users 를 이메일 문자열로만 참조한다(FK 없음). 게다가 이름은 **가입 당시 실명
     * 스냅샷**이라, users.name 을 익명화해도 여기 남아 상대 화면에 계속 실명이 보인다.
     * 이메일은 지우지 않고 익명화된 주소로 바꾼다 — 화면에서 이름을 다시 조회할 때
     * users 행을 찾아 '탈퇴한 사용자'로 표시되게 하려는 것이다(NULL 로 두면 표시가 깨진다).
     */
    @Modifying
    @Query("UPDATE TodoAttachment a SET a.uploaderEmail = :newEmail, a.uploaderName = '탈퇴한 사용자' WHERE a.uploaderEmail = :oldEmail")
    void anonymizeByEmail(@Param("oldEmail") String oldEmail, @Param("newEmail") String newEmail);
}
