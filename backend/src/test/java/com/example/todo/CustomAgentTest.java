package com.example.todo;

import com.example.llm.agent.AgentResolver;
import com.example.llm.agent.AgentSpec;
import com.example.llm.agent.CustomAgentService;
import com.example.llm.util.WorkspaceHolder;
import com.example.todo.entity.CustomAgent;
import com.example.todo.entity.User;
import com.example.todo.entity.Workspace;
import com.example.todo.exception.ApiException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 사용자 정의 역할.
 *
 * 지켜야 할 것:
 *  1. **워크스페이스 격리** — 남의 역할이 보이거나 수정되면 안 된다.
 *  2. **도구 이름 검증** — 오타를 조용히 버리면 "조회만 하는 역할"이 제한 없는 역할이 된다.
 *  3. **내장과 같은 방식으로 동작** — 만들었는데 지침이 안 먹으면 만든 의미가 없다.
 */
class CustomAgentTest extends IntegrationTestBase {

    @Autowired CustomAgentService service;
    @Autowired AgentResolver resolver;
    @Autowired TestFixtures fx;

    @AfterEach
    void cleanup() {
        WorkspaceHolder.clear();
    }

    @Test
    @DisplayName("만든 역할이 목록과 해석 양쪽에서 보인다")
    void createdAgentIsResolvable() {
        User me = fx.user("ca1");
        Workspace ws = fx.workspace("역할 워크스페이스", me);
        WorkspaceHolder.set(ws.getId());

        CustomAgent saved = service.create(ws.getId(), me.getEmail(),
                "회고 도우미", "📝", "한 주를 돌아보게 도와줘요",
                "너는 회고를 돕는다. 조회한 내용을 바탕으로 질문을 던져라.",
                List.of("search_tasks"), false, false);

        String id = CustomAgentService.customId(saved.getId());

        assertThat(resolver.listFor(ws.getId()))
                .as("목록에 안 보이면 고를 수가 없다")
                .anyMatch(a -> a.id().equals(id));

        AgentSpec spec = resolver.resolve(id);
        assertThat(spec.id()).as("해석이 안 되면 만들어도 동작하지 않는다").isEqualTo(id);
        assertThat(spec.instructions()).contains("회고");
        assertThat(spec.readOnly()).as("조회 도구만 줬으면 읽기 전용이어야 한다").isTrue();
        assertThat(spec.allows("delete_task")).isFalse();
    }

    @Test
    @DisplayName("남의 워크스페이스 역할은 보이지도 해석되지도 않는다")
    void agentsAreWorkspaceScoped() {
        /* [고정하는 결함] 워크스페이스로 한정하지 않으면 id 만 알면 남의 역할을 쓰게 된다.
           역할에는 그 팀의 업무 지침이 담기므로 그것만으로도 정보가 샌다. */
        User owner = fx.user("ca2");
        Workspace mine = fx.workspace("내 워크스페이스", owner);
        User other = fx.user("ca3");
        Workspace theirs = fx.workspace("남의 워크스페이스", other);

        CustomAgent secret = service.create(theirs.getId(), other.getEmail(),
                "비밀 역할", "🤖", "남의 팀 규칙", "우리 팀 내부 규칙이 담긴 지침", List.of(), false, false);

        WorkspaceHolder.set(mine.getId());
        assertThat(resolver.listFor(mine.getId()))
                .as("남의 역할이 목록에 보이면 안 된다")
                .noneMatch(a -> a.name().equals("비밀 역할"));

        AgentSpec resolved = resolver.resolve(CustomAgentService.customId(secret.getId()));
        assertThat(resolved.id())
                .as("남의 역할 id 를 알아도 쓸 수 없어야 한다 — 기본으로 떨어져야 한다")
                .isEqualTo("default");
    }

    @Test
    @DisplayName("남의 워크스페이스 역할은 수정·삭제도 막힌다")
    void cannotEditOthersAgent() {
        User owner = fx.user("ca4");
        Workspace mine = fx.workspace("내 워크스페이스2", owner);
        User other = fx.user("ca5");
        Workspace theirs = fx.workspace("남의 워크스페이스2", other);

        CustomAgent secret = service.create(theirs.getId(), other.getEmail(),
                "남의 역할", "🤖", "", "", List.of(), false, false);

        assertThatThrownBy(() -> service.update(secret.getId(), mine.getId(),
                "가로채기", "😈", "", "", List.of(), false, false))
                .isInstanceOf(ApiException.class);

        assertThatThrownBy(() -> service.delete(secret.getId(), mine.getId()))
                .isInstanceOf(ApiException.class);
    }

    @Test
    @DisplayName("모르는 도구 이름은 조용히 버리지 않고 거절한다")
    void unknownToolIsRejected() {
        /* [고정하는 결함] 오타를 버리면 목록이 비게 되고, 빈 목록은 "제한 없음"이다.
           사용자는 "조회만 하는 역할"을 만들었다고 믿는데 실제로는 뭐든 할 수 있게 된다. */
        User me = fx.user("ca6");
        Workspace ws = fx.workspace("역할 워크스페이스3", me);

        assertThatThrownBy(() -> service.create(ws.getId(), me.getEmail(),
                "오타 역할", "🤖", "", "", List.of("search_taskss"), false, false))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("알 수 없는 도구");
    }

    @Test
    @DisplayName("이름이 비면 만들 수 없다")
    void nameIsRequired() {
        User me = fx.user("ca7");
        Workspace ws = fx.workspace("역할 워크스페이스4", me);

        assertThatThrownBy(() -> service.create(ws.getId(), me.getEmail(),
                "  ", "🤖", "", "", List.of(), false, false))
                .isInstanceOf(ApiException.class);
    }

    @Test
    @DisplayName("워크스페이스당 개수 상한이 있다")
    void limitsCountPerWorkspace() {
        // 목록이 길어지면 고르는 것 자체가 일이 된다. 그리고 무한히 만들 수 있으면 저장소도 샌다.
        User me = fx.user("ca8");
        Workspace ws = fx.workspace("역할 워크스페이스5", me);

        for (int i = 0; i < 12; i++) {
            service.create(ws.getId(), me.getEmail(), "역할" + i, "🤖", "", "", List.of(), false, false);
        }
        assertThatThrownBy(() -> service.create(ws.getId(), me.getEmail(), "13번째", "🤖", "", "", List.of(), false, false))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("12개");
    }
}
