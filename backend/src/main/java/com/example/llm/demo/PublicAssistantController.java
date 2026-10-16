package com.example.llm.demo;

import com.example.llm.service.ChatService;
import com.example.llm.util.WorkspaceHolder;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 블로그(imjaewoo.dev) 공개 데모용 무인증 AI 어시스턴트 엔드포인트.
 *
 * 격리·안전:
 *  - 경로 {@code POST /api/public/assistant/demo} 하나만 permitAll(SecurityConfig).
 *  - 피처 플래그 off / 미시드 시 503(데모만 비활성, 실서비스 무관).
 *  - 입력 길이 상한 + IP 레이트리밋 + 전역 일일예산 킬스위치 + LLM 토큰 하드캡.
 *  - WorkspaceHolder를 '데모 워크스페이스'로만 세팅 후 반드시 clear — 실유저 워크스페이스 접근 0.
 *  - ChatService.demoHandle 은 초안(create) 경로만 재사용, DB write 0.
 *
 * 응답 형태는 {@code POST /api/chat/service} 와 동일: {@code { assistantMessage, actions[] }}.
 */
@Slf4j
@RestController
@RequestMapping("/api/public/assistant")
@RequiredArgsConstructor
public class PublicAssistantController {

    private final ChatService chatService;
    private final DemoAssistantSeeder seeder;
    private final DemoRateLimiter rateLimiter;

    @Value("${demo.assistant.enabled:false}")
    private boolean enabled;
    @Value("${demo.assistant.max-tokens:400}")
    private int maxTokens;
    @Value("${demo.assistant.max-message-length:300}")
    private int maxMessageLength;

    @PostMapping("/demo")
    public ResponseEntity<Map<String, Object>> demo(@RequestBody(required = false) Map<String, String> body,
                                                    HttpServletRequest request) {
        if (!enabled || seeder.getWorkspaceId() == null) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(info("데모가 현재 비활성화되어 있어요."));
        }

        String message = body == null ? null : body.get("message");
        if (message == null || message.isBlank()) {
            return ResponseEntity.badRequest().body(info("메시지를 입력해주세요."));
        }
        if (message.length() > maxMessageLength) {
            return ResponseEntity.badRequest()
                    .body(info("메시지가 너무 길어요. " + maxMessageLength + "자 이하로 입력해주세요."));
        }

        String ip = clientIp(request);
        DemoRateLimiter.Verdict verdict = rateLimiter.check(ip);
        if (verdict == DemoRateLimiter.Verdict.RATE_LIMITED) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(info("잠깐요 — 데모 체험 요청이 너무 많아요. 잠시 후 다시 시도해주세요."));
        }
        if (verdict == DemoRateLimiter.Verdict.BUDGET_EXCEEDED) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(info("오늘 데모 체험이 마감됐어요. 내일 다시 와주세요."));
        }

        try {
            WorkspaceHolder.set(seeder.getWorkspaceId());
            return ResponseEntity.ok(chatService.demoHandle(message, maxTokens));
        } catch (Exception e) {
            log.warn("[DemoAssistant] 처리 실패 ip={} msg={}", ip, abbreviate(message), e);
            return ResponseEntity.ok(info("지금은 처리할 수 없어요. 잠시 후 다시 시도해주세요."));
        } finally {
            WorkspaceHolder.clear();
        }
    }

    private static Map<String, Object> info(String msg) {
        return Map.of("assistantMessage", msg, "actions", List.of());
    }

    /** 프록시(nginx) 뒤이므로 X-Forwarded-For 첫 홉 우선, 없으면 remoteAddr. */
    private static String clientIp(HttpServletRequest req) {
        String xff = req.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) return xff.split(",")[0].trim();
        return req.getRemoteAddr();
    }

    private static String abbreviate(String s) {
        return s == null ? "" : (s.length() > 60 ? s.substring(0, 60) + "…" : s);
    }
}
