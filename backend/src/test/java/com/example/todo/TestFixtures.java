package com.example.todo;

import com.example.todo.entity.Tag;
import com.example.todo.entity.Todo;
import com.example.todo.entity.Priority;
import com.example.todo.entity.User;
import com.example.todo.entity.Workspace;
import com.example.todo.entity.WorkspaceMember;
import com.example.todo.entity.WorkspaceRole;
import com.example.todo.repository.TagRepository;
import com.example.todo.repository.TodoRepository;
import com.example.todo.repository.TodoTagRepository;
import com.example.todo.repository.UserRepository;
import com.example.todo.repository.WorkspaceMemberRepository;
import com.example.todo.repository.WorkspaceRepository;
import com.example.todo.security.JwtTokenProvider;
import com.example.todo.service.WorkflowStatusService;
import com.example.todo.util.InviteCodeGenerator;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 통합 테스트용 픽스처.
 *
 * 실제 리포지토리로만 만든다 — 엔티티 불변식(워크스페이스 멤버십, 기본 상태 시드, 초대코드
 * 유일성)이 프로덕션과 같은 경로로 성립해야 테스트가 진짜 결함을 재현한다.
 *
 * 인증은 실제 {@link JwtTokenProvider} 로 발급한 Bearer 토큰을 쓴다. @WithMockUser 로
 * SecurityContext 를 직접 심으면 JwtAuthenticationFilter(탈퇴 계정 차단 등)를 건너뛰게 되고,
 * 오늘 잡은 결함들은 대부분 그 필터 뒤의 실제 경로에 있었다.
 */
@Component
public class TestFixtures {

    // 테스트 소스셋에는 Lombok 이 붙어 있지 않다(build.gradle 은 main 에만 적용).
    // 공유 설정을 건드리지 않으려고 필드 주입을 쓴다.
    @Autowired private UserRepository userRepository;
    @Autowired private WorkspaceRepository workspaceRepository;
    @Autowired private WorkspaceMemberRepository workspaceMemberRepository;
    @Autowired private TodoRepository todoRepository;
    @Autowired private TagRepository tagRepository;
    @Autowired private TodoTagRepository todoTagRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtTokenProvider jwtTokenProvider;
    @Autowired private WorkflowStatusService workflowStatusService;

    private static final AtomicLong SEQ = new AtomicLong();

    public String uniqueEmail(String prefix) {
        return prefix + SEQ.incrementAndGet() + "@plando.test";
    }

    /** 이메일 인증까지 끝난 일반 사용자. */
    public User user(String prefix) {
        User u = new User();
        u.setEmail(uniqueEmail(prefix));
        u.setName(prefix);
        u.setPassword(passwordEncoder.encode("password123"));
        u.setEmailVerifiedAt(LocalDateTime.now());
        return userRepository.save(u);
    }

    /** owner 를 OWNER 로 갖는 워크스페이스 + 기본 상태(TODO/IN_PROGRESS/DONE) 시드. */
    public Workspace workspace(String name, User owner) {
        Workspace ws = workspaceRepository.save(Workspace.builder()
                .name(name)
                .inviteCode(uniqueInviteCode())
                .build());
        member(ws, owner, WorkspaceRole.OWNER);
        workflowStatusService.seedDefaults(ws);
        return ws;
    }

    public WorkspaceMember member(Workspace ws, User user, WorkspaceRole role) {
        return workspaceMemberRepository.save(WorkspaceMember.builder()
                .workspace(ws).user(user).role(role).build());
    }

    public Todo todo(Workspace ws, User creator, String title) {
        return saveTodo(ws, creator, title, false);
    }

    /**
     * 샘플 할 일. POST /api/todos 는 항상 isSample=false 로 만들기 때문에 HTTP 로는
     * 만들 수 없다(온보딩 시드 전용 플래그). 리포지토리로 직접 세운다.
     */
    public Todo sampleTodo(Workspace ws, User creator, String title) {
        return saveTodo(ws, creator, title, true);
    }

    private Todo saveTodo(Workspace ws, User creator, String title, boolean sample) {
        return todoRepository.save(Todo.builder()
                .title(title)
                .status("TODO")
                .priority(Priority.MEDIUM)
                .workspace(ws)
                .createdBy(creator)
                .isSample(sample)
                .archived(false)
                .build());
    }

    public Tag tag(Workspace ws, String name, User creator) {
        return tagRepository.save(Tag.builder()
                .name(name).color("#FF0000").workspace(ws).createdBy(creator).build());
    }

    public void attachTag(Todo todo, Tag tag) {
        todoTagRepository.save(com.example.todo.entity.TodoTag.builder()
                .todoId(todo.getId()).tagId(tag.getId()).build());
    }

    public String bearer(User user) {
        return "Bearer " + jwtTokenProvider.createToken(user.getEmail());
    }

    private String uniqueInviteCode() {
        String code;
        do {
            code = InviteCodeGenerator.generate();
        } while (workspaceRepository.existsByInviteCode(code));
        return code;
    }
}
