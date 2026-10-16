package com.example.todo.repository;

import com.example.todo.entity.DmRoom;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface DmRoomRepository extends JpaRepository<DmRoom, Long> {

    // 워크스페이스의 그룹 방 전체 — 동일 참여자 집합의 방이 이미 있는지 판별해 재사용하기 위한 조회.
    // (그룹 생성에 중복 방지가 없어 같은 멤버 구성의 방이 계속 새로 만들어지고 대화가 쪼개졌다)
    // 참여자를 즉시 함께 읽어 방마다 추가 쿼리가 나가지 않도록 fetch join. id 오름차순 = 가장 오래된 방을 결정적으로 선택.
    @Query("SELECT DISTINCT r FROM DmRoom r LEFT JOIN FETCH r.participants " +
           "WHERE r.workspace.id = :workspaceId AND r.isGroup = true ORDER BY r.id ASC")
    List<DmRoom> findGroupRoomsWithParticipants(@Param("workspaceId") Long workspaceId);

    @Query("SELECT r FROM DmRoom r JOIN r.participants p WHERE p.id = :userId AND r.workspace.id = :workspaceId ORDER BY r.lastMessageAt DESC NULLS LAST")
    List<DmRoom> findAllByParticipantIdAndWorkspaceId(@Param("userId") Long userId, @Param("workspaceId") Long workspaceId);

    // 동일 사용자 쌍에 1:1 방이 중복 생성돼 있을 수 있어(동시 요청 시 조회→생성 사이 경쟁)
    // 단일 결과(Optional)로 받으면 NonUniqueResult로 터진다. List + id 오름차순으로 받아
    // 가장 오래된 방을 결정적으로 선택한다.
    @Query("SELECT r FROM DmRoom r JOIN r.participants p1 JOIN r.participants p2 " +
           "WHERE p1.id = :userId1 AND p2.id = :userId2 AND r.workspace.id = :workspaceId " +
           "AND (SELECT COUNT(p) FROM r.participants p) = 2 " +
           "ORDER BY r.id ASC")
    List<DmRoom> findRoomsBetween(@Param("userId1") Long userId1, @Param("userId2") Long userId2, @Param("workspaceId") Long workspaceId);

    @Query("SELECT r FROM DmRoom r WHERE r.workspace.id = :workspaceId")
    List<DmRoom> findAllByWorkspaceId(@Param("workspaceId") Long workspaceId);

    /** 게스트가 참여한 모든 DM 방 멤버십을 제거 — cleanup용 (m2m 테이블 직접 조작) */
    @Modifying
    @Query(value = """
        DELETE FROM todo.dm_room_members
        WHERE user_id IN (SELECT id FROM todo.users WHERE email IN :emails)
        """, nativeQuery = true)
    void removeGuestParticipants(@Param("emails") List<String> emails);

    /** 참여자 0명 + 메시지 0개인 고아 방 삭제 — cleanup 마무리용 */
    @Modifying
    @Query(value = """
        DELETE FROM todo.dm_rooms r
        WHERE NOT EXISTS (SELECT 1 FROM todo.dm_room_members m WHERE m.room_id = r.id)
          AND NOT EXISTS (SELECT 1 FROM todo.dm_messages msg WHERE msg.room_id = r.id)
        """, nativeQuery = true)
    void deleteEmptyRooms();
}
