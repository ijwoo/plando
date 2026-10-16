package com.example.todo.config;

import com.example.todo.oauth2.CustomOAuth2UserService;
import com.example.todo.oauth2.OAuth2FailureHandler;
import com.example.todo.oauth2.OAuth2SuccessHandler;
import com.example.todo.security.JwtAuthenticationFilter;
import com.example.todo.security.JwtTokenProvider;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtTokenProvider jwtTokenProvider;
    private final com.example.todo.service.UserActivityService userActivityService;
    /** JWT 필터가 탈퇴 계정을 걸러내기 위해 쓴다. */
    private final com.example.todo.repository.UserRepository userRepository;
    private final CustomOAuth2UserService customOAuth2UserService;
    private final OAuth2SuccessHandler oAuth2SuccessHandler;
    private final OAuth2FailureHandler oAuth2FailureHandler;

    @Value("${app.cors.allowed-origins}")
    private String allowedOrigins;

    @Value("${spring.profiles.active:dev}")
    private String activeProfile;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public OAuth2AuthorizationRequestResolver authorizationRequestResolver(
            ClientRegistrationRepository repo) {
        DefaultOAuth2AuthorizationRequestResolver delegate =
                new DefaultOAuth2AuthorizationRequestResolver(repo, "/oauth2/authorization");
        return new OAuth2AuthorizationRequestResolver() {
            @Override
            public OAuth2AuthorizationRequest resolve(HttpServletRequest request) {
                return capturePlatform(delegate.resolve(request), request);
            }
            @Override
            public OAuth2AuthorizationRequest resolve(HttpServletRequest request, String clientRegistrationId) {
                return capturePlatform(delegate.resolve(request, clientRegistrationId), request);
            }
            private OAuth2AuthorizationRequest capturePlatform(
                    OAuth2AuthorizationRequest req, HttpServletRequest request) {
                if (req == null) return null;
                String platform = request.getParameter("platform");
                if (platform != null && !platform.isBlank()) {
                    request.getSession(true).setAttribute("oauth_platform", platform);
                }
                return req;
            }
        };
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http,
                                           OAuth2AuthorizationRequestResolver authorizationRequestResolver) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(csrf -> csrf.disable())
                .formLogin(form -> form.disable())
                .httpBasic(httpBasic -> httpBasic.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                        // 블로그 공개 데모 — 정확히 이 경로 하나만 무인증. (/api/** 인증 규칙보다 먼저 매칭)
                        .requestMatchers(HttpMethod.POST, "/api/public/assistant/demo").permitAll()

                        // 정적 리소스
                        .requestMatchers(
                                "/",
                                "/index.html",
                                "/favicon.ico",
                                "/icon.ico",
                                "/manifest.webmanifest",
                                "/vite.svg",
                                "/assets/**",
                                "/icons/**",
                                "/uploads/**",
                                "/*.png",
                                "/*.jpg",
                                "/*.jpeg",
                                "/*.svg",
                                "/*.css",
                                "/*.js",
                                "/error"
                        ).permitAll()

                        // 인증 필요 API (auth 하위지만 보호 필요)
                        .requestMatchers("/api/auth/me").authenticated()
                        // 재발송은 본인만 — 아래 /api/auth/** permitAll 보다 먼저 와야 한다.
                        // (permitAll 로 열리면 authentication 이 null 이라 NPE 가 난다.)
                        .requestMatchers("/api/auth/verify-email/resend").authenticated()

                        // 공개 API
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers("/api/chat", "/api/chat/**").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/recruitments", "/api/recruitments/*").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/users/*/qa-stats").permitAll()

                        // WebSocket
                        .requestMatchers("/ws/**").permitAll()

                        // OAuth2 엔드포인트
                        .requestMatchers("/oauth2/**", "/login/oauth2/**").permitAll()

                        // API는 인증 필요
                        .requestMatchers("/api/**").authenticated()

                        // 프론트 라우트 허용
                        .anyRequest().permitAll()
                )
                .oauth2Login(oauth2 -> oauth2
                        .authorizationEndpoint(endpoint -> endpoint
                                .authorizationRequestResolver(authorizationRequestResolver))
                        .userInfoEndpoint(userInfo -> userInfo
                                .userService(customOAuth2UserService))
                        .successHandler(oAuth2SuccessHandler)
                        .failureHandler(oAuth2FailureHandler)
                )
                .addFilterBefore(
                        new JwtAuthenticationFilter(userActivityService, jwtTokenProvider, userRepository),
                        UsernamePasswordAuthenticationFilter.class
                );

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();

        List<String> origins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .collect(java.util.stream.Collectors.toCollection(java.util.ArrayList::new));
        if (!"prod".equals(activeProfile)) {
            origins.add("http://127.0.0.1:*");
            origins.add("http://localhost:*");
            origins.add("http://192.168.*");
            origins.add("http://10.*");
            origins.add("http://100.*");
        }
        config.setAllowedOriginPatterns(origins);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}