package com.example.todo.repository;

import com.example.todo.entity.Recruitment;
import com.example.todo.entity.RecruitmentBookmark;
import com.example.todo.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface RecruitmentBookmarkRepository extends JpaRepository<RecruitmentBookmark, Long> {

    Optional<RecruitmentBookmark> findByRecruitmentAndUser(Recruitment recruitment, User user);

    boolean existsByRecruitmentAndUser(Recruitment recruitment, User user);

    @Query("SELECT b.recruitment FROM RecruitmentBookmark b WHERE b.user = :user ORDER BY b.id DESC")
    List<Recruitment> findBookmarkedRecruitmentsByUser(@Param("user") User user);

    // 회원 탈퇴 시: 북마크는 본인만 보는 것이라 남길 이유가 없다
    @Modifying
    @Query("DELETE FROM RecruitmentBookmark b WHERE b.user.id = :userId")
    void deleteByUserId(@Param("userId") Long userId);
}
