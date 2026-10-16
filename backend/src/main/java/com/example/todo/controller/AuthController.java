package com.example.todo.controller;

import com.example.todo.exception.ApiException;
import com.example.todo.dto.LoginRequestDto;
import com.example.todo.dto.LoginResponseDto;
import com.example.todo.dto.AuthDto;
import com.example.todo.entity.User;
import com.example.todo.repository.UserRepository;
import com.example.todo.security.JwtTokenProvider;
import com.example.todo.service.AppleAuthService;
import com.example.todo.service.EmailVerificationService;
import com.example.todo.service.GuestCleanupService;
import com.example.todo.service.PasswordResetService;
import com.example.todo.service.UserService;
import com.example.todo.util.GuestUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;

import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserService userService;
    private final UserRepository userRepository;
    private final EmailVerificationService emailVerificationService;
    private final JwtTokenProvider jwtTokenProvider;
    private final PasswordEncoder passwordEncoder;
    private final PasswordResetService passwordResetService;
    private final AppleAuthService appleAuthService;
    private final GuestCleanupService guestCleanupService;

    /** 로그인 실패 공통 메시지 — 이메일 존재 여부를 드러내지 않도록 두 실패 경로가 같은 문구를 쓴다 */
    private static final String LOGIN_FAILED_MESSAGE = "이메일 또는 비밀번호가 올바르지 않습니다.";

    @PostMapping("/signup")
    public ResponseEntity<LoginResponseDto> signup(@Valid @RequestBody AuthDto authDto) {
        User user = userService.registerUser(authDto);
        // 인증 메일은 트랜잭션 밖(가입 완료 후)에서 보낸다. 발송이 실패해도 가입은 유지되고,
        // 사용자는 나중에 재발송을 누를 수 있다.
        emailVerificationService.sendVerificationEmail(user);
        String token = jwtTokenProvider.createToken(user.getEmail());
        return ResponseEntity.ok(new LoginResponseDto(token, user.getName(), user.getEmail(), user.getId()));
    }

    /**
     * 메일 링크의 토큰으로 인증 완료.
     * permitAll — 로그인하지 않은 상태(다른 기기/브라우저)에서 링크를 눌러도 동작해야 한다.
     */
    @PostMapping("/verify-email")
    public ResponseEntity<Map<String, String>> verifyEmail(@RequestBody Map<String, String> body) {
        String token = body.get("token");
        if (token == null || token.isBlank()) {
            throw new ApiException(400, "인증 토큰이 필요합니다.");
        }
        var result = emailVerificationService.verify(token);
        // 가입할 때 초대코드를 넣었다면 그 처리 결과까지 알려준다 — 예전엔 인증만 됐다고 하고
        // 팀에 들어갔는지는 말해 주지 않아, 사용자가 확인할 방법이 없었다.
        Map<String, String> body2 = new java.util.HashMap<>();
        body2.put("message", "이메일 인증이 완료되었습니다.");
        if (result.joinedWorkspaceName() != null) {
            body2.put("joinedWorkspaceName", result.joinedWorkspaceName());
        }
        if (result.joinError() != null) {
            body2.put("joinError", result.joinError());
        }
        return ResponseEntity.ok(body2);
    }

    /** 인증 메일 재발송. 본인만 호출한다(토큰 필요). 3분 쿨다운은 서비스가 처리한다. */
    @PostMapping("/verify-email/resend")
    public ResponseEntity<Map<String, String>> resendVerificationEmail(Authentication authentication) {
        emailVerificationService.resend(authentication.getName());
        return ResponseEntity.ok(Map.of("message", "인증 메일을 보냈습니다. 메일함을 확인해주세요."));
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponseDto> login(@Valid @RequestBody LoginRequestDto requestDto) {
        // 미가입 이메일은 400 "존재하지 않는 사용자입니다.", 비밀번호 오류는 401로 응답이 갈려서
        // 유출된 이메일 목록을 그대로 대입해 가입 계정을 전수 판별할 수 있었다(사용자 열거 오라클).
        // 두 경우를 같은 상태코드·같은 메시지로 통일해 구분 단서를 없앤다.
        // findActiveByEmail: 탈퇴 계정은 아예 없는 것으로 취급한다.
        // 탈퇴 시 비밀번호를 임의값으로 바꾸지만 null 이 아니라서 아래 "소셜 전용" 분기에
        // 걸리지 않고, 익명화된 이메일(deleted-{id}@deleted.invalid)은 추측이 쉽다.
        // 존재 여부를 흘리지 않도록 미가입과 같은 401·같은 메시지로 응답한다.
        User user = userRepository.findActiveByEmail(requestDto.getEmail())
                .orElseThrow(() -> new ApiException(401, LOGIN_FAILED_MESSAGE));

        if (user.getPassword() == null) {
            throw new ApiException(400, "이 계정은 소셜 로그인으로만 접근할 수 있습니다.");
        }

        if (!passwordEncoder.matches(requestDto.getPassword(), user.getPassword())) {
            throw new ApiException(401, LOGIN_FAILED_MESSAGE);
        }
        // 비밀번호가 맞은 뒤에만 알려 준다 — 그 전에 알리면 정지 여부로 계정 존재를 떠볼 수 있다.
        if (user.isSuspended()) {
            throw new ApiException(403, "운영 정책 위반으로 이용이 정지된 계정이에요.");
        }

        String token = jwtTokenProvider.createToken(user.getEmail());
        return ResponseEntity.ok(new LoginResponseDto(token, user.getName(), user.getEmail(), user.getId()));
    }

    @PostMapping("/guest")
    public ResponseEntity<LoginResponseDto> guestLogin() {
        // 새 게스트가 로그인하기 직전에 이전 게스트가 남긴 모든 잔류 데이터를 청소.
        // (알림/DM/댓글/로그/멤버십/Todo 등) — 다음 사용자가 깨끗한 상태를 보도록.
        try {
            guestCleanupService.cleanupAllGuestData();
        } catch (Exception e) {
            // cleanup이 실패해도 로그인은 진행 — 다음 새벽 4시 배치(GuestCleanupScheduler)가 안전망
            // 토큰 발급은 막지 말 것.
        }

        String[] guestEmails = GuestUtils.GUEST_EMAILS.toArray(new String[0]);
        String email = guestEmails[ThreadLocalRandom.current().nextInt(guestEmails.length)];
        User guest = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("게스트 계정을 찾을 수 없습니다."));

        // 통계: 누적 게스트 로그인 횟수 + 마지막 로그인 시각 (cleanup에서 reset 안 함)
        guest.setGuestLoginCount(guest.getGuestLoginCount() + 1);
        guest.setLastGuestLoginAt(java.time.LocalDateTime.now());
        userRepository.save(guest);

        String token = jwtTokenProvider.createToken(guest.getEmail());
        return ResponseEntity.ok(new LoginResponseDto(token, guest.getName(), guest.getEmail(), guest.getId()));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@RequestBody Map<String, String> body) {
        String email = body != null ? body.get("email") : null;
        if (email == null || email.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "이메일을 입력해주세요."));
        }
        passwordResetService.sendResetEmail(email);
        return ResponseEntity.ok(Map.of("message", "재설정 링크를 이메일로 전송했습니다."));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@RequestBody Map<String, String> body) {
        String token = body != null ? body.get("token") : null;
        String newPassword = body != null ? body.get("newPassword") : null;
        if (token == null || token.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "토큰이 필요합니다."));
        }
        if (newPassword == null || newPassword.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "새 비밀번호를 입력해주세요."));
        }
        passwordResetService.resetPassword(token, newPassword);
        return ResponseEntity.ok(Map.of("message", "비밀번호가 재설정되었습니다."));
    }

    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> getCurrentUser(Authentication authentication) {
        // 클라이언트가 인증 안내 배너를 띄울지 판단할 근거가 필요하다.
        // 예전엔 DB를 전혀 보지 않고 토큰의 이메일만 돌려줬다 — 그래서 탈퇴한 계정의
        // 토큰으로도 200이 떨어졌다(지금은 JWT 필터가 먼저 막는다).
        String email = authentication.getName();
        User user = userRepository.findActiveByEmail(email)
                .orElseThrow(() -> new ApiException(401, "사용할 수 없는 계정입니다."));
        return ResponseEntity.ok(Map.of(
                "email", user.getEmail(),
                "emailVerified", user.isEmailVerified()
        ));
    }

    @DeleteMapping("/me")
    public ResponseEntity<Void> deleteAccount(Authentication authentication) {
        userService.deleteAccount(authentication.getName());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/apple")
    public ResponseEntity<?> appleLogin(@RequestBody Map<String, String> body) {
        String identityToken = body.get("identityToken");
        String firstName     = body.get("firstName");
        String lastName      = body.get("lastName");
        if (identityToken == null || identityToken.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "identityToken이 필요합니다."));
        }
        try {
            LoginResponseDto response = appleAuthService.authenticate(identityToken, firstName, lastName);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }
}