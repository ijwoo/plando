package com.example.todo.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.Date;

@Component
public class JwtTokenProvider {

    @Value("${jwt.secret}")
    private String secret;

    @Value("${jwt.expiration-days:7}")
    private long expirationDays;

    private Key secretKey;
    /**
     * 관리자 토큰 전용 키. 일반 키와 다르게 서명해서, 관리자 토큰을 일반 Bearer 로 쓰거나
     * 일반 토큰을 관리자 토큰으로 쓰는 일이 서명 단계에서 실패하게 한다.
     */
    private Key adminKey;
    private long expirationTime;

    /** 관리자 토큰 수명 — OTP 를 한 번 확인하면 이만큼 관리자 화면을 쓴다. */
    public static final long ADMIN_TOKEN_MINUTES = 30;

    @PostConstruct
    public void init() {
        this.secretKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.adminKey = Keys.hmacShaKeyFor((secret + ":admin-step-up").getBytes(StandardCharsets.UTF_8));
        this.expirationTime = 1000L * 60 * 60 * 24 * expirationDays;
    }

    // 토큰 생성
    public String createToken(String email) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + expirationTime);

        return Jwts.builder()
                .setSubject(email)
                .setIssuedAt(now)
                .setExpiration(expiry)
                .signWith(secretKey, SignatureAlgorithm.HS256)
                .compact();
    }

    // 토큰에서 이메일 추출
    public String getEmailFromToken(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(secretKey)
                .build()
                .parseClaimsJws(token)
                .getBody()
                .getSubject();
    }

    // 토큰 유효성 검사
    public boolean validateToken(String token) {
        try {
            Jwts.parserBuilder()
                    .setSigningKey(secretKey)
                    .build()
                    .parseClaimsJws(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    // ── 관리자 토큰 (OTP 확인 뒤 발급, 30분) ─────────────────────────

    public String createAdminToken(String email) {
        Date now = new Date();
        return Jwts.builder()
                .setSubject(email)
                .claim("typ", "admin")
                .setIssuedAt(now)
                .setExpiration(new Date(now.getTime() + ADMIN_TOKEN_MINUTES * 60_000))
                .signWith(adminKey, SignatureAlgorithm.HS256)
                .compact();
    }

    /** 관리자 토큰이 유효하면 이메일, 아니면 null. */
    public String getAdminEmail(String token) {
        if (token == null || token.isBlank()) return null;
        try {
            var body = Jwts.parserBuilder().setSigningKey(adminKey).build().parseClaimsJws(token).getBody();
            return "admin".equals(body.get("typ")) ? body.getSubject() : null;
        } catch (JwtException | IllegalArgumentException e) {
            return null;
        }
    }
}
