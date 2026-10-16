package com.example.llm.agent;

import com.example.llm.tool.ToolRegistry;
import com.example.todo.entity.CustomAgent;
import com.example.todo.exception.ApiException;
import com.example.todo.repository.CustomAgentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 워크스페이스가 직접 만든 AI 역할.
 *
 * 내장 역할(AgentRegistry)과 합쳐 한 목록으로 내려간다. 화면은 둘을 구분할 필요가 없고,
 * 도구 제한도 같은 방식으로 걸린다.
 */
@Service
@RequiredArgsConstructor
public class CustomAgentService {

    /** 한 워크스페이스가 만들 수 있는 최대 개수. 목록이 길어지면 고르는 것 자체가 일이 된다. */
    private static final int MAX_PER_WORKSPACE = 12;

    private static final int MAX_NAME = 40;
    private static final int MAX_DESC = 120;
    /** 지침이 길수록 매 호출 토큰이 늘어난다 — 비용이 직접 늘기 때문에 상한을 둔다. */
    private static final int MAX_INSTRUCTIONS = 1200;

    private final CustomAgentRepository repository;

    @Transactional(readOnly = true)
    public List<AgentSpec> specsOf(Long workspaceId) {
        if (workspaceId == null) return List.of();
        return repository.findByWorkspaceIdOrderByIdAsc(workspaceId).stream()
                .map(CustomAgentService::toSpec)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CustomAgent> listOf(Long workspaceId) {
        if (workspaceId == null) return List.of();
        return repository.findByWorkspaceIdOrderByIdAsc(workspaceId);
    }

    @Transactional
    public CustomAgent create(Long workspaceId, String createdBy,
                              String name, String emoji, String description,
                              String instructions, List<String> tools, boolean summarize, boolean voice) {
        if (repository.countByWorkspaceId(workspaceId) >= MAX_PER_WORKSPACE) {
            throw new ApiException(400, "역할은 워크스페이스당 " + MAX_PER_WORKSPACE + "개까지 만들 수 있어요.");
        }
        CustomAgent agent = new CustomAgent(workspaceId, createdBy);
        agent.apply(validName(name), validEmoji(emoji), trim(description, MAX_DESC),
                trim(instructions, MAX_INSTRUCTIONS), validTools(tools), summarize, voice);
        return repository.save(agent);
    }

    @Transactional
    public CustomAgent update(Long id, Long workspaceId,
                              String name, String emoji, String description,
                              String instructions, List<String> tools, boolean summarize, boolean voice) {
        CustomAgent agent = repository.findByIdAndWorkspaceId(id, workspaceId)
                .orElseThrow(() -> new ApiException(404, "역할을 찾을 수 없어요."));
        agent.apply(validName(name), validEmoji(emoji), trim(description, MAX_DESC),
                trim(instructions, MAX_INSTRUCTIONS), validTools(tools), summarize, voice);
        return repository.save(agent);
    }

    @Transactional
    public void delete(Long id, Long workspaceId) {
        CustomAgent agent = repository.findByIdAndWorkspaceId(id, workspaceId)
                .orElseThrow(() -> new ApiException(404, "역할을 찾을 수 없어요."));
        repository.delete(agent);
    }

    // ── 검증 ────────────────────────────────────────────────────────────────

    private static String validName(String name) {
        String v = name == null ? "" : name.trim();
        if (v.isBlank()) throw new ApiException(400, "역할 이름을 입력해 주세요.");
        return v.length() > MAX_NAME ? v.substring(0, MAX_NAME) : v;
    }

    /** 이모지는 장식이라 없어도 된다. 다만 길면 목록 정렬이 깨지므로 잘라낸다. */
    private static String validEmoji(String emoji) {
        String v = emoji == null ? "" : emoji.trim();
        if (v.isBlank()) return "🤖";
        return v.length() > 4 ? v.substring(0, 4) : v;
    }

    /**
     * 도구 이름 검증.
     *
     * **모르는 이름은 조용히 버리지 않고 거절한다.** 오타 하나로 "조회만 하는 역할"이
     * 아무 제한 없는 역할이 되면(빈 목록 = 제한 없음) 사용자는 그걸 알 방법이 없다.
     */
    private static String validTools(List<String> tools) {
        if (tools == null || tools.isEmpty()) return "";
        Set<String> valid = new LinkedHashSet<>();
        for (String t : tools) {
            String name = t == null ? "" : t.trim();
            if (name.isEmpty()) continue;
            if (!ToolRegistry.isAllowed(name)) {
                throw new ApiException(400, "알 수 없는 도구예요: " + name);
            }
            valid.add(name);
        }
        return String.join(",", valid);
    }

    private static String trim(String v, int max) {
        if (v == null) return "";
        String t = v.trim();
        return t.length() > max ? t.substring(0, max) : t;
    }

    // ── 변환 ────────────────────────────────────────────────────────────────

    /** 저장된 역할 → 실행에 쓰는 정의. id 는 "custom:{id}" 로 내장과 겹치지 않게 한다. */
    public static AgentSpec toSpec(CustomAgent a) {
        Set<String> tools = (a.getAllowedTools() == null || a.getAllowedTools().isBlank())
                ? Set.of()
                : Arrays.stream(a.getAllowedTools().split(","))
                        .map(String::trim).filter(s -> !s.isEmpty())
                        .collect(Collectors.toCollection(LinkedHashSet::new));
        return new AgentSpec(
                customId(a.getId()),
                a.getName(),
                a.getEmoji() == null ? "🤖" : a.getEmoji(),
                a.getDescription() == null ? "" : a.getDescription(),
                a.getInstructions() == null ? "" : a.getInstructions(),
                tools,
                a.isSummarize(),
                a.isVoice()
        );
    }

    public static String customId(Long id) {
        return "custom:" + id;
    }
}
