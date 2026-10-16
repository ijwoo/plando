package com.example.todo.repository;

import com.example.todo.entity.DmTodoSuggestion;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface DmTodoSuggestionRepository extends JpaRepository<DmTodoSuggestion, Long> {

    List<DmTodoSuggestion> findByRoomIdAndStatusOrderByIdDesc(Long roomId, String status);

    /** 방별 대기 제안 수 — [roomId, count] 행 목록 (방 목록 ✨ 뱃지용) */
    @Query("SELECT s.roomId, COUNT(s) FROM DmTodoSuggestion s " +
           "WHERE s.roomId IN :roomIds AND s.status = 'PENDING' GROUP BY s.roomId")
    List<Object[]> countPendingByRoomIds(@Param("roomIds") List<Long> roomIds);

    boolean existsByMessageId(Long messageId);

    /** 방당 제안 도배 방지용 — 최근 N시간 내 생성 수 */
    long countByRoomIdAndCreatedAtAfter(Long roomId, LocalDateTime after);

    /** 회원 탈퇴 시: 본인에게만 보이는 할 일 제안이라 남길 이유가 없다. */
    @Modifying
    @Query("DELETE FROM DmTodoSuggestion s WHERE s.ownerEmail = :email")
    void deleteByOwnerEmail(@Param("email") String email);
}
