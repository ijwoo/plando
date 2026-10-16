package com.example.todo;

import com.example.todo.entity.User;
import com.example.todo.entity.Workspace;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * AI 분당 한도는 **돈이 나가는 요청**에만 걸려야 한다.
 *
 * [고치는 결함] `/api/chat/**` 전체가 한 통에 담겨 있어, DB만 읽는 역할·예약·사용량 조회가
 * 분당 6건을 같이 갉아먹었다. 예약을 지운 직후 목록 조회가 429 로 막혀 앱이 "예약이 하나도
 * 없다" 를 그렸다 — 사용자에겐 **하나 지웠는데 둘 다 사라진** 것으로 보인다.
 */
class ChatRateLimitTest extends IntegrationTestBase {

    @Autowired TestFixtures fx;

    @Test
    @DisplayName("예약·역할 조회는 AI 한도(분당 6)를 쓰지 않는다")
    void crudPathsAreNotThrottledAsAi() throws Exception {
        User me = fx.user("rate1");
        Workspace ws = fx.workspace("한도 워크스페이스", me);

        // AI 한도가 6이므로, 같은 통이면 7번째부터 429가 난다
        for (int i = 0; i < 12; i++) {
            mvc.perform(get("/api/chat/schedules")
                            .header(HttpHeaders.AUTHORIZATION, fx.bearer(me))
                            .header("X-Workspace-Id", ws.getId()))
                    .andExpect(status().isOk());
        }
        for (int i = 0; i < 12; i++) {
            mvc.perform(get("/api/chat/agents")
                            .header(HttpHeaders.AUTHORIZATION, fx.bearer(me))
                            .header("X-Workspace-Id", ws.getId()))
                    .andExpect(status().isOk());
        }
    }
}
