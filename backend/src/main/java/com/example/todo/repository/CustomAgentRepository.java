package com.example.todo.repository;

import com.example.todo.entity.CustomAgent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CustomAgentRepository extends JpaRepository<CustomAgent, Long> {

    List<CustomAgent> findByWorkspaceIdOrderByIdAsc(Long workspaceId);

    /** 워크스페이스까지 함께 확인한다 — id 만으로 찾으면 남의 역할을 고치거나 지울 수 있다. */
    Optional<CustomAgent> findByIdAndWorkspaceId(Long id, Long workspaceId);

    long countByWorkspaceId(Long workspaceId);
}
