package com.example.todo.service;

import com.example.todo.entity.User;
import com.example.todo.entity.Workspace;
import com.example.todo.entity.WorkspaceMember;
import com.example.todo.entity.WorkspaceRole;
import com.example.todo.exception.ApiException;
import com.example.todo.repository.UserRepository;
import com.example.todo.repository.WorkspaceMemberRepository;
import com.example.todo.repository.WorkspaceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class WorkspaceResolver {

    private final UserRepository userRepository;
    private final WorkspaceRepository workspaceRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;

    public Workspace resolve(String userEmail, Long workspaceId) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ApiException(404, "사용자를 찾을 수 없습니다."));

        if (workspaceId != null) {
            Workspace workspace = workspaceRepository.findById(workspaceId)
                    .orElseThrow(() -> new ApiException(404, "워크스페이스를 찾을 수 없습니다."));

            boolean isMember = workspaceMemberRepository.existsByWorkspaceAndUser(workspace, user);
            if (!isMember) {
                throw new ApiException(403, "해당 워크스페이스에 접근 권한이 없습니다.");
            }
            return workspace;
        }

        return workspaceMemberRepository.findFirstByUserAndRoleOrderByIdAsc(user, WorkspaceRole.OWNER)
                .map(WorkspaceMember::getWorkspace)
                .or(() -> workspaceMemberRepository.findFirstByUserOrderByIdAsc(user)
                        .map(WorkspaceMember::getWorkspace))
                .orElseThrow(() -> new ApiException(404, "소속 워크스페이스가 없습니다."));
    }

    public User getUser(String userEmail) {
        return userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ApiException(404, "사용자를 찾을 수 없습니다."));
    }
}