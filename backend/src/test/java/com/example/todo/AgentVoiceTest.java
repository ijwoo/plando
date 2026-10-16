package com.example.todo;

import com.example.llm.agent.CustomAgentService;
import com.example.llm.model.LlmDecision;
import com.example.llm.service.ChatService;
import com.example.llm.service.LlmRouter;
import com.example.llm.service.ResponseWriter;
import com.example.llm.service.ResultSummarizer;
import com.example.llm.util.WorkspaceHolder;
import com.example.todo.entity.User;
import com.example.todo.entity.Workspace;
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
import static org.mockito.ArgumentCaptor.forClass;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.Answers.RETURNS_DEEP_STUBS;
import static org.mockito.ArgumentMatchers.anyString;

/**
 * 역할 말투 — 지침이 실제로 답변에 반영되는가.
 *
 * [고정하는 결함] 이 앱의 답변은 서버가 조립한 고정 문구라, 역할에 지침을 아무리 써도
 * 말투가 하나도 안 바뀌었다. 역할의 두 축(도구 제한 / 지침) 중 하나가 장식이었다.
 *
 * 다만 통째로 LLM 에 맡기면 **예전에 고친 버그가 되살아난다** — 답변과 결과 카드가 다른
 * 개수를 말하거나 없는 id 를 지어내던 문제가 실제로 있었다. 그래서 사실은 서버가 확정하고
 * 문장만 다시 쓰며, 써 온 문장이 사실과 어긋나면 버린다. 그 두 가지를 여기서 고정한다.
 */
class AgentVoiceTest extends IntegrationTestBase {

    @Autowired TestFixtures fx;
    @Autowired ChatService chatService;
    @Autowired CustomAgentService customAgentService;

    @MockitoBean LlmRouter llmRouter;
    @MockitoBean ResponseWriter responseWriter;
    @MockitoBean ResultSummarizer resultSummarizer;

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

    /** 말투(voice)를 켜거나 끈 역할을 만들고 id 를 돌려준다. */
    private String agent(Workspace ws, User me, String instructions, boolean voice) {
        var saved = customAgentService.create(ws.getId(), me.getEmail(),
                "말투 역할", "🧭", "", instructions, List.of("search_tasks"), false, voice);
        return CustomAgentService.customId(saved.getId());
    }

    private Map<String, Object> ctx(String agentId) {
        return new LinkedHashMap<>(Map.of("agentId", agentId));
    }

    @Test
    @DisplayName("말투를 켜면 다시 쓴 문장이 답변이 된다")
    void rewritesWhenEnabled() {
        User me = fx.user("voice1");
        Workspace ws = fx.workspace("말투 워크스페이스", me);
        loginAs(me, ws);
        fx.todo(ws, me, "보고서 초안");
        stubSearch();
        when(responseWriter.rewrite(any(), any(), any())).thenReturn("급한 건 없어 보여요. 보고서 초안부터 보시죠.");

        Map<String, Object> res = chatService.handle("보고서 찾아줘", ctx(agent(ws, me, "짧고 담백하게 말해라", true)));

        assertThat(String.valueOf(res.get("assistantMessage")))
                .isEqualTo("급한 건 없어 보여요. 보고서 초안부터 보시죠.");
    }

    @Test
    @DisplayName("역할 지침이 그대로 전달된다")
    void passesInstructions() {
        /* 지침이 안 넘어가면 "말투를 바꾼다"는 약속이 거짓이 된다 — 이 기능의 존재 이유다. */
        User me = fx.user("voice2");
        Workspace ws = fx.workspace("말투 워크스페이스2", me);
        loginAs(me, ws);
        fx.todo(ws, me, "보고서 초안");
        stubSearch();
        when(responseWriter.rewrite(any(), any(), any())).thenReturn("다시 쓴 문장");

        chatService.handle("보고서 찾아줘", ctx(agent(ws, me, "반말로 짧게", true)));

        var instructions = forClass(String.class);
        verify(responseWriter).rewrite(any(), any(), instructions.capture());
        assertThat(instructions.getValue()).contains("반말로 짧게");
    }

    @Test
    @DisplayName("사실에는 조회 결과가 개수와 함께 담긴다")
    void factsCarryTheResult() {
        /* 사실이 비면 LLM 이 지어내는 수밖에 없다. 카드와 같은 출처(actions)에서 뽑는지 본다. */
        User me = fx.user("voice3");
        Workspace ws = fx.workspace("말투 워크스페이스3", me);
        loginAs(me, ws);
        fx.todo(ws, me, "보고서 초안");
        stubSearch();
        when(responseWriter.rewrite(any(), any(), any())).thenReturn("다시 쓴 문장");

        chatService.handle("보고서 찾아줘", ctx(agent(ws, me, "", true)));

        var facts = forClass(String.class);
        verify(responseWriter).rewrite(any(), facts.capture(), any());
        assertThat(facts.getValue()).contains("조회 결과").contains("보고서 초안");
    }

