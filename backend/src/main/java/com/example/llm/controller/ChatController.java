package com.example.llm.controller;

import org.springframework.web.bind.annotation.PathVariable;

import org.springframework.web.bind.annotation.DeleteMapping;

import org.springframework.web.bind.annotation.PutMapping;

import org.springframework.web.bind.annotation.PostMapping;

import com.example.llm.agent.CustomAgentService;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;

import com.example.llm.agent.AgentRegistry;

import com.example.llm.service.ChatService;
import com.example.llm.util.WorkspaceHolder;
import com.example.todo.entity.Workspace;
import com.example.todo.service.WorkspaceResolver;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;
    private final WorkspaceResolver workspaceResolver;
    private final com.example.llm.service.AiUsageLimiter usageLimiter;
    private final com.example.llm.agent.AgentResolver agentResolver;
    private final com.example.llm.agent.CustomAgentService customAgentService;
    private final com.example.llm.service.AiScheduleService aiScheduleService;

    /** 서버가 받아들일 최대 턴 수. 클라이언트가 더 보내도 여기서 자른다. */
    private static final int MAX_HISTORY = 16;

    /**
     * 고를 수 있는 역할 목록.
     * 화면이 목록을 하드코딩하면 서버가 바뀔 때 조용히 어긋난다 — 없는 역할을 고르거나,
     * 새로 생긴 역할이 안 보이거나. 한 곳에서 내려준다.
     */
    @GetMapping("/agents")
    public ResponseEntity<List<Map<String, Object>>> agents(
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId,
            Authentication authentication) {
        Workspace ws = workspaceResolver.resolve(authentication.getName(), workspaceId);
        return ResponseEntity.ok(agentResolver.listFor(ws.getId()).stream()
                .map(a -> Map.<String, Object>of(
                        "id", a.id(),
                        "name", a.name(),
                        "emoji", a.emoji(),
                        "description", a.description(),
                        "readOnly", a.readOnly(),
                        "tools", a.allowedTools(),
                        "custom", a.id().startsWith("custom:"),
                        "summarize", a.summarize(),
                        "voice", a.voice(),
                        "instructions", a.instructions()
                ))
                .toList());
    }

    /** 역할 만들기. 워크스페이스 멤버면 만들 수 있다(팀이 함께 쓰는 자산이다). */
    @PostMapping("/agents")
    public ResponseEntity<Map<String, Object>> createAgent(
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId,
            Authentication authentication) {
        Workspace ws = workspaceResolver.resolve(authentication.getName(), workspaceId);
        var saved = customAgentService.create(ws.getId(), authentication.getName(),
                str(body.get("name")), str(body.get("emoji")), str(body.get("description")),
                str(body.get("instructions")), toolList(body.get("tools")),
                Boolean.TRUE.equals(body.get("summarize")), Boolean.TRUE.equals(body.get("voice")));
        return ResponseEntity.ok(Map.of("id", CustomAgentService.customId(saved.getId())));
    }

    @PutMapping("/agents/{id}")
    public ResponseEntity<Map<String, Object>> updateAgent(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId,
            Authentication authentication) {
        Workspace ws = workspaceResolver.resolve(authentication.getName(), workspaceId);
        var saved = customAgentService.update(id, ws.getId(),
                str(body.get("name")), str(body.get("emoji")), str(body.get("description")),
                str(body.get("instructions")), toolList(body.get("tools")),
                Boolean.TRUE.equals(body.get("summarize")), Boolean.TRUE.equals(body.get("voice")));
        return ResponseEntity.ok(Map.of("id", CustomAgentService.customId(saved.getId())));
    }

    @DeleteMapping("/agents/{id}")
    public ResponseEntity<Void> deleteAgent(
            @PathVariable Long id,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId,
            Authentication authentication) {
        Workspace ws = workspaceResolver.resolve(authentication.getName(), workspaceId);
        customAgentService.delete(id, ws.getId());
        return ResponseEntity.noContent().build();
    }

    private static String str(Object v) {
        return v == null ? "" : String.valueOf(v);
    }

    @SuppressWarnings("unchecked")
    private static List<String> toolList(Object v) {
        if (v instanceof List<?> l) {
            return l.stream().map(String::valueOf).toList();
        }
        return List.of();
    }

    // ── 예약 실행 ────────────────────────────────────────────────────────────
    // 역할을 시간에 걸어둔다. 결과는 알림으로 간다.
    // 예약은 **개인 것**이다 — 워크스페이스가 같아도 남의 예약은 보이지 않는다.

    @GetMapping("/schedules")
    public ResponseEntity<List<Map<String, Object>>> schedules(
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId,
            Authentication authentication) {
        Workspace ws = workspaceResolver.resolve(authentication.getName(), workspaceId);
        return ResponseEntity.ok(
                aiScheduleService.list(ws.getId(), authentication.getName()).stream()
                        .map(this::scheduleDto)
                        .toList());
    }

    @PostMapping("/schedules")
    public ResponseEntity<Map<String, Object>> createSchedule(
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId,
            Authentication authentication) {
        Workspace ws = workspaceResolver.resolve(authentication.getName(), workspaceId);
        var saved = aiScheduleService.create(ws.getId(), authentication.getName(),
                str(body.get("agentId")), str(body.get("prompt")),
                intOf(body.get("hour"), 8), intOf(body.get("minute"), 0),
                str(body.get("days")), !Boolean.FALSE.equals(body.get("enabled")));
        return ResponseEntity.ok(scheduleDto(saved));
    }

    @PutMapping("/schedules/{id}")
    public ResponseEntity<Map<String, Object>> updateSchedule(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId,
            Authentication authentication) {
        Workspace ws = workspaceResolver.resolve(authentication.getName(), workspaceId);
        var saved = aiScheduleService.update(id, ws.getId(), authentication.getName(),
                str(body.get("agentId")), str(body.get("prompt")),
                intOf(body.get("hour"), 8), intOf(body.get("minute"), 0),
                str(body.get("days")), !Boolean.FALSE.equals(body.get("enabled")));
        return ResponseEntity.ok(scheduleDto(saved));
    }

    @DeleteMapping("/schedules/{id}")
    public ResponseEntity<Void> deleteSchedule(
            @PathVariable Long id,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId,
            Authentication authentication) {
        Workspace ws = workspaceResolver.resolve(authentication.getName(), workspaceId);
        aiScheduleService.delete(id, ws.getId(), authentication.getName());
        return ResponseEntity.noContent().build();
    }

    private Map<String, Object> scheduleDto(com.example.todo.entity.AiSchedule s) {
        Map<String, Object> m = new java.util.LinkedHashMap<>();
        m.put("id", s.getId());
        m.put("agentId", s.getAgentId());
        m.put("prompt", s.getPrompt());
        m.put("hour", (int) s.getHour());
        m.put("minute", (int) s.getMinute());
        m.put("days", s.getDays());
        m.put("enabled", s.isEnabled());
        m.put("lastRunAt", s.getLastRunAt());
        return m;
    }

    /** 숫자로 안 오는 경우(문자열 "8")까지 받아준다 — 클라이언트마다 직렬화가 다르다. */
    private static int intOf(Object v, int fallback) {
        if (v instanceof Number n) return n.intValue();
        try {
            return Integer.parseInt(String.valueOf(v).trim());
        } catch (RuntimeException e) {
            return fallback;
        }
    }

    /** 오늘 AI 사용량. 대화를 시작하기 전에도 남은 횟수를 보여주려면 필요하다. */
    @GetMapping("/usage")
    public ResponseEntity<Map<String, Object>> usage(Authentication authentication) {
        var u = usageLimiter.peek(authentication.getName());
        return ResponseEntity.ok(Map.of(
                "used", u.used(),
                "limit", u.limit(),
                "remaining", u.limit() <= 0 ? -1 : u.remaining()));
    }

    @SuppressWarnings("unchecked")
    @PostMapping("/service")
    public ResponseEntity<Map<String, Object>> chat(
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId,
            Authentication authentication
    ) {
        String userEmail = authentication.getName();
        Workspace workspace = workspaceResolver.resolve(userEmail, workspaceId);

        try {
            WorkspaceHolder.set(workspace.getId());

            String message = (String) body.getOrDefault("message", "");
            Map<String, Object> context = new java.util.LinkedHashMap<>(
                    (Map<String, Object>) body.getOrDefault("context", Map.of()));
            // 어떤 역할로 대화하는지. 없으면 기본 에이전트(예전과 동일 동작).
            /* 최근 대화. 클라이언트가 갖고 있는 것을 매 요청에 실어 보낸다 —
               서버에 대화를 저장하지 않기로 한 판단(chatHistory.js 주석)을 지키면서
               맥락만 얻는 방법이다. 여기서 크기를 한 번 자른다: 클라이언트를 믿고
               통째로 프롬프트에 넣으면 토큰이 마음대로 늘어난다. */
            Object history = body.get("history");
            if (history instanceof List<?> h && !h.isEmpty()) {
                context.put("history", h.size() > MAX_HISTORY ? h.subList(h.size() - MAX_HISTORY, h.size()) : h);
            }

            Object agentId = body.get("agentId");
            if (agentId != null) context.put("agentId", String.valueOf(agentId));

            Map<String, Object> res = new java.util.LinkedHashMap<>(chatService.handle(message, context));
            // 남은 횟수를 함께 내려준다 — 화면이 "N/M" 을 그려 사용자가 아껴 쓸 수 있게.
            // 매번 조회 한 번이 늘지만, 상한에 걸리고 나서야 아는 것보다 낫다.
            var usage = usageLimiter.peek(userEmail);
            res.put("usage", Map.of(
                    "used", usage.used(),
                    "limit", usage.limit(),
                    "remaining", usage.limit() <= 0 ? -1 : usage.remaining()));
            return ResponseEntity.ok(res);
        } finally {
            WorkspaceHolder.clear();
        }
    }
}
