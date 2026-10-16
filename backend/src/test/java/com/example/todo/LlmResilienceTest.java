package com.example.todo;

import com.example.llm.service.ChatService;
import com.example.llm.service.LlmRouter;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * LLM 이 안 될 때 사용자가 무엇을 보는가.
 *
 * [고정하는 결함] 예전엔 LLM 호출 예외가 그대로 올라가 400 "요청을 처리할 수 없습니다" 로만
 * 돌아왔다. 키 만료·OpenAI 장애·타임아웃이 전부 같은 무의미한 문구가 됐고, 로그에도 안 남아
 * 원인을 볼 수 없었다. 사용자 입장에서는 **한 번 써보고 안 되니 다시 안 오는** 그 상황이다.
 *
 * 이 테스트는 실제 키 없이 도는 환경(테스트 프로필)을 그대로 이용한다 — OpenAI 가 401 을
 * 주므로 "LLM 이 실패하는 상황"이 자연스럽게 재현된다.
 */
class LlmResilienceTest extends IntegrationTestBase {

    @Autowired ChatService chatService;
    @Autowired LlmRouter llmRouter;

    @Test
    @DisplayName("LLM 호출이 실패해도 예외를 던지지 않고 사람이 읽을 안내를 준다")
    void llmFailureBecomesReadableMessage() {
        // 테스트 프로필의 키는 더미라 실제 호출은 인증 실패로 끝난다.
        var decision = llmRouter.decide("오늘 일정 알려줘", Map.of());

        assertThat(decision).isNotNull();
        assertThat(decision.getAction())
                .as("실패 시에도 유효한 action 으로 떨어져야 파이프라인이 이어진다")
                .isEqualTo("chat");
        assertThat(decision.getArgs())
                .as("호출 실패는 '못 알아들었다'와 구분돼야 한다")
                .containsEntry("llmUnavailable", true);

        String reason = String.valueOf(decision.getArgs().get("reason"));
        assertThat(reason)
                .as("사용자가 다음에 뭘 할지 판단할 수 있는 문장이어야 한다")
                .isNotBlank()
                .doesNotContain("Exception")
                .doesNotContain("openai.com");   // 내부 정보·URL 노출 금지
    }

    @Test
    @DisplayName("AI 대화 응답이 '못 알아들음'이 아니라 'AI 가 지금 안 됨'을 알린다")
    void chatSurfacesUnavailableInsteadOfGenericFallback() {
        /* 평소 chat 폴백은 "최근 일정을 보여주는" 동작이다. LLM 자체가 죽었을 때 그 폴백을 타면
           사용자는 "내 말을 못 알아들었나" 하고 같은 말을 반복하게 된다. 구분해야 한다. */
        Map<String, Object> res = chatService.handle("오늘 일정 알려줘", Map.of());

        assertThat(res).containsKey("assistantMessage");
        assertThat(String.valueOf(res.get("assistantMessage")))
                .as("무의미한 '요청을 처리할 수 없습니다' 가 아니어야 한다")
                .isNotBlank()
                .isNotEqualTo("요청을 처리할 수 없습니다.")
                .doesNotContain("Exception");

        // 클라이언트가 "AI 가 지금 안 됨"을 구분해 다르게 그릴 수 있어야 한다
        assertThat(String.valueOf(res.get("actions")))
                .contains("llmUnavailable");
    }
}
