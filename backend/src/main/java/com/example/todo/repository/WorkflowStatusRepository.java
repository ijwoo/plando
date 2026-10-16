package com.example.todo.repository;

import com.example.todo.entity.WorkflowStatus;
import com.example.todo.entity.Workspace;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WorkflowStatusRepository extends JpaRepository<WorkflowStatus, Long> {

    List<WorkflowStatus> findByWorkspaceOrderBySortOrderAsc(Workspace workspace);

    List<WorkflowStatus> findByWorkspace(Workspace workspace);

    Optional<WorkflowStatus> findByWorkspaceAndStatusKey(Workspace workspace, String statusKey);

    Optional<WorkflowStatus> findByIdAndWorkspace(Long id, Workspace workspace);

    boolean existsByWorkspace(Workspace workspace);

    long countByWorkspace(Workspace workspace);
}
