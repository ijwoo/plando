package com.example.todo.service;

import com.example.todo.entity.PasswordResetToken;
import com.example.todo.entity.User;
import com.example.todo.exception.ApiException;
import com.example.todo.repository.PasswordResetTokenRepository;
import com.example.todo.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class PasswordResetService {

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository tokenRepository;
    private final JavaMailSender mailSender;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    @Value("${app.mail.from}")
    private String mailFrom;

    /**
     * H-03: 이메일 존재 여부/소셜 여부와 무관하게 동일한 응답 반환 (열거 방지).
     * H-12: SMTP 호출을 @Transactional 바깥으로 분리.
     */
    public void sendResetEmail(String email) {
        // findActiveByEmail: 탈퇴 계정은 없는 것으로 취급한다.
        // (탈퇴 시 비밀번호가 임의값으로 채워져 아래 null 검사에 걸리지 않는다.)
        Optional<User> optUser = userRepository.findActiveByEmail(email);

        if (optUser.isEmpty() || optUser.get().getPassword() == null) {
            log.debug("비밀번호 재설정 요청 무시 (미존재·탈퇴 또는 소셜 계정): {}", email);
            return;
        }

        String token = saveResetToken(email);
        sendMail(email, token);
    }

    @Transactional
    protected String saveResetToken(String email) {
        tokenRepository.deleteAllByEmail(email);

        String token = UUID.randomUUID().toString();
        tokenRepository.save(PasswordResetToken.builder()
                .token(token)
                .email(email)
                .expiresAt(LocalDateTime.now().plusHours(1))
                .build());
        return token;
    }

    private void sendMail(String email, String token) {
        String resetUrl = frontendUrl + "/#/reset-password?token=" + token;

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom("Plan Do! <" + mailFrom + ">");
        message.setTo(email);
        message.setSubject("[Plan Do!] 비밀번호 재설정");
        message.setText(
                "안녕하세요.\n\n" +
                "아래 링크를 클릭하여 비밀번호를 재설정해주세요.\n" +
                "링크는 1시간 후 만료됩니다.\n\n" +
                resetUrl + "\n\n" +
                "본인이 요청하지 않았다면 이 메일을 무시해주세요.\n\n" +
                "Plan Do!"
        );
        mailSender.send(message);
    }

    /** H-02: 비밀번호 길이 검증 추가 */
    @Transactional
    public void resetPassword(String token, String newPassword) {
        if (newPassword == null || newPassword.length() < 8) {
            throw new ApiException(400, "비밀번호는 8자 이상이어야 합니다.");
        }

        PasswordResetToken resetToken = tokenRepository.findByToken(token)
                .orElseThrow(() -> new ApiException(400, "유효하지 않은 토큰입니다."));

        if (resetToken.isUsed()) {
            throw new ApiException(400, "이미 사용된 토큰입니다.");
        }
        if (resetToken.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new ApiException(400, "만료된 토큰입니다.");
        }

        // 토큰은 user_id 가 아니라 email 문자열로 연결된다.
        // 탈퇴 시 그 사람의 토큰을 지우지만, 그래도 활성 계정만 대상으로 삼아 이중으로 막는다
        // (탈퇴로 해방된 이메일에 새로 가입한 사람의 비밀번호가 바뀌는 일을 방지).
        User user = userRepository.findActiveByEmail(resetToken.getEmail())
                .orElseThrow(() -> new ApiException(404, "사용자를 찾을 수 없습니다."));

        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        resetToken.setUsed(true);
        tokenRepository.save(resetToken);
    }
}
