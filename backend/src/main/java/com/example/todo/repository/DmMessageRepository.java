package com.example.todo.repository;

import com.example.todo.entity.DmMessage;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface DmMessageRepository extends JpaRepository<DmMessage, Long> {

    List<DmMessage> findByRoomIdOrderBySentAtAsc(Long roomId);

    List<DmMessage> findByRoomIdOrderBySentAtDesc(Long roomId, Pageable pageable);

    // 페이지네이션 — 최신 N (cursor 없을 때)
    List<DmMessage> findByRoomIdOrderByIdDesc(Long roomId, Pageable pageable);

    // 페이지네이션 cursor — 특정 id 이전(더 오래된) 최신순 N
    List<DmMessage> findByRoomIdAndIdLessThanOrderByIdDesc(Long roomId, Long id, Pageable pageable);

    // 대화 내 검색 — 내용 부분일치(대소문자 무시) 최신순
    List<DmMessage> findByRoomIdAndContentContainingIgnoreCaseOrderByIdDesc(Long roomId, String content, Pageable pageable);

    @Modifying
    @Query("UPDATE DmMessage m SET m.readAt = CURRENT_TIMESTAMP " +
           "WHERE m.room.id = :roomId AND m.sender.id != :userId AND m.readAt IS NULL")
    int markAsRead(@Param("roomId") Long roomId, @Param("userId") Long userId);

    @Query("SELECT COUNT(m) FROM DmMessage m WHERE m.room.id = :roomId " +
           "AND m.sender.id != :userId AND m.readAt IS NULL")
    long countUnread(@Param("roomId") Long roomId, @Param("userId") Long userId);

    // per-user 안읽음 — lastReadAt(after) 이후 내가 보내지 않은 메시지 수
    @Query("SELECT COUNT(m) FROM DmMessage m WHERE m.room.id = :roomId " +
           "AND m.sender.id <> :userId AND m.sentAt > :after")
    long countUnreadAfter(@Param("roomId") Long roomId, @Param("userId") Long userId, @Param("after") java.time.LocalDateTime after);

    // 방의 공유 파일 (최근 순)
    @Query("SELECT m FROM DmMessage m WHERE m.room.id = :roomId AND m.fileUrl IS NOT NULL ORDER BY m.sentAt DESC")
    List<DmMessage> findFilesByRoomId(@Param("roomId") Long roomId, Pageable pageable);

    // AI 할 일 제안용 대화 맥락 — "이름: 내용" 문자열 프로젝션(지연로딩 안전, 최신순)
    @Query("SELECT CONCAT(m.sender.name, ': ', COALESCE(m.content, '[파일]')) FROM DmMessage m " +
           "WHERE m.room.id = :roomId ORDER BY m.id DESC")
    List<String> findRecentLines(@Param("roomId") Long roomId, Pageable pageable);

    @Query("SELECT m FROM DmMessage m WHERE m.sender.id = :userId ORDER BY m.sentAt DESC")
    List<DmMessage> findTopBySenderOrderBySentAtDesc(@Param("userId") Long userId, Pageable pageable);

    @Modifying
    @Query("DELETE FROM DmMessage m WHERE m.room.id IN (SELECT r.id FROM DmRoom r WHERE r.workspace.id = :workspaceId)")
    void deleteByWorkspaceId(@Param("workspaceId") Long workspaceId);

    @Modifying
    @Query("DELETE FROM DmMessage m WHERE m.sender.email IN :emails AND m.sentAt < :threshold")
    void deleteGuestMessagesOlderThan(@Param("emails") List<String> emails, @Param("threshold") LocalDateTime threshold);

    /** 시간 제한 없이 일괄 삭제 — 로그인 시 cleanup용 */
    @Modifying
    @Query("DELETE FROM DmMessage m WHERE m.sender.email IN :emails")
    void deleteAllBySenderEmails(@Param("emails") List<String> emails);

    @Query("""
            SELECT m FROM DmMessage m
            WHERE m.room IN (
                SELECT r FROM DmRoom r JOIN r.participants p
                WHERE p.id = :userId AND r.workspace.id = :workspaceId
            )
            AND lower(m.content) LIKE lower(concat('%', :keyword, '%'))
            ORDER BY m.sentAt DESC
            """)
    List<DmMessage> searchByContent(
            @Param("userId") Long userId,
            @Param("workspaceId") Long workspaceId,
            @Param("keyword") String keyword
    );
}
