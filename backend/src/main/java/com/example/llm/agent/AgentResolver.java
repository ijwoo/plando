package com.example.llm.agent;

import com.example.llm.util.WorkspaceHolder;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * 역할 해석 — 내장과 사용자 정의를 한 곳에서 찾는다.
 *
 * 해석이 여러 곳에 흩어지면 한쪽만 사용자 정의를 알게 돼서, **역할을 만들었는데 지침이
 * 안 먹거나 도구 제한이 안 걸리는** 상태가 된다. 둘 다 여기를 거치게 한다.
 */
@Service
@RequiredArgsConstructor
public class AgentResolver {

    private static final Logger log = LoggerFactory.getLogger(AgentResolver.class);
    private static final String CUSTOM_PREFIX = "custom:";

    private final CustomAgentService customAgents;

    /**
     * 역할을 찾는다. 모르는 id 는 기본으로 떨어뜨린다 —
     * 잘못된 값 때문에 AI 가 아예 안 되는 것보다 낫다.
     */
    public AgentSpec resolve(String agentId) {
        if (agentId == null || agentId.isBlank()) return AgentRegistry.find(null);

        if (agentId.startsWith(CUSTOM_PREFIX)) {
            Long wsId = WorkspaceHolder.get();
            Long id = parseId(agentId.substring(CUSTOM_PREFIX.length()));
            if (wsId != null && id != null) {
                // 워크스페이스로 한정해 찾는다 — 남의 워크스페이스 역할을 쓰면 안 된다
                for (AgentSpec spec : customAgents.specsOf(wsId)) {
                    if (spec.id().equals(agentId)) return spec;
                }
            }
            log.info("[Agent] 사용자 정의 역할을 찾지 못해 기본으로 대체: {}", agentId);
            return AgentRegistry.find(null);
        }
        return AgentRegistry.find(agentId);
    }

    /** 화면에 보여줄 전체 목록 — 내장 + 이 워크스페이스의 사용자 정의. */
    public List<AgentSpec> listFor(Long workspaceId) {
        List<AgentSpec> all = new ArrayList<>(AgentRegistry.all());
        all.addAll(customAgents.specsOf(workspaceId));
        return all;
    }

    private static Long parseId(String raw) {
        try {
            return Long.parseLong(raw);
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
