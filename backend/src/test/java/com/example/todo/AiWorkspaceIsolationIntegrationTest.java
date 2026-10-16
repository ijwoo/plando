package com.example.todo;

import com.example.llm.repo.DbTaskRepository;
import com.example.llm.util.WorkspaceHolder;
import com.example.todo.entity.Todo;
import com.example.todo.entity.User;
import com.example.todo.entity.Workspace;
import com.example.todo.exception.ApiException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * AI 경로의 워크스페이스 격리.
 *
 * 컨트롤러(WorkspaceResolver)에서 이미 멤버십을 검증하지만, 데이터에 닿는 계층에도 같은 검증을
 * 둔다. 여기 테스트는 **그 두 번째 방어선**을 못 박는다 — 컨트롤러를 거치지 않고 WorkspaceHolder
 * 에 남의 워크스페이스 id 를 직접 심어도 뚫리지 않아야 한다.
 *
 * 왜 필요한가: 검증이 호출부에만 있으면, 나중에 누가 헤더 값을 그대로 WorkspaceHolder 에 넣는
 * 순간 남의 할 일을 읽고 고치는 구멍이 된다. 사람이 기억하는 규칙 대신 테스트로 고정한다.
 */
class AiWorkspaceIsolationIntegrationTest extends IntegrationTestBase {

    @Autowired TestFixtures fx;
    @Autowired DbTaskRepository taskRepository;

    @AfterEach
    void clearHolder() {
        // ThreadLocal 이라 안 지우면 다음 테스트로 샌다
        WorkspaceHolder.clear();
    }

    @Test
    @DisplayName("남의 워크스페이스 id 를 WorkspaceHolder 에 심어도 할 일을 조회할 수 없다")
    void cannotSearchAnotherWorkspaceEvenIfHolderIsForged() {
        /* [고정하는 결함] resolveWorkspace 가 findById 만 하고 멤버십을 확인하지 않았다.
           당시엔 WorkspaceHolder 를 넣는 곳이 전부 검증을 마친 값이라 뚫리지 않았지만,
           방어가 호출부 한 겹뿐이라 실수 한 번이면 크로스 테넌트 사고가 된다. */
        User outsider = fx.user("outsider");
        Workspace ownWs = fx.workspace("내 워크스페이스", outsider);

        User victim = fx.user("victim");
        Workspace victimWs = fx.workspace("남의 워크스페이스", victim);
        Todo secret = fx.todo(victimWs, victim, "남의 비밀 할 일");

        // 자기 워크스페이스에서는 정상 동작해야 한다(과잉 차단이 아님을 확인)
        WorkspaceHolder.set(ownWs.getId());
        assertThat(taskRepository.search(outsider.getEmail(), null, null, null, null, null, null, 50))
                .isEmpty();

        // 남의 워크스페이스 id 를 심으면 403
        WorkspaceHolder.set(victimWs.getId());
        assertThatThrownBy(() ->
                taskRepository.search(outsider.getEmail(), null, null, null, null, null, null, 50))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("접근 권한");

        // 피해자 본인은 자기 워크스페이스를 정상적으로 조회할 수 있어야 한다
        assertThat(taskRepository.search(victim.getEmail(), null, null, null, null, null, null, 50))
                .extracting(t -> t.title)
                .contains(secret.getTitle());
    }

    @Test
    @DisplayName("남의 워크스페이스 id 로는 지난 마감 조회도 막힌다")
    void cannotSearchOverdueInAnotherWorkspace() {
        User outsider = fx.user("outsider2");
        fx.workspace("내 워크스페이스2", outsider);

        User victim = fx.user("victim2");
        Workspace victimWs = fx.workspace("남의 워크스페이스2", victim);

        WorkspaceHolder.set(victimWs.getId());
        assertThatThrownBy(() -> taskRepository.searchOverdue(outsider.getEmail(), 50))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("접근 권한");
    }
}
