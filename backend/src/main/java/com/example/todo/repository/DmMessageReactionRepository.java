package com.example.todo.repository;

import com.example.todo.entity.DmMessageReaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface DmMessageReactionRepository extends JpaRepository<DmMessageReaction, Long> {

    Optional<DmMessageReaction> findByMessageIdAndUserIdAndEmoji(Long messageId, Long userId, String emoji);

    List<DmMessageReaction> findByMessageIdIn(Collection<Long> messageIds);

    @Modifying
    @Query("DELETE FROM DmMessageReaction r WHERE r.messageId = :messageId AND r.userId = :userId AND r.emoji = :emoji")
    void deleteByMessageIdAndUserIdAndEmoji(@Param("messageId") Long messageId, @Param("userId") Long userId, @Param("emoji") String emoji);

    @Modifying
    @Query("DELETE FROM DmMessageReaction r WHERE r.messageId = :messageId")
    void deleteByMessageId(@Param("messageId") Long messageId);

    @Modifying
    @Query("DELETE FROM DmMessageReaction r WHERE r.userId = :userId")
    void deleteByUserId(@Param("userId") Long userId);
}
