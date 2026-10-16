package com.example.todo.repository;

import com.example.todo.entity.Recruitment;
import com.example.todo.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface RecruitmentRepository extends JpaRepository<Recruitment, Long> {

    /** 전체 목록 (최신순) */
    List<Recruitment> findAllByOrderByIdDesc();

    /** 내가 만든 모집 */
    List<Recruitment> findByAuthorOrderByIdDesc(User author);

    /** 키워드 검색 */
    @Query("SELECT r FROM Recruitment r WHERE " +
           "LOWER(r.title) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "LOWER(r.summary) LIKE LOWER(CONCAT('%', :keyword, '%'))")
    List<Recruitment> searchByKeyword(@Param("keyword") String keyword);

    /** 상태별 */
    List<Recruitment> findByStatusOrderByIdDesc(String status);

    /** 특정 워크스페이스에 모집글이 있는지 확인 */
    boolean existsByWorkspaceId(Long workspaceId);

    /** 특정 워크스페이스의 모집글 목록 */
    List<Recruitment> findByWorkspaceId(Long workspaceId);
}
