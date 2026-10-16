package com.example.todo.repository;

import com.example.todo.entity.UserBlock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.Set;

public interface UserBlockRepository extends JpaRepository<UserBlock, Long> {

    Optional<UserBlock> findByBlockerIdAndBlockedId(Long blockerId, Long blockedId);

    List<UserBlock> findByBlockerIdOrderByCreatedAtDesc(Long blockerId);

    @Query("SELECT b.blockedId FROM UserBlock b WHERE b.blockerId = :blockerId")
    Set<Long> findBlockedIds(@Param("blockerId") Long blockerId);
}
