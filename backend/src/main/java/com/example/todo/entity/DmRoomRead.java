package com.example.todo.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * DM 방 참여자별 "마지막으로 읽은 시각".
 * 그룹 DM에서 메시지당 단일 readAt으로는 per-user 읽음/안읽음을 표현할 수 없어
 * (방, 사용자) 단위 마지막 읽음 시각으로 추적한다.
 *  - unread = 해당 방에서 sentAt > lastReadAt 이고 내가 보낸 게 아닌 메시지 수
 *  - "읽음" = 그 메시지의 수신자(보낸이 제외 참여자) 모두의 lastReadAt >= sentAt
 */
@Entity
@Table(
        name = "dm_room_read",
        schema = "todo",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_dm_room_read",
                columnNames = {"room_id", "user_id"}
        ),
        indexes = {
                @Index(name = "idx_dm_room_read_room", columnList = "room_id")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DmRoomRead {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "room_id", nullable = false)
    private Long roomId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "last_read_at", nullable = false)
    private LocalDateTime lastReadAt;
}
