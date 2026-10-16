package com.example.todo;

import com.example.todo.entity.User;
import com.example.todo.entity.Workspace;
import com.example.todo.repository.TodoRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 오프라인에서 적은 것을 다시 보내도 하나만 만들어진다.
 *
 * [고정하는 결함] 네트워크가 없을 때 적은 것은 지금 그냥 사라진다(queryClient 주석의 빚).
 * 앱이 들고 있다가 재전송하게 만들 건데, **보냈는데 응답만 못 받은 경우**가 문제다 —
 * 서버는 이미 만들었고 앱은 실패로 안다. 그대로 다시 보내면 같은 할 일이 두 개 생긴다.
 *
 * 앱이 붙인 열쇠가 같으면 서버는 새로 만들지 않고 있던 것을 돌려준다.
 * 재전송이 몇 번을 와도 결과가 같아야 앱이 마음 놓고 다시 보낼 수 있다.
 */
class OfflineIdempotentCreateTest extends IntegrationTestBase {

    @Autowired TestFixtures fx;
    @Autowired TodoRepository todoRepository;

    private String body(String title, String clientKey) throws Exception {
        return json.writeValueAsString(clientKey == null
                ? Map.of("title", title, "status", "TODO")
                : Map.of("title", title, "status", "TODO", "clientKey", clientKey));
    }

    @Test
    @DisplayName("같은 열쇠로 두 번 보내도 하나만 생긴다")
    void sameKeyCreatesOnce() throws Exception {
        User me = fx.user("idem1");
        Workspace ws = fx.workspace("오프라인 워크스페이스", me);
        long before = todoRepository.count();

        for (int i = 0; i < 3; i++) {   // 앱이 세 번 재전송한 상황
            mvc.perform(post("/api/todos")
                            .header(HttpHeaders.AUTHORIZATION, fx.bearer(me))
                            .header("X-Workspace-Id", ws.getId())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body("지하철에서 적은 할 일", "k-abc-123")))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.title").value("지하철에서 적은 할 일"));
        }

        assertThat(todoRepository.count()).as("재전송이 와도 하나여야 한다").isEqualTo(before + 1);
    }

    @Test
    @DisplayName("열쇠가 다르면 각각 만들어진다")
    void differentKeysCreateSeparately() throws Exception {
        /* 과하게 막으면 정상 생성이 합쳐진다 — 반대 방향도 고정한다. */
        User me = fx.user("idem2");
        Workspace ws = fx.workspace("오프라인 워크스페이스2", me);
        long before = todoRepository.count();

        mvc.perform(post("/api/todos").header(HttpHeaders.AUTHORIZATION, fx.bearer(me))
                .header("X-Workspace-Id", ws.getId()).contentType(MediaType.APPLICATION_JSON)
                .content(body("첫째", "k-1"))).andExpect(status().isOk());
        mvc.perform(post("/api/todos").header(HttpHeaders.AUTHORIZATION, fx.bearer(me))
                .header("X-Workspace-Id", ws.getId()).contentType(MediaType.APPLICATION_JSON)
                .content(body("둘째", "k-2"))).andExpect(status().isOk());

        assertThat(todoRepository.count()).isEqualTo(before + 2);
    }

    @Test
    @DisplayName("열쇠가 없으면 예전처럼 매번 만든다")
    void noKeyKeepsOldBehaviour() throws Exception {
        /* 웹과 기존 클라이언트는 열쇠를 안 보낸다. 그쪽 동작이 바뀌면 안 된다. */
        User me = fx.user("idem3");
        Workspace ws = fx.workspace("오프라인 워크스페이스3", me);
        long before = todoRepository.count();

        for (int i = 0; i < 2; i++) {
            mvc.perform(post("/api/todos").header(HttpHeaders.AUTHORIZATION, fx.bearer(me))
                    .header("X-Workspace-Id", ws.getId()).contentType(MediaType.APPLICATION_JSON)
                    .content(body("같은 제목", null))).andExpect(status().isOk());
        }
        assertThat(todoRepository.count()).isEqualTo(before + 2);
    }

    @Test
    @DisplayName("다른 워크스페이스에서 같은 열쇠를 써도 서로 무관하다")
    void keysAreScopedToWorkspace() throws Exception {
        User me = fx.user("idem4");
        Workspace a = fx.workspace("워크스페이스 A", me);
        Workspace b = fx.workspace("워크스페이스 B", me);
        long before = todoRepository.count();

        mvc.perform(post("/api/todos").header(HttpHeaders.AUTHORIZATION, fx.bearer(me))
                .header("X-Workspace-Id", a.getId()).contentType(MediaType.APPLICATION_JSON)
                .content(body("A 의 할 일", "same-key"))).andExpect(status().isOk());
        mvc.perform(post("/api/todos").header(HttpHeaders.AUTHORIZATION, fx.bearer(me))
                .header("X-Workspace-Id", b.getId()).contentType(MediaType.APPLICATION_JSON)
                .content(body("B 의 할 일", "same-key"))).andExpect(status().isOk());

        assertThat(todoRepository.count()).as("워크스페이스가 다르면 겹쳐도 무관하다").isEqualTo(before + 2);
    }
}
