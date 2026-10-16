package com.example.todo.service;

import com.example.todo.entity.Priority;
import com.example.todo.entity.Todo;
import com.example.todo.entity.User;
import com.example.todo.entity.Workspace;
import com.example.todo.entity.WorkspaceMember;
import com.example.todo.entity.WorkspaceRole;
import com.example.todo.repository.TodoRepository;
import com.example.todo.repository.WorkspaceMemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class TodoSampleService {

    private final TodoRepository todoRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;

    @Transactional
    public void createOnboardingSampleTodos(User user) {
        createOnboardingSampleTodos(user, getDefaultWorkspaceOrThrow(user));
    }

    @Transactional
    public void createOnboardingSampleTodos(User user, Workspace workspace) {
        LocalDate today = LocalDate.now();

        todoRepository.save(makeTodo(
                workspace,
                user,
                "첫 작업 드래그해보기",
                "이 카드를 드래그해서 상태를 바꿔보세요.",
                "TODO",
                today,
                today.plusDays(1),
                Priority.HIGH,
                true
        ));

        todoRepository.save(makeTodo(
                workspace,
                user,
                "캘린더에서 일정 확인하기",
                "캘린더 페이지에서 일정 클릭과 이동을 확인해보세요.",
                "IN_PROGRESS",
                today,
                today.plusDays(2),
                Priority.MEDIUM,
                true
        ));

        todoRepository.save(makeTodo(
                workspace,
                user,
                "회원가입 완료",
                "이 작업은 완료된 예시 카드입니다.",
                "DONE",
                today.minusDays(1),
                today.minusDays(1),
                Priority.LOW,
                true
        ));
    }

    @Transactional
    public void deleteSampleTodos(User user, Workspace workspace) {
        todoRepository.deleteByWorkspaceAndCreatedByEmailAndIsSampleTrue(workspace, user.getEmail());
    }

    @Transactional
    public void recreateSampleTodos(User user, Workspace workspace) {
        todoRepository.deleteByWorkspaceAndCreatedByEmailAndIsSampleTrue(workspace, user.getEmail());
        createOnboardingSampleTodos(user, workspace);
    }

    @Transactional(readOnly = true)
    public boolean hasSampleTodos(User user, Workspace workspace) {
        return todoRepository.existsByWorkspaceAndCreatedByEmailAndIsSampleTrue(workspace, user.getEmail());
    }

    private Todo makeTodo(
            Workspace workspace,
            User createdBy,
            String title,
            String content,
            String status,
            LocalDate startAt,
            LocalDate dueDate,
            Priority priority,
            boolean isSample
    ) {
        Todo todo = new Todo();
        todo.setWorkspace(workspace);
        todo.setCreatedBy(createdBy);
        todo.setTitle(title);
        todo.setContent(content);
        todo.applyStatus(status, "DONE".equals(status));
        todo.setStartAt(startAt);
        todo.setDueDate(dueDate);
        todo.setPriority(priority);
        todo.setIsSample(isSample);
        return todo;
    }

    /**
     * 워크스페이스를 안 받는 경로(온보딩)에서만 쓰는 기본 워크스페이스 추정.
     * 초대 코드로만 들어와 소유 워크스페이스가 없는 사용자는 **남의 워크스페이스**가 잡히므로,
     * API 진입점에서는 이걸 쓰지 말고 X-Workspace-Id 로 해석한 워크스페이스를 넘길 것.
     */
    private Workspace getDefaultWorkspaceOrThrow(User user) {
        Optional<WorkspaceMember> ownerWorkspace =
                workspaceMemberRepository.findFirstByUserAndRoleOrderByIdAsc(user, WorkspaceRole.OWNER);

        if (ownerWorkspace.isPresent()) {
            return ownerWorkspace.get().getWorkspace();
        }

        return workspaceMemberRepository.findFirstByUserOrderByIdAsc(user)
                .map(WorkspaceMember::getWorkspace)
                .orElseThrow(() -> new IllegalArgumentException("소속 워크스페이스가 없습니다."));
    }
}