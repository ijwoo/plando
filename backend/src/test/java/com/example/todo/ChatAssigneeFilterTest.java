package com.example.todo;

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

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * "내 담당 할 일만 조회".
 *
 * 화면에는 담당자 뱃지가 붙은 할 일이 보이는데 조회 결과는 0건이었다. 조회가 조용히
 * 틀리면 사용자는 없는 줄 알고 넘어간다 — 오류보다 나쁘다.
 */
class ChatAssigneeFilterTest extends IntegrationTestBase {

    @Autowired TestFixtures fx;
    @Autowired ChatService chatService;
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

    private static LlmDecision decision(Map<String, Object> args) {
        LlmDecision d = new LlmDecision();
        d.setAction("search_tasks");
        d.setArgs(args);
        return d;
    }

    @Test
    @DisplayName("assigneeId=me 로 내 담당 할 일을 찾는다")
    void findsMyAssignedTasks() {
        User me = fx.user("asg1");
        Workspace ws = fx.workspace("담당 워크스페이스", me);
        loginAs(me, ws);

        /* 담당 건을 **먼저** 만들고 그 뒤에 여러 건을 더 만든다.
           결함이 "최근 5건만 훑고 거른다" 였으므로, 담당 건이 최근 5건 밖에 있어야
           재현된다. 두세 건만 두면 우연히 통과해서 고쳐진 줄 착각한다(실제로 그랬다). */
        Todo mine = fx.todo(ws, me, "내가 담당인 일");
        mine.setAssignees(new java.util.ArrayList<>(List.of(me)));  // 하이버네이트가 관리하므로 불변 리스트 금지
        todoRepository.save(mine);

        for (int i = 0; i < 8; i++) fx.todo(ws, me, "담당자 없는 일 " + i);

        when(llmRouter.decide(any(), any())).thenReturn(decision(Map.of("assigneeId", "me", "limit", 50)));

        Map<String, Object> res = chatService.handle("내 담당 할일만 조회", Map.of());

        assertThat(String.valueOf(res.get("assistantMessage")))
                .as("담당자 뱃지가 붙은 할 일이 있는데 0건이 나오면 안 된다")
                .doesNotContain("없어요");

        Map<String, Object> listed = (Map<String, Object>) ((List<?>) res.get("actions")).get(0);
        List<Map<String, Object>> tasks =
                (List<Map<String, Object>>) ((Map<String, Object>) listed.get("payload")).get("tasks");
        assertThat(tasks).extracting(t -> t.get("title")).containsExactly("내가 담당인 일");
    }

    @Test
    @DisplayName("담당자 필터를 쓴 사실이 단계 추적에 남는다")
    void traceShowsAssigneeFilter() {
        /* [고정하는 결함] 추적에 아무 인자도 안 떠서 "할 일 조회 · 결과 0건" 만 보였다.
           무엇으로 걸렀는지 안 보이면 결과가 틀려도 어디가 틀렸는지 짚을 수 없다. */
        User me = fx.user("asg2");
        Workspace ws = fx.workspace("담당 워크스페이스2", me);
        loginAs(me, ws);

        when(llmRouter.decide(any(), any())).thenReturn(decision(Map.of("assigneeId", "me", "limit", 50)));

        Map<String, Object> res = chatService.handle("내 담당 할일만 조회", Map.of());

        List<com.example.llm.agent.AgentStep> steps =
                (List<com.example.llm.agent.AgentStep>) res.get("steps");
        assertThat(steps.get(0).getArgs()).containsKey("assigneeId");
    }

    @Test
    @DisplayName("상태 조회도 최근 몇 건이 아니라 전체에서 찾는다")
    void statusSearchScansBeyondRecentRows() {
        /* 담당자와 같은 결함이다. "진행 중인 일정 보여줘" 도 좁힐 조건이 없어 최근 5건만
           훑었다. 오래된 진행 중 건은 영영 안 나온다. */
        User me = fx.user("asg3");
        Workspace ws = fx.workspace("상태 워크스페이스", me);
        loginAs(me, ws);

        Todo old = fx.todo(ws, me, "오래된 진행 중 일");
        old.setStatus("IN_PROGRESS");
        todoRepository.save(old);

        for (int i = 0; i < 8; i++) fx.todo(ws, me, "그 뒤에 생긴 일 " + i);

        when(llmRouter.decide(any(), any()))
                .thenReturn(decision(Map.of("status", "IN_PROGRESS", "limit", 50)));

        Map<String, Object> res = chatService.handle("진행 중인 일정 보여줘", Map.of());

        Map<String, Object> listed = (Map<String, Object>) ((List<?>) res.get("actions")).get(0);
        List<Map<String, Object>> tasks =
                (List<Map<String, Object>>) ((Map<String, Object>) listed.get("payload")).get("tasks");
        assertThat(tasks).extracting(t -> t.get("title")).contains("오래된 진행 중 일");
    }
}
