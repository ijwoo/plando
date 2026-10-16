package com.example.todo.repository;

import com.example.todo.entity.Recruitment;
import com.example.todo.entity.RecruitmentMember;
import com.example.todo.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RecruitmentMemberRepository extends JpaRepository<RecruitmentMember, Long> {

    Optional<RecruitmentMember> findByRecruitmentAndUser(Recruitment recruitment, User user);

    List<RecruitmentMember> findByRecruitment(Recruitment recruitment);
}
