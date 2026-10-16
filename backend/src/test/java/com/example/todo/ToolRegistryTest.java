package com.example.todo;

import com.example.llm.prompt.LlmPrompts;
import com.example.llm.tool.ToolRegistry;
import com.example.llm.tool.ToolSpec;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 도구 정의가 한 곳에서만 나오는지 확인한다.
 *
 * 예전에는 같은 목록이 세 곳(LlmRouter 의 ALLOWED_ACTIONS, 인젝션 탐지 정규식, 413줄짜리
 * 프롬프트 문자열)에 각각 박혀 있었다. 도구를 추가하면서 한 곳을 빠뜨리면 LLM 은 아는데
 * 서버가 거부하거나 그 반대가 되고, 둘 다 조용히 "chat" 으로 떨어져 **사용자에겐 기능이
 * 아예 없는 것처럼** 보였다. 그래서 "빠뜨림"이 가능하지 않은 구조인지를 테스트로 고정한다.
 */
class ToolRegistryTest {

    @Test
    @DisplayName("등록된 모든 도구가 프롬프트에 설명과 함께 실린다")
    void everyToolAppearsInPrompt() {
        String prompt = LlmPrompts.getSystem(LocalDate.of(2026, 8, 4), "");

        for (ToolSpec tool : ToolRegistry.all()) {
            assertThat(prompt)
                    .as("도구 '%s' 가 프롬프트에 없다 — LLM 이 이 도구를 모른다", tool.name())
                    .contains("\"" + tool.name() + "\"")
                    .contains(tool.summary());

            if (tool.argsSpec() != null) {
                assertThat(prompt)
                        .as("도구 '%s' 의 인자 설명이 프롬프트에 없다 — LLM 이 인자를 만들어낸다", tool.name())
                        .contains("## " + tool.name() + " args");
            }
        }
    }

    @Test
    @DisplayName("프롬프트에 등장하는 action 은 전부 서버가 허용한다")
    void promptDoesNotAdvertiseUnknownActions() {
        /* [고정하는 결함] 반대 방향의 어긋남 — 프롬프트에는 있는데 서버가 모르는 도구.
           LLM 이 그 action 을 내면 라우터가 chat 으로 강등시켜 아무 일도 일어나지 않는다. */
        for (ToolSpec tool : ToolRegistry.all()) {
            assertThat(ToolRegistry.isAllowed(tool.name()))
                    .as("프롬프트가 광고하는 '%s' 를 서버가 거부한다", tool.name())
                    .isTrue();
        }
        assertThat(ToolRegistry.isAllowed("drop_database")).isFalse();
        assertThat(ToolRegistry.isAllowed(null)).isFalse();
    }

    @Test
    @DisplayName("데이터를 바꾸는 도구가 mutating 으로 표시돼 있다")
    void mutatingToolsAreMarked() {
        // 확인 절차·감사 로그가 이 표시를 기준으로 삼는다. 잘못 달리면 삭제가 조용히 지나간다.
        assertThat(ToolRegistry.isMutating("create_task")).isTrue();
        assertThat(ToolRegistry.isMutating("update_task")).isTrue();
        assertThat(ToolRegistry.isMutating("delete_task")).isTrue();
        assertThat(ToolRegistry.isMutating("search_tasks")).isFalse();
        assertThat(ToolRegistry.isMutating("chat")).isFalse();
        // 모르는 이름은 안전한 쪽으로
        assertThat(ToolRegistry.isMutating("nope")).isFalse();
    }
}
