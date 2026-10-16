package com.example.todo.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * DM 메시지 이모지 reaction. (messageId, userId, emoji) 조합이 unique — 같은 사용자가 같은 메시지에 같은 이모지를 두 번 누를 수 없음.
 * 같은 이모지 재클릭은 토글로 처리 (row 삭제).
 */
@Entity
@Table(
        name = "dm_message_reactions",
        schema = "todo",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_dm_reaction",
                columnNames = {"message_id", "user_id", "emoji"}
        ),
        indexes = {
                @Index(name = "idx_dm_reaction_message", columnList = "message_id")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DmMessageReaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "message_id", nullable = false)
    private Long messageId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** 이모지 문자 (예: "👍", "❤️"). 최대 20 (다중-codepoint 이모지 여유). */
    @Column(nullable = false, length = 20)
    private String emoji;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
