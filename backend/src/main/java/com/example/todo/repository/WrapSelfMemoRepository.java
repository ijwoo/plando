package com.example.todo.repository;

import com.example.todo.entity.User;
import com.example.todo.entity.WrapSelfMemo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Optional;

public interface WrapSelfMemoRepository extends JpaRepository<WrapSelfMemo, Long> {
    Optional<WrapSelfMemo> findByUserAndWeekStart(User user, LocalDate weekStart);

    // 회원 탈퇴 시: 본인만 보는 회고 메모라 남길 이유가 없다
    @Modifying
    @Query("DELETE FROM WrapSelfMemo m WHERE m.user.id = :userId")
    void deleteByUserId(@Param("userId") Long userId);
}
