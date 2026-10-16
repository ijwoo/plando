package com.example.todo;

import com.example.todo.entity.EmailVerificationToken;
import com.example.todo.entity.User;
import com.example.todo.entity.Workspace;
import com.example.todo.entity.WorkspaceMember;
import com.example.todo.entity.WorkspaceRole;
import com.example.todo.repository.EmailVerificationTokenRepository;
import com.example.todo.repository.UserRepository;
import com.example.todo.repository.WorkspaceMemberRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 초대코드 가입이 이메일 인증을 우회하던 결함(commit 2c51743, 치명적).
 */
class SignupInviteCodeIntegrationTest extends IntegrationTestBase {

    @Autowired TestFixtures fx;
    @Autowired UserRepository userRepository;
    @Autowired WorkspaceMemberRepository workspaceMemberRepository;
    @Autowired EmailVerificationTokenRepository tokenRepository;

    @Test
    @DisplayName("초대코드로 가입해도 그 워크스페이스에 즉시 들어가지 않는다")
    void signupWithInviteCodeDoesNotJoinImmediately() throws Exception {
        /* [고정하는 결함] 가입 경로(UserService.registerUser)만 EmailVerificationGuard 를
           통과하지 않았다. 가입 시점의 사용자는 **항상 미인증**이라, 초대코드만 알면
           소유하지도 않은 남의 이메일로 그 팀에 즉시 MEMBER 로 들어갈 수 있었다.
           (정상 참여 경로 WorkspaceService.joinWorkspace 에는 가드가 있었다.)
           이제 코드는 users.pending_invite_code 에 **보관만** 하고, 본인 워크스페이스만
           OWNER 로 만들어 준다. 표적 워크스페이스 멤버십은 생기지 않아야 한다. */
        User targetOwner = fx.user("owner");
        Workspace target = fx.workspace("표적 팀", targetOwner);
        String inviteCode = target.getInviteCode();

        String email = fx.uniqueEmail("joiner");
        mvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "email", email,
                                "password", "password123",
                                "name", "가입자",
                                "inviteCode", inviteCode))))
                .andExpect(status().isOk());

        User created = userRepository.findByEmail(email).orElseThrow();

        // 1) 코드는 소비되지 않고 보관만 됐다
        assertThat(created.getPendingInviteCode()).isEqualTo(inviteCode);
        // 2) 가입 시점에는 여전히 미인증이다 (이게 이 결함의 전제)
        assertThat(created.isEmailVerified()).isFalse();
        // 3) 표적 워크스페이스에는 들어가지 않았다 ← 결함의 핵심
        assertThat(workspaceMemberRepository.existsByWorkspaceAndUser(target, created)).isFalse();
        // 4) 대신 본인 워크스페이스를 OWNER 로 받았다 (참여 전에도 앱을 쓸 수 있어야 하므로)
        List<WorkspaceMember> owned = workspaceMemberRepository.findByUserAndRole(created, WorkspaceRole.OWNER);
        assertThat(owned).hasSize(1);
        assertThat(owned.get(0).getWorkspace().getId()).isNotEqualTo(target.getId());
    }

    @Test
    @DisplayName("이메일 인증이 끝나면 보류 초대코드를 소비해 MEMBER 로 참여시킨다")
    void verifyingEmailConsumesPendingInviteCode() throws Exception {
        /* [고정하는 결함] 위 수정으로 초대코드 가입이 '보류'로 바뀌었으므로, 인증 완료 시
           코드가 반드시 소비돼야 한다. 소비 로직이 빠지면 초대로 가입한 사람이 팀에
           영원히 못 들어간다(기능이 죽는다). 인증 후 상태를 못 박는다:
           표적 워크스페이스에 MEMBER 로 참여 + pending_invite_code 는 비워짐. */
        User targetOwner = fx.user("owner");
        Workspace target = fx.workspace("표적 팀", targetOwner);

        String email = fx.uniqueEmail("joiner");
        mvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "email", email,
                                "password", "password123",
                                "name", "가입자",
                                "inviteCode", target.getInviteCode()))))
                .andExpect(status().isOk());

        User created = userRepository.findByEmail(email).orElseThrow();
        // 가입 직후 발급된 인증 토큰(메일 발송은 실패해도 토큰은 남는다)
        EmailVerificationToken row = tokenRepository.findAll().stream()
                .filter(t -> t.getUser().getId().equals(created.getId()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("가입 시 인증 토큰이 발급되지 않았다"));

        // 응답에 합류한 워크스페이스 이름이 실려야 한다 — 인증 화면이 "○○ 워크스페이스에
        // 합류했어요"를 이 값으로 그린다. 예전엔 서버가 로그만 남기고 아무것도 돌려주지 않아
        // 사용자가 팀에 들어갔는지 알 방법이 없었다.
        mvc.perform(post("/api/auth/verify-email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("token", row.getToken()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.joinedWorkspaceName").value("표적 팀"))
                .andExpect(jsonPath("$.joinError").doesNotExist());

        User after = userRepository.findByEmail(email).orElseThrow();
        assertThat(after.isEmailVerified()).isTrue();
        assertThat(after.getPendingInviteCode()).isNull();

        WorkspaceMember joined = workspaceMemberRepository.findByWorkspaceAndUser(target, after)
                .orElseThrow(() -> new AssertionError("인증 후에도 표적 워크스페이스에 참여하지 못했다"));
        assertThat(joined.getRole()).isEqualTo(WorkspaceRole.MEMBER);
    }
}
