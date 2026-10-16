package com.example.todo;

import com.example.llm.agent.CustomAgentService;
import com.example.llm.model.LlmDecision;
import com.example.llm.service.ChatService;
import com.example.llm.service.LlmRouter;
import com.example.llm.service.ResultSummarizer;
import com.example.llm.util.WorkspaceHolder;
import com.example.todo.entity.Todo;
import com.example.todo.entity.User;
import com.example.todo.entity.Workspace;
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
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 조회 결과 한 줄 요약.
 *
 * 이 기능은 **조회마다 LLM 을 한 번 더 부른다.** 그래서 지켜야 할 것이 셋이다:
 *  1. 켠 역할에서만 부른다 — 끈 역할까지 두 배로 쓰면 하루 한도가 반나절에 날아간다.
 *  2. 실패해도 조회 결과는 그대로 나온다 — 덤 때문에 본문을 잃으면 안 된다.
 *  3. 결과가 없으면 부르지 않는다 — 요약할 게 없는데 돈을 쓸 이유가 없다.
 */
class ResultSummaryTest extends IntegrationTestBase {

    @Autowired TestFixtures fx;
    @Autowired ChatService chatService;
    @Autowired CustomAgentService customAgentService;
    @Autowired com.example.todo.repository.TodoRepository todoRepository;

    @MockitoBean LlmRouter llmRouter;
    @MockitoBean ResultSummarizer summarizer;

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

    private void stubSearch() {
        LlmDecision d = new LlmDecision();
        d.setAction("search_tasks");
        d.setArgs(Map.of("query", "보고서", "limit", 50));
        when(llmRouter.decide(any(), any())).thenReturn(d);
    }

    /** 요약을 켠 커스텀 역할을 만들고 그 id 를 돌려준다. */
    private String agentWithSummary(Workspace ws, User me, boolean on) {
        var saved = customAgentService.create(ws.getId(), me.getEmail(),
                on ? "브리핑" : "그냥 조회", "🧭", "", "", List.of("search_tasks"), on, false);
        return CustomAgentService.customId(saved.getId());
    }

    @Test
    @DisplayName("요약을 켠 역할에서는 답변에 한 줄이 붙는다")
    void summaryIsAppendedWhenEnabled() {
        User me = fx.user("sum1");
        Workspace ws = fx.workspace("요약 워크스페이스", me);
        loginAs(me, ws);
        fx.todo(ws, me, "보고서 초안");

        stubSearch();
        when(summarizer.summarize(any(), any())).thenReturn("보고서 초안부터 끝내시는 게 좋겠어요.");

        Map<String, Object> res = chatService.handle("보고서 찾아줘",
                new java.util.LinkedHashMap<>(Map.of("agentId", agentWithSummary(ws, me, true))));

        String msg = String.valueOf(res.get("assistantMessage"));
        assertThat(msg).as("원래 문장은 남아야 한다 — 요약이 대체가 아니라 덧붙임이다").contains("찾았어요");
        assertThat(msg).contains("보고서 초안부터 끝내시는 게 좋겠어요.");
    }

    @Test
    @DisplayName("요약을 끈 역할에서는 LLM 을 한 번도 더 부르지 않는다")
    void noExtraCallWhenDisabled() {
        /* [고정하는 비용] 이걸 안 지키면 모든 조회가 두 배로 비싸진다.
           하루 60회가 30회가 되는 셈이라 기능 하나가 한도를 절반으로 깎는다. */
        User me = fx.user("sum2");
        Workspace ws = fx.workspace("요약 워크스페이스2", me);
        loginAs(me, ws);
        fx.todo(ws, me, "보고서 초안");

        stubSearch();

        chatService.handle("보고서 찾아줘",
                new java.util.LinkedHashMap<>(Map.of("agentId", agentWithSummary(ws, me, false))));

        verify(summarizer, never()).summarize(any(), any());
    }

    @Test
    @DisplayName("기본 역할도 요약하지 않는다")
    void builtInDefaultDoesNotSummarize() {
        User me = fx.user("sum3");
        Workspace ws = fx.workspace("요약 워크스페이스3", me);
        loginAs(me, ws);
        fx.todo(ws, me, "보고서 초안");

        stubSearch();
        chatService.handle("보고서 찾아줘", Map.of());

        verify(summarizer, never()).summarize(any(), any());
    }

    @Test
    @DisplayName("요약이 실패해도 조회 결과는 그대로 나온다")
    void searchSurvivesSummaryFailure() {
        /* [고정하는 결함] 요약은 덤이다. 여기서 예외가 새어 나가면 덤 때문에 본문을
           통째로 잃는다 — 조회는 됐는데 화면에는 오류만 뜨는 상황이 된다. */
        User me = fx.user("sum4");
        Workspace ws = fx.workspace("요약 워크스페이스4", me);
        loginAs(me, ws);
        fx.todo(ws, me, "보고서 초안");

        stubSearch();
        when(summarizer.summarize(any(), any())).thenReturn(null); // 실패 시 계약: null

        Map<String, Object> res = chatService.handle("보고서 찾아줘",
                new java.util.LinkedHashMap<>(Map.of("agentId", agentWithSummary(ws, me, true))));

        assertThat(String.valueOf(res.get("assistantMessage"))).contains("찾았어요");
        assertThat((List<?>) res.get("actions")).isNotEmpty();
    }

    @Test
    @DisplayName("결과가 없으면 요약을 부르지 않는다")
    void noSummaryForEmptyResult() {
        User me = fx.user("sum5");
        Workspace ws = fx.workspace("요약 워크스페이스5", me);
        loginAs(me, ws);
        // 할 일을 만들지 않는다 — 조회 결과가 비게 된다

        stubSearch();
        chatService.handle("보고서 찾아줘",
                new java.util.LinkedHashMap<>(Map.of("agentId", agentWithSummary(ws, me, true))));

        verify(summarizer, never()).summarize(any(), any());
    }

    @Test
    @DisplayName("마감 지난 조회에도 요약이 붙는다")
    void overdueSearchIsSummarizedToo() {
        /* [고정하는 결함] 마감 지난 조회는 위쪽에서 먼저 return 하는 별도 분기다.
           요약을 일반 조회 경로에만 넣었더니 **브리핑에 가장 많이 쓰는 경로가 통째로
           건너뛰어졌다.** 켜 두었는데 아무 일도 안 일어나면 기능이 없는 것과 같다. */
        User me = fx.user("sum6");
        Workspace ws = fx.workspace("요약 워크스페이스6", me);
        loginAs(me, ws);

        Todo overdue = fx.todo(ws, me, "지난 보고서");
        overdue.setDueDate(java.time.LocalDate.now().minusDays(3));
        todoRepository.save(overdue);

        LlmDecision d = new LlmDecision();
        d.setAction("search_tasks");
        d.setArgs(Map.of("overdue", true, "limit", 50));
        when(llmRouter.decide(any(), any())).thenReturn(d);
        when(summarizer.summarize(any(), any())).thenReturn("지난 보고서부터 끝내시는 게 좋겠어요.");

        Map<String, Object> res = chatService.handle("밀린 일정 알려줘",
                new java.util.LinkedHashMap<>(Map.of("agentId", agentWithSummary(ws, me, true))));

        String msg = String.valueOf(res.get("assistantMessage"));
        assertThat(msg).contains("기한이 지난 일정이");
        assertThat(msg).contains("지난 보고서부터 끝내시는 게 좋겠어요.");
    }
}
