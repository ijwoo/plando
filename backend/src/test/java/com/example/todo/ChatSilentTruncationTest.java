package com.example.todo;

import com.example.llm.model.LlmDecision;
import com.example.llm.service.AiUsageLimiter;
import com.example.llm.service.ChatService;
import com.example.llm.service.LlmRouter;
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

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * 잘랐으면 잘랐다고, 멈췄으면 멈췄다고 말한다.
 *
 * [고정하는 결함] 상한이 셋인데 모두 조용했다 —
 *  · 다건 생성 14개 초과 → 조용히 버림
 *  · 조회 50개 상한 → "50개를 찾았어요" 로 전부인 척
 *  · 다단계 중 사용량 소진 → 아무 말 없이 멈춤
 *
 * 상한 자체는 맞다(폭주·비용 방지). 문제는 말하지 않는 것이다. 특히 셋째는 **작업이 덜
 * 끝났는데 끝난 것처럼 보여서** 사용자가 나머지를 영영 처리하지 않게 만든다.
 */
class ChatSilentTruncationTest extends IntegrationTestBase {

    @Autowired TestFixtures fx;
    @Autowired ChatService chatService;

    @MockitoBean LlmRouter llmRouter;
    @MockitoBean AiUsageLimiter usageLimiter;

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

    /** 기본은 사용량이 남아 있는 상태. */
    private void usageAvailable() {
        when(usageLimiter.tryConsume(any())).thenReturn(true);
        when(usageLimiter.peek(any())).thenReturn(new AiUsageLimiter.Usage(1, 60, false));
    }

    private String ask(String msg) {
        return String.valueOf(chatService.handle(msg, new LinkedHashMap<>()).get("assistantMessage"));
    }

    @Test
    @DisplayName("생성 상한에 걸리면 몇 개가 빠졌는지 말한다")
    void bulkCreateSaysDropped() {
        User me = fx.user("trunc1");
        Workspace ws = fx.workspace("잘림 워크스페이스", me);
        loginAs(me, ws);
        usageAvailable();

        List<Map<String, Object>> tasks = new ArrayList<>();
        for (int i = 1; i <= 20; i++) tasks.add(Map.of("title", "운동 " + i));

        LlmDecision d = new LlmDecision();
        d.setAction("create_task");
        d.setArgs(Map.of("tasks", tasks));
        when(llmRouter.decide(any(), any())).thenReturn(d);

        String msg = ask("20개 만들어줘");
        assertThat(msg).contains("14개");
        assertThat(msg).as("빠진 개수를 말해야 나머지를 다시 부탁할 수 있다").contains("6개는 빠졌어요");
    }

    @Test
    @DisplayName("상한에 안 걸리면 군더더기를 붙이지 않는다")
    void noNoteWhenUnderLimit() {
        User me = fx.user("trunc2");
        Workspace ws = fx.workspace("잘림 워크스페이스2", me);
        loginAs(me, ws);
        usageAvailable();

        List<Map<String, Object>> tasks = new ArrayList<>();
        for (int i = 1; i <= 3; i++) tasks.add(Map.of("title", "운동 " + i));

        LlmDecision d = new LlmDecision();
        d.setAction("create_task");
        d.setArgs(Map.of("tasks", tasks));
        when(llmRouter.decide(any(), any())).thenReturn(d);

        assertThat(ask("3개 만들어줘")).contains("3개").doesNotContain("빠졌어요");
    }

    @Test
    @DisplayName("조회가 상한에 걸리면 더 있다고 말한다")
    void searchSaysThereIsMore() {
        User me = fx.user("trunc3");
        Workspace ws = fx.workspace("잘림 워크스페이스3", me);
        loginAs(me, ws);
        usageAvailable();
        for (int i = 1; i <= 6; i++) fx.todo(ws, me, "보고서 " + i);

        LlmDecision d = new LlmDecision();
        d.setAction("search_tasks");
        d.setArgs(Map.of("limit", 3));      // 6건 중 3건만 요청
        when(llmRouter.decide(any(), any())).thenReturn(d);

        String msg = ask("보고서 보여줘");
        assertThat(msg).contains("3개");
        assertThat(msg).as("전부인지 잘린 것인지 구분돼야 한다").contains("더 있어요");
    }

    @Test
    @DisplayName("조회 결과가 상한보다 적으면 아무 말도 붙이지 않는다")
    void searchNoNoteWhenFewer() {
        User me = fx.user("trunc4");
        Workspace ws = fx.workspace("잘림 워크스페이스4", me);
        loginAs(me, ws);
        usageAvailable();
        fx.todo(ws, me, "보고서 하나");

        LlmDecision d = new LlmDecision();
        d.setAction("search_tasks");
        d.setArgs(Map.of("limit", 10));
        when(llmRouter.decide(any(), any())).thenReturn(d);

        assertThat(ask("보고서 보여줘")).doesNotContain("더 있어요");
    }

    @Test
    @DisplayName("다단계 중 사용량이 떨어지면 그 때문에 멈췄다고 말한다")
    void multiStepSaysUsageRanOut() {
        /* [고정하는 결함] 단계 상한과 반복 실패는 이유를 붙이는데 사용량 소진만 조용히
           멈췄다. 바뀐 것만 보고 "다 됐다" 로 읽으면 나머지는 영영 처리되지 않는다. */
        User me = fx.user("trunc5");
        Workspace ws = fx.workspace("잘림 워크스페이스5", me);
        loginAs(me, ws);
        var t = fx.todo(ws, me, "보고서");

        // 첫 호출만 성공하고 그 다음부터 사용량 소진
        when(usageLimiter.tryConsume(any())).thenReturn(true, false);
        when(usageLimiter.peek(any())).thenReturn(new AiUsageLimiter.Usage(60, 60, true));

        LlmDecision d = new LlmDecision();
        d.setAction("update_task");
        d.setArgs(Map.of("taskId", "T-" + t.getId(), "status", "IN_PROGRESS", "continue", true));
        when(llmRouter.decide(any(), any())).thenReturn(d);

        String msg = ask("다 진행중으로 바꿔줘");
        assertThat(msg).as("바꾼 것은 그대로 알려준다").contains("진행 중 상태로 바꿨어요");
        assertThat(msg).as("멈춘 이유를 말해야 나머지를 다시 시킬 수 있다")
                .contains("AI 횟수").contains("여기까지");
    }
}
