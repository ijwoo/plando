package com.example.todo.service;

import com.example.todo.dto.LoginResponseDto;
import com.example.todo.entity.OAuthProvider;
import com.example.todo.entity.User;
import com.example.todo.repository.UserRepository;
import com.example.todo.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class AppleAuthService {

    private static final String APPLE_JWKS_URI = "https://appleid.apple.com/auth/keys";
    private static final String APPLE_ISSUER   = "https://appleid.apple.com";

    @Value("${app.apple.bundle-id:com.imjaewoo.plando}")
    private String bundleId;

    private final UserRepository userRepository;
    private final JwtTokenProvider jwtTokenProvider;
    private final UserSettingsService userSettingsService;

    public LoginResponseDto authenticate(String identityToken, String firstName, String lastName) {
        // 1. Apple 공개 키로 JWT 검증
        Jwt jwt = verifyIdentityToken(identityToken);

        String appleId = jwt.getSubject();
        String email   = jwt.getClaimAsString("email");

        boolean[] isNewUser = { false };

        // 2. appleId로 기존 유저 조회
        User user = userRepository.findByAppleId(appleId)
                // 탈퇴 계정은 없는 것으로 본다. 탈퇴 시 apple_id 를 NULL 로 만들므로 보통은
                // 여기 걸리지 않지만, 익명화가 부분 실패해도 계정이 되살아나지 않게 이중으로 막는다.
                .filter(u -> !u.isDeleted())
                .map(existing -> {
            // Apple이 첫 로그인 후엔 이름 안 보내지만, 받았는데 기존 이름이 default("Apple 사용자")면 update
            if ((firstName != null || lastName != null) && "Apple 사용자".equals(existing.getName())) {
                String updated = buildName(firstName, lastName);
                if (!"Apple 사용자".equals(updated)) {
                    existing.setName(updated);
                    return userRepository.save(existing);
                }
            }
            return existing;
        }).orElseGet(() -> {
            // 3. 이메일로 기존 유저 조회
            if (email != null) {
                return userRepository.findActiveByEmail(email).map(existing -> {
                    // 이미 비밀번호가 설정된 로컬 계정이면 자동 연결하지 않음 (계정 탈취 방지)
                    if (existing.getPassword() != null) {
                        throw new com.example.todo.exception.ApiException(409, "이미 해당 이메일로 가입된 계정이 있습니다. 기존 계정으로 로그인해주세요.");
                    }
                    existing.setAppleId(appleId);
                    return userRepository.save(existing);
                }).orElseGet(() -> {
                    isNewUser[0] = true;
                    return createAppleUser(appleId, email, firstName, lastName);
                });
            }
            isNewUser[0] = true;
            return createAppleUser(appleId, email, firstName, lastName);
        });

        if (user.isSuspended()) {
            throw new com.example.todo.exception.ApiException(403, "운영 정책 위반으로 이용이 정지된 계정이에요.");
        }
        String token = jwtTokenProvider.createToken(user.getEmail());
        return new LoginResponseDto(token, user.getName(), user.getEmail(), user.getId(), isNewUser[0]);
    }

    private Jwt verifyIdentityToken(String identityToken) {
        try {
            NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(APPLE_JWKS_URI).build();
            Jwt jwt = decoder.decode(identityToken);

            // iss, aud 검증
            String iss = jwt.getClaimAsString("iss");
            String aud = jwt.getAudience() != null && !jwt.getAudience().isEmpty()
                    ? jwt.getAudience().get(0) : null;

            if (!APPLE_ISSUER.equals(iss)) {
                throw new com.example.todo.exception.ApiException(401, "Apple 토큰 발급자가 유효하지 않습니다.");
            }
            if (!bundleId.equals(aud)) {
                throw new com.example.todo.exception.ApiException(401, "Apple 토큰 대상이 유효하지 않습니다.");
            }
            return jwt;
        } catch (JwtException e) {
            log.warn("Apple identity token 검증 실패: {}", e.getMessage());
            throw new com.example.todo.exception.ApiException(401, "Apple 로그인 토큰이 유효하지 않습니다.");
        }
    }

    private User createAppleUser(String appleId, String email, String firstName, String lastName) {
        String name = buildName(firstName, lastName);
        String userEmail = email != null ? email : appleId + "@privaterelay.appleid.com";

        User newUser = User.builder()
                .email(userEmail)
                .name(name)
                .appleId(appleId)
                .provider(OAuthProvider.LOCAL)
                // Apple 이 이미 검증한 이메일이므로 인증 절차를 면제한다.
                // (비공개 릴레이 주소인 경우에도 Apple 이 배달을 보장한다.)
                .emailVerifiedAt(java.time.LocalDateTime.now())
                .build();
        User saved = userRepository.save(newUser);
        userSettingsService.createDefaultSettings(saved);
        return saved;
    }

    private String buildName(String firstName, String lastName) {
        if (firstName == null && lastName == null) return "Apple 사용자";
        if (firstName == null) return lastName;
        if (lastName == null) return firstName;
        return lastName + firstName;
    }
}
