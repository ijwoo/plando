package com.example.todo.service;

import com.example.todo.dto.admin.AdminDtos.AdminToken;
import com.example.todo.dto.admin.AdminDtos.AuthStatus;
import com.example.todo.dto.admin.AdminDtos.EnrollStart;
import com.example.todo.entity.AdminAuditLog;
import com.example.todo.entity.User;
import com.example.todo.exception.ApiException;
import com.example.todo.repository.AdminAuditLogRepository;
import com.example.todo.repository.UserRepository;
import com.example.todo.security.JwtTokenProvider;
import com.example.todo.security.Totp;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 관리자 2단계 인증.
 *
 * 관리자 API 는 "로그인한 ADMIN" 만으로는 열리지 않는다. 7일짜리 일반 JWT 가 새면 끝이기 때문에,
 * OTP 앱의 6자리를 한 번 더 확인하고 30분짜리 관리자 토큰을 따로 발급한다.
 *
 * 관리자가 아닌 사람에게는 이 API 들이 404 다 — 관리자 기능이 있다는 것 자체를 드러내지 않는다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminAuthService {

    static final int MAX_FAILURES = 5;
    static final long LOCK_MINUTES = 10;

    private final UserRepository userRepo;
    private final AdminAuditLogRepository auditRepo;
    private final JwtTokenProvider jwtTokenProvider;

    /** 이메일 → 실패 기록. 메모리라 재시작하면 풀리지만, 10분 잠금 용도로는 충분하다. */
    private final Map<String, Failures> failures = new ConcurrentHashMap<>();

    @Transactional(readOnly = true)
    public AuthStatus status(String email) {
        User u = requireAdmin(email);
        return new AuthStatus(u.getAdminTotpEnabledAt() != null, u.getName(), u.getEmail());
    }

    /** OTP 앱 등록 시작. 이미 등록을 마쳤으면 다시 시작할 수 없다(새 비밀값을 덮어쓰면 탈취와 같다). */
    @Transactional
    public EnrollStart startEnroll(String email) {
        User admin = requireAdmin(email);
        if (admin.getAdminTotpEnabledAt() != null) {
            throw new ApiException(409, "이미 OTP 를 등록했어요. 바꾸려면 서버에서 초기화해야 해요.");
        }
        String secret = Totp.newSecret();
        admin.setAdminTotpSecret(secret);
        admin.setAdminTotpLastStep(null);
        return new EnrollStart(Totp.otpauthUri("Plan Do! Admin", admin.getEmail(), secret), secret);
    }

    /** 앱에 뜬 6자리로 등록을 확정하고, 바로 관리자 토큰을 준다. */
    @Transactional
    public AdminToken confirmEnroll(String email, String code, String ip) {
        User admin = requireAdmin(email);
        if (admin.getAdminTotpEnabledAt() != null) throw new ApiException(409, "이미 OTP 를 등록했어요.");
        if (admin.getAdminTotpSecret() == null) throw new ApiException(400, "등록을 먼저 시작해 주세요.");
        long step = check(admin, code);
        admin.setAdminTotpEnabledAt(LocalDateTime.now());
        admin.setAdminTotpLastStep(step);
        audit(admin, "TOTP_ENROLLED", ip);
        return issue(admin);
    }

    @Transactional
    public AdminToken verify(String email, String code, String ip) {
        User admin = requireAdmin(email);
        if (admin.getAdminTotpEnabledAt() == null) throw new ApiException(400, "OTP 등록부터 해 주세요.");
        long step = check(admin, code);
        admin.setAdminTotpLastStep(step);
        audit(admin, "ADMIN_LOGIN", ip);
        return issue(admin);
    }

    private long check(User admin, String code) {
        String key = admin.getEmail();
        Failures f = failures.get(key);
        if (f != null && f.lockedUntil != null && f.lockedUntil.isAfter(LocalDateTime.now())) {
            throw new ApiException(429, "OTP 를 여러 번 틀렸어요. 10분 뒤에 다시 시도해 주세요.");
        }
        long last = admin.getAdminTotpLastStep() == null ? -1 : admin.getAdminTotpLastStep();
        long step = Totp.verify(admin.getAdminTotpSecret(), code == null ? null : code.trim(), last);
        if (step < 0) {
            Failures next = failures.compute(key, (k, old) -> {
                Failures n = old == null || (old.lockedUntil != null && old.lockedUntil.isBefore(LocalDateTime.now()))
                        ? new Failures() : old;
                n.count++;
                if (n.count >= MAX_FAILURES) n.lockedUntil = LocalDateTime.now().plusMinutes(LOCK_MINUTES);
                return n;
            });
            log.warn("[admin] OTP 실패 user={} count={}", admin.getId(), next.count);
            // 401 이 아니라 400 — 웹 클라이언트는 401 을 받으면 로그아웃시킨다. OTP 를 틀린 건 세션 문제가 아니다.
            throw new ApiException(400, "OTP 가 맞지 않아요.");
        }
        failures.remove(key);
        return step;
    }

    private AdminToken issue(User admin) {
        return new AdminToken(jwtTokenProvider.createAdminToken(admin.getEmail()),
                LocalDateTime.now().plusMinutes(JwtTokenProvider.ADMIN_TOKEN_MINUTES));
    }

    /** 관리자가 아니면 404. 정지·탈퇴한 관리자도 마찬가지. */
    User requireAdmin(String email) {
        return userRepo.findActiveByEmail(email)
                .filter(User::isAdmin)
                .filter(u -> !u.isSuspended())
                .orElseThrow(() -> new ApiException(404, "페이지를 찾을 수 없어요."));
    }

    private void audit(User admin, String action, String ip) {
        auditRepo.save(AdminAuditLog.builder().adminId(admin.getId()).action(action).ip(ip).build());
    }

    private static final class Failures {
        int count;
        LocalDateTime lockedUntil;
    }
}
