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
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atMost;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * AI 일일 사용량 상한.
 *
 * 이 서비스는 무료이고 AI 비용은 전부 운영자 부담이다. 게다가 다단계 루프가 생겨 요청 하나가
 * LLM 을 최대 5번 부른다. 상한이 없으면 잘 될수록 손해가 커진다.
 *
 * 상한을 3으로 낮춰 검증한다 — 실제 값(60)으로 테스트하면 느리고 의도도 흐려진다.
 */
@TestPropertySource(properties = "ai.daily-limit=3")
/*
 * 바깥 트랜잭션을 끈다.
 *
 * AiUsageLimiter.tryConsume 은 REQUIRES_NEW 로 별도 커밋한다(대화 처리가 실패해 롤백돼도
 * **LLM 호출은 이미 나갔고 돈도 나갔으므로** 사용량이 되돌아가면 상한을 우회하는 구멍이 된다).
 * 그런데 REQUIRES_NEW 는 바깥 트랜잭션이 아직 커밋하지 않은 데이터를 볼 수 없다 — 기본 설정
 * (@Transactional 롤백)에서는 픽스처 사용자를 못 찾아 사용량이 0으로 남는다.
 * 그래서 여기서는 실제로 커밋되게 두고, 테스트마다 다른 이메일을 써서 서로 간섭하지 않게 한다.
 */
@org.springframework.transaction.annotation.Transactional(
        propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
class AiUsageLimitTest extends IntegrationTestBase {

    @Autowired ChatService chatService;
    @Autowired AiUsageLimiter limiter;
    @Autowired TestFixtures fx;

    @MockitoBean LlmRouter llmRouter;

    @AfterEach
    void cleanup() {
        WorkspaceHolder.clear();
        SecurityContextHolder.clearContext();
    }

    private User login(String prefix) {
        User me = fx.user(prefix);
        Workspace ws = fx.workspace(prefix + " 워크스페이스", me);
        WorkspaceHolder.set(ws.getId());
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(me.getEmail(), null, List.of()));
        return me;
    }

    private void stub(String action, Map<String, Object> args) {
        LlmDecision d = new LlmDecision();
        d.setAction(action);
        d.setArgs(new LinkedHashMap<>(args));
        when(llmRouter.decide(any(), any())).thenReturn(d);
        when(llmRouter.decide(any(), any(), any())).thenReturn(d);
    }

    @Test
    @DisplayName("상한을 넘으면 막고 이유를 알린다")
    void blocksAfterLimit() {
        User me = login("limit1");
        stub("search_tasks", Map.of("query", "x"));

        for (int i = 0; i < 3; i++) {
            Map<String, Object> ok = chatService.handle("찾아줘", Map.of());
            assertThat(String.valueOf(ok.get("assistantMessage")))
                    .as("상한 이내에서는 정상 동작해야 한다 (%d번째)", i + 1)
                    .doesNotContain("다 썼어요");
        }

        Map<String, Object> blocked = chatService.handle("찾아줘", Map.of());
        assertThat(String.valueOf(blocked.get("assistantMessage")))
                .as("막았으면 이유와 회복 시점을 알려야 한다 — 그냥 안 되면 고장으로 보인다")
                .contains("다 썼어요");

        assertThat(limiter.peek(me.getEmail()).exceeded()).isTrue();
    }

    @Test
    @DisplayName("다단계 루프도 상한을 우회하지 못한다")
    void loopCannotBypassLimit() {
        /* [고정하는 결함] 첫 호출에만 상한을 걸면, 한 요청이 LLM 을 5번 부르는 루프가
           상한을 5배까지 느슨하게 만든다. 돈이 나가는 단위(LLM 호출)로 세야 한다. */
        login("limit2");
        // 계속 continue 를 내는 결정 — 상한이 없으면 5단계까지 돈다
        stub("search_tasks", Map.of("query", "x", "continue", true));

        chatService.handle("계속 찾아줘", Map.of());

        // 상한 3이므로 LLM 호출은 3회를 넘을 수 없다
        verify(llmRouter, atMost(3)).decide(any(), any());
    }

    @Test
    @DisplayName("사용량이 사용자별로 따로 센다")
    void usageIsPerUser() {
        User a = login("limitA");
        stub("search_tasks", Map.of("query", "x"));
        chatService.handle("찾아줘", Map.of());
        assertThat(limiter.peek(a.getEmail()).used()).isEqualTo(1);

        User b = login("limitB");
        assertThat(limiter.peek(b.getEmail()).used())
                .as("다른 사용자의 사용량이 섞이면 한 명이 다 쓰면 모두가 막힌다")
                .isZero();
    }

    @Test
    @DisplayName("남은 횟수를 계산해 화면에 줄 수 있다")
    void remainingIsExposed() {
        User me = login("limit3");
        stub("search_tasks", Map.of("query", "x"));
        chatService.handle("찾아줘", Map.of());

        var u = limiter.peek(me.getEmail());
        assertThat(u.limit()).isEqualTo(3);
        assertThat(u.used()).isEqualTo(1);
        assertThat(u.remaining()).isEqualTo(2);
        assertThat(u.exceeded()).isFalse();
    }
}
