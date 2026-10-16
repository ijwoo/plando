package com.example.todo.repository;

import com.example.todo.entity.Project;
import com.example.todo.entity.TodoLog;
import com.example.todo.entity.Workspace;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface LogRepository extends JpaRepository<TodoLog, Long> {

    // 특정 Todo의 로그들 가져오기
    List<TodoLog> findByTodoIdOrderByModifiedAtDesc(Long todoId);

    // 워크스페이스 전체 최근 로그 (대시보드 활동 피드)
    @Query("""
        SELECT l FROM TodoLog l
        WHERE l.todoId IN (SELECT t.id FROM Todo t WHERE t.workspace = :workspace)
        ORDER BY l.modifiedAt DESC
    """)
    List<TodoLog> findRecentByWorkspace(@Param("workspace") Workspace workspace, Pageable pageable);

    // 프로젝트 소속 할 일들의 최근 로그 (프로젝트 개요 활동 피드)
    @Query("""
        SELECT l FROM TodoLog l
        WHERE l.todoId IN (SELECT t.id FROM Todo t WHERE t.project = :project)
        ORDER BY l.modifiedAt DESC
    """)
    List<TodoLog> findRecentByProject(@Param("project") Project project, Pageable pageable);

    /** 게스트가 만든 변경 로그 일괄 삭제 (cleanup용) */
    @Modifying
    @Query("DELETE FROM TodoLog l WHERE l.modifier IN :emails")
    void deleteAllByModifierEmails(@Param("emails") List<String> emails);

    /**
     * 회원 탈퇴 익명화. 변경 이력의 수행자(이메일만 저장).
     *
     * 이 컬럼은 users 를 이메일 문자열로만 참조한다(FK 없음). 게다가 이름은 **가입 당시 실명
     * 스냅샷**이라, users.name 을 익명화해도 여기 남아 상대 화면에 계속 실명이 보인다.
     * 이메일은 지우지 않고 익명화된 주소로 바꾼다 — 화면에서 이름을 다시 조회할 때
     * users 행을 찾아 '탈퇴한 사용자'로 표시되게 하려는 것이다(NULL 로 두면 표시가 깨진다).
     */
    @Modifying
    @Query("UPDATE TodoLog l SET l.modifier = :newEmail WHERE l.modifier = :oldEmail")
    void anonymizeByEmail(@Param("oldEmail") String oldEmail, @Param("newEmail") String newEmail);
}
