package com.example.todo.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final com.example.todo.service.UserActivityService userActivityService;

    private final JwtTokenProvider jwtTokenProvider;

    private final com.example.todo.repository.UserRepository userRepository;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        String token = resolveToken(request);
        if (token != null && jwtTokenProvider.validateToken(token)) {
            String email = jwtTokenProvider.getEmailFromToken(token);

            // 탈퇴한 계정은 이미 발급된 토큰으로도 들어올 수 없어야 한다.
            //
            // 토큰 검증은 서명·만료만 본다. 그래서 DB를 보지 않으면 탈퇴 후에도
            // 남은 유효기간(jwt.expiration-days=7) 동안 세션이 살아 있었다.
            // 인증을 세우지 않고 그냥 통과시키면 보호된 엔드포인트는 401,
            // permitAll 엔드포인트는 익명으로 처리된다 — fail-closed.
            if (!userRepository.existsActiveByEmail(email)) {
                // 운영자가 정지한 계정은 이유를 알려 준다. 401 이면 앱이 "다시 로그인"만 반복한다.
                if (userRepository.existsSuspendedByEmail(email)) {
                    response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                    response.setContentType("application/json;charset=UTF-8");
                    response.getWriter().write("{\"message\":\"운영 정책 위반으로 이용이 정지된 계정이에요.\",\"code\":\"SUSPENDED\"}");
                    return;
                }
                filterChain.doFilter(request, response);
                return;
            }

            UsernamePasswordAuthenticationToken authToken =
                    new UsernamePasswordAuthenticationToken(email, null,
                            java.util.List.of(new SimpleGrantedAuthority("ROLE_USER")));
            authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

            SecurityContextHolder.getContext().setAuthentication(authToken);
            // 마지막 활동 시각 기록(3분 스로틀). 실패해도 요청은 그대로 진행된다.
            userActivityService.touch(email);
        }

        filterChain.doFilter(request, response);
    }

    private String resolveToken(HttpServletRequest request) {
        String bearer = request.getHeader("Authorization");
        if (bearer != null && bearer.startsWith("Bearer ")) {
            return bearer.substring(7);
        }
        return null;
    }
}
