package com.example.todo;

import com.example.llm.model.LlmDecision;
import com.example.llm.service.ChatService;
import com.example.llm.service.LlmRouter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * AI 대화 진입점이 **불변 맵**을 받아도 죽지 않는지.
 *
 * [고정하는 결함] ChatController 는 요청 body 에 context 가 없으면 Map.of() 를 넘긴다.
 * ChatService.handle 이 그 맵에 그대로 put 을 해서 UnsupportedOperationException 이 났고,
 * 400 "요청을 처리할 수 없습니다" 로만 돌아왔다. 즉 **context 를 빼고 호출하면 AI 가 무조건
 * 실패**했다. 웹 클라이언트가 늘 context 를 보내서 드러나지 않았을 뿐, 앱·스크립트·외부 호출은
 * 전부 막혀 있었다.
 *
 * 더 나빴던 점: 그 예외는 로그에도 Sentry 에도 남지 않았다(메시지 없는 RuntimeException 을
 * 보고하지 않았다). 그래서 "AI 가 왜 안 되지"를 볼 방법이 없었다.
 */
class ChatContextMutabilityTest extends IntegrationTestBase {

    @Autowired ChatService chatService;

    /* 실제 LLM 을 부르지 않는다 — 여기서 보려는 건 맵 처리이지 라우팅 품질이 아니다.
       (테스트 환경엔 진짜 키가 없어 그대로 두면 OpenAI 401 로 죽는다) */
    @MockitoBean LlmRouter llmRouter;

    @BeforeEach
    void stubRouter() {
        LlmDecision chat = new LlmDecision();
        chat.setAction("chat");
        when(llmRouter.decide(any(), any())).thenReturn(chat);
        when(llmRouter.decide(any(), any(), any())).thenReturn(chat);
    }

    @Test
    @DisplayName("context 로 불변 맵이 들어와도 UnsupportedOperationException 이 나지 않는다")
    void handleAcceptsImmutableContext() {
        // 테스트 환경에는 실제 LLM 키가 없어 라우팅은 폴백으로 끝난다.
        // 여기서 보는 것은 응답 내용이 아니라 **불변 맵을 건드리다 죽지 않는가** 하나다.
        assertThatCode(() -> chatService.handle("안녕", Map.of()))
                .doesNotThrowAnyException();

        assertThatCode(() -> chatService.handle("안녕", null))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("호출자가 넘긴 맵을 건드리지 않는다")
    void doesNotMutateCallerMap() {
        // 방어 복사가 없으면 호출자의 맵에 "message" 가 몰래 끼어든다.
        java.util.Map<String, Object> caller = new java.util.LinkedHashMap<>();
        caller.put("keep", "me");

        chatService.handle("안녕", caller);

        assertThatCode(() -> {
            if (caller.size() != 1 || !caller.containsKey("keep")) {
                throw new AssertionError("호출자의 맵이 변경됐다: " + caller);
            }
        }).doesNotThrowAnyException();
    }
}