    @Test
    @DisplayName("말투를 끈 역할은 LLM 을 한 번도 더 부르지 않는다")
    void noExtraCallWhenDisabled() {
        /* [고정하는 비용] 안 지키면 모든 대화가 두 배로 비싸진다. */
        User me = fx.user("voice4");
        Workspace ws = fx.workspace("말투 워크스페이스4", me);
        loginAs(me, ws);
        fx.todo(ws, me, "보고서 초안");
        stubSearch();

        chatService.handle("보고서 찾아줘", ctx(agent(ws, me, "지침 있음", false)));

        verify(responseWriter, never()).rewrite(any(), any(), any());
    }

    @Test
    @DisplayName("다시 쓰기가 실패해도 원래 문장으로 답한다")
    void fallsBackOnFailure() {
        /* [고정하는 결함] 말투는 덤이다. 여기서 답변을 잃으면 조회는 됐는데 화면엔 아무 말도
           없는 상태가 된다 — 덤 때문에 본문을 잃는 셈이다. */
        User me = fx.user("voice5");
        Workspace ws = fx.workspace("말투 워크스페이스5", me);
        loginAs(me, ws);
        fx.todo(ws, me, "보고서 초안");
        stubSearch();
        when(responseWriter.rewrite(any(), any(), any())).thenReturn(null);  // 실패 계약: null

        Map<String, Object> res = chatService.handle("보고서 찾아줘", ctx(agent(ws, me, "", true)));

        assertThat(String.valueOf(res.get("assistantMessage"))).contains("찾았어요");
        assertThat((List<?>) res.get("actions")).isNotEmpty();
    }

    @Test
    @DisplayName("말투가 켜지면 한 줄 요약은 건너뛴다")
    void voiceSupersedesSummary() {
        /* 둘 다 부르면 같은 값을 위해 LLM 을 두 번 쓴다. 다시 쓰는 쪽이 판단까지 담을 수 있다. */
        User me = fx.user("voice6");
        Workspace ws = fx.workspace("말투 워크스페이스6", me);
        loginAs(me, ws);
        fx.todo(ws, me, "보고서 초안");
        stubSearch();
        when(responseWriter.rewrite(any(), any(), any())).thenReturn("다시 쓴 문장");

        var saved = customAgentService.create(ws.getId(), me.getEmail(),
                "둘 다 켠 역할", "🧭", "", "", List.of("search_tasks"), true, true);
        chatService.handle("보고서 찾아줘", ctx(CustomAgentService.customId(saved.getId())));

        verify(resultSummarizer, never()).summarize(any(), any());
    }

    // ── 환각 방어 (ResponseWriter 자체 검증) ──────────────────────────────────

    /**
     * LLM 이 이 문장을 써 왔다고 치고 진짜 ResponseWriter 를 돌린다.
     * Spring AI 의 유창한 API 라 깊은 스텁으로 체인 끝(content)만 정해 준다.
     */
    private static ResponseWriter writerReturning(String llmOutput) {
        org.springframework.ai.chat.client.ChatClient.Builder b =
                mock(org.springframework.ai.chat.client.ChatClient.Builder.class, RETURNS_DEEP_STUBS);
        when(b.build().prompt().system(anyString()).user(anyString()).call().content()).thenReturn(llmOutput);
        return new ResponseWriter(b);
    }

    @Test
    @DisplayName("사실에 없는 개수를 말하면 버린다")
    void rejectsInventedCount() {
        /* [고정하는 결함] 예전에 "답변과 결과 카드가 다른 개수를 말하던" 버그가 실제로 있었다.
           LLM 에 문장을 맡기면 그 버그가 되살아나므로, 세는 말에 붙은 숫자를 검사한다. */
        ResponseWriter writer = writerReturning("5개를 찾았어요.");
        String out = writer.rewrite("2개를 찾았어요.", "조회 결과 2개\n- T-1 보고서", "");
        assertThat(out).as("사실은 2개인데 5개라고 말하면 버려야 한다").isNull();
    }

    @Test
    @DisplayName("사실에 있는 개수는 통과한다")
    void acceptsFaithfulCount() {
        ResponseWriter writer = writerReturning("보고서 2개가 남아 있어요.");
        String out = writer.rewrite("2개를 찾았어요.", "조회 결과 2개\n- T-1 보고서", "");
        assertThat(out).isEqualTo("보고서 2개가 남아 있어요.");
    }

    @Test
    @DisplayName("없는 일정 번호를 말하면 버린다")
    void rejectsInventedTaskId() {
        /* 가짜 id(T-1)로 실패하던 다단계 버그와 같은 종류다. 화면 카드에 없는 번호를 답변이
           말하면 사용자는 그 번호를 찾으러 간다. */
        ResponseWriter writer = writerReturning("T-99 부터 처리하세요.");
        String out = writer.rewrite("1개를 찾았어요.", "조회 결과 1개\n- T-12 보고서", "");
        assertThat(out).isNull();
    }

    @Test
    @DisplayName("서수는 막지 않는다")
    void allowsOrdinals() {
        /* 과하게 막으면 멀쩡한 문장이 계속 버려져서 기능이 없는 것과 같아진다.
           "1순위"의 1 은 세는 말이 아니다. */
        ResponseWriter writer = writerReturning("1순위는 계약서 검토예요.");
        String out = writer.rewrite("3개를 찾았어요.", "조회 결과 3개", "");
        assertThat(out).isEqualTo("1순위는 계약서 검토예요.");
    }
}
