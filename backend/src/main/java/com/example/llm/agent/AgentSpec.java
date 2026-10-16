package com.example.llm.agent;

import com.example.llm.tool.ToolRegistry;

import java.util.LinkedHashSet;
import java.util.Set;

/**
 * 에이전트 하나의 정의 — 지침 + 쓸 수 있는 도구.
 *
 * 왜 도구를 제한하는가: "무엇을 할 수 있는가"가 곧 **무엇을 망칠 수 있는가**다.
 * 조회만 하는 에이전트는 아무리 프롬프트가 꼬여도 데이터를 지울 수 없다. 지침(프롬프트)으로만
 * 막으면 LLM 이 어긋났을 때 그대로 실행된다 — 실제로 막으려면 실행 계층에서 걸러야 한다.
 *
 * @param id           클라이언트가 보내는 식별자
 * @param name         화면에 보일 이름
 * @param emoji        목록에서 눈에 띄게 — 아이콘 세트를 늘리지 않고 구분한다
 * @param description  이 에이전트가 무엇을 하는지 한 줄
 * @param instructions 시스템 프롬프트에 덧붙일 지침. 말투·우선순위·판단 기준을 정한다
 * @param allowedTools 쓸 수 있는 도구 이름. 비어 있으면 전체 허용
 * @param summarize    조회 결과를 한 줄로 요약할지. 켜면 LLM 호출이 한 번 더 든다
 * @param voice        답변 문장을 이 역할의 지침대로 다시 쓸지. 켜면 지침이 실제로 말투에 반영된다
 */
public record AgentSpec(
        String id,
        String name,
        String emoji,
        String description,
        String instructions,
        Set<String> allowedTools,
        boolean summarize,
        boolean voice
) {
    public AgentSpec {
        allowedTools = allowedTools == null ? Set.of() : new LinkedHashSet<>(allowedTools);
    }

    /** 도구를 쓸 수 있는가. 목록이 비어 있으면 제한 없음. */
    public boolean allows(String tool) {
        if (allowedTools.isEmpty()) return true;
        // 제어용(chat/need_more_info)은 언제나 허용 — 막으면 되묻기조차 못 한다
        if (!ToolRegistry.isAllowed(tool)) return false;
        if ("chat".equals(tool) || "need_more_info".equals(tool)) return true;
        return allowedTools.contains(tool);
    }

    /**
     * 데이터를 바꾸지 않는 에이전트인가.
     * 화면에 "아무것도 바꾸지 않아요"라고 알려주면 사용자가 마음 놓고 써볼 수 있다.
     */
    public boolean readOnly() {
        if (allowedTools.isEmpty()) return false;
        return allowedTools.stream().noneMatch(ToolRegistry::isMutating);
    }
}
