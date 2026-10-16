package com.example.todo.service;

import com.example.todo.entity.EmailVerificationToken;
import com.example.todo.dto.WorkspaceActionResponse;
import com.example.todo.dto.WorkspaceJoinRequest;
import com.example.todo.entity.User;
import com.example.todo.exception.ApiException;
import com.example.todo.repository.EmailVerificationTokenRepository;
import com.example.todo.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * 이메일 인증.
 *
 * 정책:
 *  · 미인증이어도 로그인은 된다. 클라이언트가 배너로 인증을 유도한다.
 *  · 남의 워크스페이스 참여·초대 코드 취급만 막는다({@link com.example.todo.util.EmailVerificationGuard}).
 *  · 소셜 로그인은 제공자가 이미 이메일을 검증했으므로 계정 생성 시 바로 인증 완료로 둔다.
 *
 * 메일 발송은 트랜잭션 밖에서 한다 — SMTP 지연이 DB 커넥션을 잡고 있으면 안 되고,
 * 발송 실패가 가입 자체를 되돌리면 안 된다(PasswordResetService 와 같은 이유).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EmailVerificationService {

    /** 링크 유효기간. 재설정(1시간)보다 길게 둔다 — 가입 메일은 나중에 확인하는 일이 흔하다. */
    private static final Duration TOKEN_TTL = Duration.ofHours(24);

    /** 재발송 남용 방지: 이 시간 안에 이미 보냈으면 다시 만들지 않는다. */
    private static final Duration RESEND_COOLDOWN = Duration.ofMinutes(3);

    private final UserRepository userRepository;
    private final EmailVerificationTokenRepository tokenRepository;
    private final JavaMailSender mailSender;
    private final com.example.todo.service.WorkspaceService workspaceService;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    @Value("${app.mail.from}")
    private String mailFrom;

    /**
     * 가입 직후 인증 메일 발송. 실패해도 가입은 유지된다(사용자가 나중에 재발송할 수 있다).
     */
    public void sendVerificationEmail(User user) {
        if (user.isEmailVerified()) return;
        try {
            String token = issueToken(user);
            sendMail(user.getEmail(), token);
        } catch (Exception e) {
            // 메일이 안 나가도 가입을 되돌리지 않는다 — 재발송 경로가 있다.
            log.warn("[email-verify] 인증 메일 발송 실패 userId={} err={}", user.getId(), e.getMessage());
        }
    }

    /** 사용자가 직접 재발송을 눌렀을 때. 쿨다운 안이면 조용히 성공으로 응답한다(존재/빈도 노출 방지). */
    public void resend(String email) {
        User user = userRepository.findActiveByEmail(email)
                .orElseThrow(() -> new ApiException(404, "사용자를 찾을 수 없습니다."));
        if (user.isEmailVerified()) {
            throw new ApiException(400, "이미 인증된 이메일입니다.");
        }
        long recent = tokenRepository.countRecentByUserId(
                user.getId(), LocalDateTime.now().minus(RESEND_COOLDOWN));
        if (recent > 0) {
            // 예전엔 조용히 200 을 돌려줬다. 그러면 클라이언트가 "메일을 보냈어요" 라고 알리는데
            // 실제로는 보내지 않아서, 사용자는 오지 않는 메일을 기다리게 된다.
            // 가입 직후에는 이미 메일이 한 통 나갔으므로 이 경로가 특히 흔하다 — 사실대로 알린다.
            throw new ApiException(429, "조금 전에 인증 메일을 보냈어요. "
                    + RESEND_COOLDOWN.toMinutes() + "분 후에 다시 시도해주세요.");
        }
        String token = issueToken(user);
        try {
            sendMail(user.getEmail(), token);
        } catch (Exception e) {
            // 존재하지 않는 도메인 등으로 SMTP 가 실패하면 예전엔 500 이 나갔다.
            // 사용자가 고칠 수 있는 문제(주소 오타)이므로 원인을 알려준다.
            log.warn("[email-verify] 재발송 실패 userId={} err={}", user.getId(), e.getMessage());
            throw new ApiException(502, "인증 메일을 보내지 못했어요. 이메일 주소를 확인해주세요.");
        }
    }

    /**
     * 인증 결과. 보류 초대코드가 있었다면 그 처리 결과까지 담는다.
     *
     * @param joinedWorkspaceName 합류에 성공한 워크스페이스 이름 (합류 시도가 없었거나 실패면 null)
     * @param joinError           합류 실패 사유 (한국어). 실패가 아니면 null
     */
    public record VerifyResult(String joinedWorkspaceName, String joinError) {
        public static final VerifyResult NO_JOIN = new VerifyResult(null, null);
    }

    /** 링크의 토큰으로 인증 완료 처리. */
    @Transactional
    public VerifyResult verify(String token) {
        EmailVerificationToken row = tokenRepository.findByToken(token)
                .orElseThrow(() -> new ApiException(400, "유효하지 않은 인증 링크입니다."));

        if (row.isUsed()) {
            throw new ApiException(400, "이미 사용된 인증 링크입니다.");
        }
        if (row.isExpired()) {
            throw new ApiException(400, "만료된 인증 링크입니다. 인증 메일을 다시 받아주세요.");
        }

        User user = row.getUser();
        if (user.isDeleted()) {
            throw new ApiException(400, "사용할 수 없는 계정입니다.");
        }

        if (!user.isEmailVerified()) {
            user.setEmailVerifiedAt(LocalDateTime.now());
            userRepository.save(user);
        }
        row.setUsed(true);
        tokenRepository.save(row);

        // 가입할 때 보류해 둔 초대코드를 지금 소비한다. 정상 참여 경로를 그대로 타므로
        // 이메일 인증·게스트 워크스페이스 가드가 모두 적용된다.
        // 참여가 실패해도(코드 폐기·이미 참여 등) **인증 자체는 성공으로 둔다** —
        // 여기서 예외를 던지면 인증 링크가 이미 used 로 바뀐 뒤라 사용자가 영영 인증을 못 한다.
        // 다만 결과는 반드시 호출자에게 돌려준다. 예전엔 로그만 남기고 화면엔 아무 말도 하지 않아,
        // 초대코드를 넣고 가입한 사람이 팀에 들어갔는지 아닌지 알 방법이 없었다.
        String pending = user.getPendingInviteCode();
        if (pending == null || pending.isBlank()) {
            return VerifyResult.NO_JOIN;
        }
        user.setPendingInviteCode(null);
        userRepository.save(user);
        try {
            WorkspaceJoinRequest req = new WorkspaceJoinRequest();
            req.setInviteCode(pending);
            WorkspaceActionResponse joined = workspaceService.joinWorkspace(user.getEmail(), req);
            log.info("[EmailVerification] {} 보류 초대코드로 워크스페이스 참여 완료", user.getEmail());
            return new VerifyResult(joined.getWorkspaceName(), null);
        } catch (ApiException e) {
            // 백엔드 오류 문구는 한국어라 그대로 사용자에게 보여줄 수 있다.
            log.warn("[EmailVerification] {} 보류 초대코드 참여 실패: {}", user.getEmail(), e.getMessage());
            return new VerifyResult(null, e.getMessage());
        } catch (Exception e) {
            log.warn("[EmailVerification] {} 보류 초대코드 참여 실패: {}", user.getEmail(), e.getMessage());
            return new VerifyResult(null, "초대코드로 팀에 합류하지 못했습니다.");
        }
    }

    /** 기존 토큰을 지우고 새로 발급 — 살아 있는 링크가 여러 개 떠다니지 않게. */
    @Transactional
    protected String issueToken(User user) {
        tokenRepository.deleteByUserId(user.getId());
        String token = UUID.randomUUID().toString();
        tokenRepository.save(EmailVerificationToken.builder()
                .user(user)
                .token(token)
                .expiresAt(LocalDateTime.now().plus(TOKEN_TTL))
                .build());
        return token;
    }

    private void sendMail(String email, String token) {
        String url = frontendUrl + "/#/verify-email?token=" + token;

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom("Plan Do! <" + mailFrom + ">");
        message.setTo(email);
        message.setSubject("[Plan Do!] 이메일 인증");
        message.setText(
                "안녕하세요.\n\n" +
                "아래 링크를 눌러 이메일 인증을 완료해주세요.\n" +
                "링크는 24시간 후 만료됩니다.\n\n" +
                url + "\n\n" +
                "인증하지 않아도 Plan Do! 를 쓸 수 있지만, 팀 워크스페이스 참여에는 인증이 필요합니다.\n" +
                "본인이 가입하지 않았다면 이 메일을 무시해주세요.\n\n" +
                "Plan Do!"
        );
        mailSender.send(message);
    }
}
