package com.example.todo.config;

import com.example.todo.entity.User;
import com.example.todo.exception.ApiException;
import com.example.todo.repository.UserRepository;
import com.example.todo.security.JwtTokenProvider;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * /api/admin/** (인증 단계인 /api/admin/auth/** 제외)의 문지기. 세 가지가 모두 맞아야 통과한다.
 *
 *  1. 일반 JWT 로 로그인한 사람이 DB 에서 지금 ADMIN 이다 (토큰이 아니라 DB 를 본다 — 권한을 내리면 즉시 적용)
 *  2. OTP 등록을 마쳤다
 *  3. X-Admin-Token(OTP 확인 뒤 받은 30분 토큰)이 유효하고, 그 주인이 1 의 사람과 같다
 *
 * 관리자가 아니면 404 — 관리자 기능의 존재를 알리지 않는다. 관리자인데 토큰만 없으면 403 + code 로
 * 화면이 OTP 입력으로 돌아가게 한다.
 */
@Component
@RequiredArgsConstructor
public class AdminAccessInterceptor implements HandlerInterceptor {

    public static final String ADMIN_ATTR = "plando.adminUser";
    public static final String HEADER = "X-Admin-Token";

    private final UserRepository userRepo;
    private final JwtTokenProvider jwtTokenProvider;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String email = auth != null ? auth.getName() : null;
        User admin = email == null ? null : userRepo.findActiveByEmail(email)
                .filter(User::isAdmin)
                .filter(u -> !u.isSuspended())
                .orElse(null);
        if (admin == null) throw new ApiException(404, "페이지를 찾을 수 없어요.");
        if (admin.getAdminTotpEnabledAt() == null) throw new AdminStepUpRequired("OTP 등록부터 해 주세요.");

        String tokenEmail = jwtTokenProvider.getAdminEmail(request.getHeader(HEADER));
        if (tokenEmail == null || !tokenEmail.equals(admin.getEmail())) {
            throw new AdminStepUpRequired("관리자 인증이 만료됐어요. OTP 를 다시 입력해 주세요.");
        }
        request.setAttribute(ADMIN_ATTR, admin);
        return true;
    }

    /** 403 + code=ADMIN_STEP_UP — 화면이 이 code 를 보고 OTP 입력으로 간다. */
    public static class AdminStepUpRequired extends ApiException {
        public AdminStepUpRequired(String message) {
            super(403, message);
        }
    }
}
