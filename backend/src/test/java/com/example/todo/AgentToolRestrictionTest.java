package com.example.todo;

import com.example.llm.agent.AgentRegistry;
import com.example.llm.agent.AgentSpec;
import com.example.llm.model.LlmDecision;
import com.example.llm.service.ChatService;
import com.example.llm.service.LlmRouter;
import com.example.llm.util.WorkspaceHolder;
import com.example.todo.entity.Todo;
import com.example.todo.entity.User;
import com.example.todo.entity.Workspace;
import com.example.todo.repository.TodoRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * 에이전트의 도구 제한이 **실제로** 막는가.
 *
 * 이건 이 기능의 핵심 약속이다. "이 역할은 아무것도 바꾸지 않아요"라고 화면에 써 놓고
 * 실제로는 지울 수 있다면 그 문구는 거짓말이 된다.
 *
 * 제한을 프롬프트에만 적으면 LLM 이 어긋나는 순간 그대로 실행된다. 지침은 안내이지 방어가
 * 아니다. 그래서 실행 계층에서도 막고, 그게 동작하는지를 여기서 고정한다.
 */
class AgentToolRestrictionTest extends IntegrationTestBase {

    @Autowired ChatService chatService;
    @Autowired TestFixtures fx;
    @Autowired TodoRepository todoRepository;

    @MockitoBean LlmRouter llmRouter;

    @AfterEach
    void cleanup() {
        WorkspaceHolder.clear();
        SecurityContextHolder.clearContext();
    }

    private void loginAs(User user, Workspace ws) {
        WorkspaceHolder.set(ws.getId());
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(user.getEmail(), null, List.of()));
    }

    private void stub(String action, Map<String, Object> args) {
        LlmDecision d = new LlmDecision();
        d.setAction(action);
        d.setArgs(new LinkedHashMap<>(args));
        when(llmRouter.decide(any(), any())).thenReturn(d);
        when(llmRouter.decide(any(), any(), any())).thenReturn(d);
    }

    @Test
    @DisplayName("조회 전용 역할은 LLM 이 삭제를 내도 실행하지 않는다")
    void readOnlyAgentCannotDelete() {
        /* [고정하는 결함] 제한이 프롬프트에만 있으면, LLM 이 어긋나 delete_task 를 내는 순간
           "아무것도 바꾸지 않아요"라고 안내한 역할이 데이터를 지운다. */
        User me = fx.user("ro");
        Workspace ws = fx.workspace("제한 워크스페이스", me);
        Todo victim = fx.todo(ws, me, "지워지면 안 되는 할 일");
        loginAs(me, ws);

        stub("delete_task", Map.of("taskId", "T-" + victim.getId()));

        Map<String, Object> res = chatService.handle(
                "그거 지워줘", Map.of("agentId", "review"));   // 점검 도우미 = 조회 전용

        assertThat(todoRepository.findById(victim.getId()))
                .as("조회 전용 역할이 데이터를 지웠다 — 화면의 약속이 거짓이 된다")
                .isPresent();

        assertThat(String.valueOf(res.get("assistantMessage")))
                .as("막았으면 이유를 알려야 한다 — 조용히 무시하면 고장으로 보인다")
                .contains("할 수 없어요");
    }

    @Test
    @DisplayName("허용된 도구는 정상 실행된다 (과잉 차단이 아님)")
    void allowedToolStillRuns() {
        User me = fx.user("ro2");
        Workspace ws = fx.workspace("제한 워크스페이스2", me);
        fx.todo(ws, me, "찾을 수 있는 할 일");
        loginAs(me, ws);

        stub("search_tasks", Map.of("query", "찾을"));

        Map<String, Object> res = chatService.handle("찾아줘", Map.of("agentId", "review"));

        assertThat((List<?>) res.get("steps")).hasSize(1);
        assertThat(String.valueOf(res.get("assistantMessage"))).doesNotContain("할 수 없어요");
    }

    @Test
    @DisplayName("기본 역할은 제한이 없다 (기존 동작 유지)")
    void defaultAgentUnrestricted() {
        AgentSpec def = AgentRegistry.find(null);
        assertThat(def.id()).isEqualTo(AgentRegistry.DEFAULT_ID);
        for (String tool : List.of("search_tasks", "create_task", "update_task", "delete_task")) {
            assertThat(def.allows(tool)).as("기본 역할이 %s 를 막으면 기존 동작이 깨진다", tool).isTrue();
        }
        assertThat(def.readOnly()).isFalse();
    }

    @Test
    @DisplayName("모르는 역할 id 는 기본으로 떨어진다 (AI 가 아예 안 되면 안 된다)")
    void unknownAgentFallsBackToDefault() {
        assertThat(AgentRegistry.find("존재하지-않음").id()).isEqualTo(AgentRegistry.DEFAULT_ID);
        assertThat(AgentRegistry.find("").id()).isEqualTo(AgentRegistry.DEFAULT_ID);
    }

    @Test
    @DisplayName("읽기 전용 표시가 실제 도구 목록과 일치한다")
    void readOnlyFlagMatchesTools() {
        // 화면이 이 값으로 "아무것도 바꾸지 않아요"를 그린다. 어긋나면 그대로 거짓말이 된다.
        for (AgentSpec a : AgentRegistry.all()) {
            boolean hasMutating = a.allowedTools().stream()
                    .anyMatch(com.example.llm.tool.ToolRegistry::isMutating);
            if (a.allowedTools().isEmpty()) {
                assertThat(a.readOnly()).as("제한 없는 역할은 읽기 전용일 수 없다").isFalse();
            } else {
                assertThat(a.readOnly())
                        .as("역할 '%s' 의 읽기전용 표시가 도구 목록과 어긋난다", a.name())
                        .isEqualTo(!hasMutating);
            }
        }
    }

    @Test
    @DisplayName("제한된 역할도 되묻기(need_more_info)와 대화는 할 수 있다")
    void controlActionsAlwaysAllowed() {
        // 이걸 막으면 정보가 부족할 때 아무 말도 못 하고 멈춘다.
        AgentSpec review = AgentRegistry.find("review");
        assertThat(review.allows("need_more_info")).isTrue();
        assertThat(review.allows("chat")).isTrue();
        assertThat(review.allows("delete_task")).isFalse();
    }
}
