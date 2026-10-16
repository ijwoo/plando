package com.example.todo.util;

import com.example.todo.entity.User;
import com.example.todo.exception.ApiException;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.Set;

/**
 * 게스트 계정(guest1/guest2@plando.app) 식별 + 액션 차단 유틸.
 * 기존에 RecruitmentController, RecruitmentQaService, AuthController, GuestCleanupScheduler에
 * GUEST_EMAILS가 각각 산발 정의돼있던 것을 단일 출처로 통합.
 *
 * - {@link #GUEST_EMAILS}: 게스트 이메일 Set (lookup 최적화)
 * - {@link #GUEST_EMAILS_LIST}: 리포지토리 {@code IN :emails} 쿼리용 List
 * - {@link #isGuest(User)} / {@link #isGuestEmail(String)}: 식별
 * - {@link #requireNonGuest(User)}: 액션 차단 (게스트면 403 GUEST_NOT_ALLOWED)
 */
public final class GuestUtils {

    public static final Set<String> GUEST_EMAILS = Set.of(
            "guest1@plando.app",
            "guest2@plando.app",
            "guest3@plando.app",
            "guest4@plando.app",
            "guest5@plando.app",
            "guest6@plando.app"
    );

    /** Spring Data JPA 메서드 시그니처가 List를 요구하는 경우 사용 */
    public static final List<String> GUEST_EMAILS_LIST = List.copyOf(GUEST_EMAILS);

    private GuestUtils() {}

    public static boolean isGuestEmail(String email) {
        return email != null && GUEST_EMAILS.contains(email);
    }

    public static boolean isGuest(User user) {
        return user != null && isGuestEmail(user.getEmail());
    }

    public static final String GUEST_BLOCK_CODE = "GUEST_NOT_ALLOWED";

    public static void requireNonGuest(User user) {
        if (isGuest(user)) {
            throw new ApiException(HttpStatus.FORBIDDEN.value(), GUEST_BLOCK_CODE);
        }
    }
}
