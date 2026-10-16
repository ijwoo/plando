package com.example.todo.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1)
public class RateLimitFilter extends OncePerRequestFilter {

    private final com.example.todo.security.JwtTokenProvider jwtTokenProvider;

    public RateLimitFilter(com.example.todo.security.JwtTokenProvider jwtTokenProvider) {
        this.jwtTokenProvider = jwtTokenProvider;
    }

    private static final int MAX_REQUESTS = 10;
    /** LLM 호출 경로는 요청당 비용이 발생한다 — 분당 한도를 훨씬 낮게 잡는다. */
    private static final int MAX_AI_REQUESTS = 6;
    private static final long WINDOW_MS = 60_000;
    /** 윈도가 지난 항목을 정리하는 주기 — 정리 없이는 맵이 무한히 커진다. */
    private static final long SWEEP_MS = 5 * 60_000;

    private final Map<String, RateWindow> windows = new ConcurrentHashMap<>();
    private volatile long lastSweep = System.currentTimeMillis();

    /** 인증 없이 접근 가능한 경로 — 여기서는 IP 기준으로 셀 수밖에 없다. */
    private static boolean isAuthPath(String path) {
        return path.startsWith("/api/auth/login")
                || path.startsWith("/api/auth/signup")
                || path.startsWith("/api/auth/forgot-password")
                || path.startsWith("/api/auth/reset-password")
                || path.startsWith("/api/auth/guest");
    }

    /**
     * LLM을 호출하는 경로 — 호출마다 토큰 비용이 나가므로 반드시 사용자별 한도가 필요하다.
     * 예전엔 인증 경로 5개에만 리밋이 걸려 있어서, 로그인한 사용자는 AI 채팅·DM 추출·주간 랩을
     * 무제한으로 호출할 수 있었다(주간 랩의 refresh=true는 캐시를 지워 매번 재과금).
     *
     * **`/api/chat/**` 전체가 아니라 실제로 부르는 경로만** 센다. 역할·예약·사용량은 DB만
     * 읽는데도 같은 통에 담겨 있었다. AI 화면을 열면 역할+사용량 2건, 예약 시트를 열면 1건,
     * 저장·삭제마다 1건씩 나가므로 분당 6이 금방 찬다. 실제로 예약을 지운 직후 목록 조회가
     * 429 로 막혀 **"예약이 하나도 없다"** 로 보이는 일이 있었다(2026-08-22). 값이 나가지
     * 않는 요청을 비용 한도로 막을 이유가 없다.
     */
    private static boolean isAiPath(String path) {
        return path.startsWith("/api/chat/service")
                || path.startsWith("/api/wrap")
                || (path.startsWith("/api/dm/rooms/") && path.endsWith("/extract"));
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return !(isAuthPath(path) || isAiPath(path));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String path = request.getRequestURI();
        boolean ai = isAiPath(path);
        // AI 경로는 로그인 사용자 기준으로 센다. IP 기준이면 X-Forwarded-For 위조로 우회된다.
        String principal = ai ? currentUser(request) : getClientIp(request);
        String key = principal + ":" + (ai ? "AI" : path);
        int limit = ai ? MAX_AI_REQUESTS : MAX_REQUESTS;

        sweepIfDue();

        RateWindow window = windows.compute(key, (k, existing) -> {
            long now = System.currentTimeMillis();
            if (existing == null || now - existing.startTime > WINDOW_MS) {
                return new RateWindow(now, new AtomicInteger(1));
            }
            existing.count.incrementAndGet();
            return existing;
        });

        if (window.count.get() > limit) {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"message\":\"요청이 너무 많습니다. 잠시 후 다시 시도해주세요.\"}");
            return;
        }

        filterChain.doFilter(request, response);
    }

    /**
     * 인증 주체(이메일). 미인증이면 IP로 폴백.
     *
     * SecurityContextHolder를 쓰지 않는다 — 이 필터는 HIGHEST_PRECEDENCE라 Security 필터 체인보다
     * 먼저 돌기 때문에 그 시점엔 컨텍스트가 비어 있다. Authorization 헤더에서 직접 해석한다.
     */
    private String currentUser(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7);
            try {
                if (jwtTokenProvider.validateToken(token)) {
                    String email = jwtTokenProvider.getEmailFromToken(token);
                    if (email != null && !email.isBlank()) return "u:" + email;
                }
            } catch (Exception ignored) {
                // 토큰이 깨졌으면 어차피 뒤에서 401 — 여기선 IP 기준으로 세고 넘긴다
            }
        }
        return getClientIp(request);
    }

    /** 만료된 윈도 제거 — 없으면 맵이 계속 자란다(메모리 2GB 인스턴스라 실제로 문제가 된다). */
    private void sweepIfDue() {
        long now = System.currentTimeMillis();
        if (now - lastSweep < SWEEP_MS) return;
        lastSweep = now;
        windows.entrySet().removeIf(e -> now - e.getValue().startTime > WINDOW_MS);
    }

    private String getClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private static class RateWindow {
        final long startTime;
        final AtomicInteger count;

        RateWindow(long startTime, AtomicInteger count) {
            this.startTime = startTime;
            this.count = count;
        }
    }
}
