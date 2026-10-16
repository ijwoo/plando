package com.example.llm.agent;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 내장 에이전트 목록.
 *
 * 다우오피스의 "인사 비서 / 회계 비서" 자리다. 다만 거기는 회사 규정 문서를 학습시키는 구조이고,
 * Plan Do! 에는 대응하는 문서가 없다. 대신 **할 일을 다루는 방식**으로 나눴다 —
 * 무엇을 도와주느냐보다 "무엇까지 건드릴 수 있느냐"가 사용자에게 더 중요한 구분이다.
 *
 * 여기는 **내장만** 둔다. 워크스페이스가 직접 만든 역할은 DB(CustomAgent)에 있고,
 * 둘을 합쳐 한 목록으로 만드는 것은 AgentResolver 의 몫이다.
 */
public final class AgentRegistry {

    private AgentRegistry() {}

    /** 기본값 — 에이전트를 고르지 않았을 때. 예전과 완전히 같은 동작(도구 제한 없음). */
    public static final String DEFAULT_ID = "default";

    private static final List<AgentSpec> AGENTS = List.of(
            new AgentSpec(
                    DEFAULT_ID,
                    "기본",
                    "✨",
                    "할 일을 만들고, 찾고, 정리하는 걸 모두 도와드려요",
                    "",                       // 추가 지침 없음 — 기존 동작 그대로
                    Set.of(),                 // 도구 제한 없음
                    false,                    // 요약 끔 — 기본 역할은 평소 비용 그대로
                    false                     // 말투 다시 쓰기 끔 — 내장 역할은 비용을 늘리지 않는다
            ),

            new AgentSpec(
                    "planner",
                    "정리 도우미",
                    "🧹",
                    "밀린 일을 찾아 정리하고 마감을 다시 잡아드려요",
                    """
                    너는 밀린 할 일을 정리해 주는 도우미다.
                    - 먼저 현재 상태를 조회해 확인한 뒤 손대라. 확인 없이 바로 바꾸지 마라.
                    - 한 번에 너무 많이 바꾸지 말고, 무엇을 왜 바꾸는지 답변에 짧게 밝혀라.
                    - 지우는 것보다 미루거나 상태를 바꾸는 쪽을 먼저 제안하라.""",
                    Set.of("search_tasks", "update_task"),
                    false,
                    false
            ),

            new AgentSpec(
                    "capture",
                    "빠른 기록",
                    "⚡",
                    "말한 내용을 할 일로 빠르게 남겨드려요. 기존 할 일은 건드리지 않아요",
                    """
                    너는 들은 내용을 할 일로 옮겨 적는 도우미다.
                    - 새로 만드는 것에만 집중하라. 기존 할 일을 바꾸거나 지우지 마라.
                    - 정보가 조금 부족해도 제목이 분명하면 일단 만들어라. 마감은 비워도 된다.
                    - 여러 건이 언급되면 한 번에 나눠 담아라.""",
                    Set.of("create_task"),
                    false,
                    false
            ),

            new AgentSpec(
                    "review",
                    "점검 도우미",
                    "🔎",
                    "지금 상태를 살펴보고 알려드려요. 아무것도 바꾸지 않아요",
                    """
                    너는 현재 할 일 상태를 살펴보고 알려주는 도우미다.
                    - 조회만 한다. 만들거나 바꾸거나 지우지 마라.
                    - 단순 나열보다 "지금 급한 것"과 "밀린 것"을 구분해 알려줘라.
                    - 사용자가 변경을 요청하면, 직접 하지 말고 어떤 에이전트를 쓰면 되는지 안내하라.""",
                    Set.of("search_tasks"),
                    false,
                    false
            )
    );

    private static final Map<String, AgentSpec> BY_ID = AGENTS.stream()
            .collect(Collectors.toMap(AgentSpec::id, a -> a, (a, b) -> a, LinkedHashMap::new));

    public static List<AgentSpec> all() {
        return AGENTS;
    }

    /** 모르는 id 는 기본 에이전트로 — 잘못된 값 때문에 AI 가 아예 안 되면 안 된다. */
    public static AgentSpec find(String id) {
        if (id == null || id.isBlank()) return BY_ID.get(DEFAULT_ID);
        return BY_ID.getOrDefault(id, BY_ID.get(DEFAULT_ID));
    }
}
