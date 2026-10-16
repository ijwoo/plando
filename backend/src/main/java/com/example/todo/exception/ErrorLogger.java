package com.example.todo.exception;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/**
 * 서버 오류를 한 줄 규격으로 남긴다.
 *
 * 왜 별도로 두는가: Sentry 는 DSN 이 설정되기 전까지 아무것도 수집하지 않는다. 그런데 "프로덕션에서
 * 뭐가 깨져도 알 방법이 없다"는 문제는 지금 당장의 문제다. 그래서 외부 서비스와 무관하게,
 * 무슨 요청이 누구에게서 어떻게 실패했는지를 로그로 남겨 둔다.
 *
 * 로그 규격을 한 곳에 모아 두는 이유는 나중에 `grep '\[ERR\]' app-*.log` 한 줄로 훑기 위해서다.
 * 예전에는 예외가 컨트롤러마다 제각각 catch 되어 어떤 건 삼켜지고 어떤 건 원문이 사용자에게
 * 새어 나갔다(SQL·제약 이름까지 노출된 사례가 있었다).
 */
@Component
public class ErrorLogger {

    private static final Logger log = LoggerFactory.getLogger("com.example.todo.ERROR");

    /**
     * @param level  WARN(사용자 입력 문제) / ERROR(서버 결함) 구분 — 뒤섞이면 잡음이 되어 안 보게 된다.
     */
    public void record(HttpServletRequest req, Throwable e, int status, boolean serverFault) {
        String who = currentUser();
        String path = req != null ? req.getMethod() + " " + req.getRequestURI() : "-";
        String ws = req != null ? String.valueOf(req.getHeader("X-Workspace-Id")) : "-";
        String msg = String.format("[ERR] status=%d %s user=%s ws=%s type=%s",
                status, path, who, ws, e.getClass().getSimpleName());
        if (serverFault) {
            log.error(msg, e);          // 스택까지 — 원인 추적이 필요한 것
        } else {
            log.warn("{} msg={}", msg, e.getMessage());   // 스택 없이 한 줄 — 입력 오류는 양이 많다
        }
    }

    private String currentUser() {
        try {
            Authentication a = SecurityContextHolder.getContext().getAuthentication();
            return a != null && a.getName() != null ? a.getName() : "anon";
        } catch (Exception ignored) {
            return "?";
        }
    }
}
