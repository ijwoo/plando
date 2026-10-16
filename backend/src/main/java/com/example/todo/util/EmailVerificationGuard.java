package com.example.todo.util;

import com.example.todo.entity.User;
import com.example.todo.exception.ApiException;
import org.springframework.http.HttpStatus;

/**
 * 이메일 미인증 계정이 팀 기능에 들어오는 것을 막는다.
 *
 * 왜 전면 차단이 아니라 이것만 막는가:
 *   가입 직후 아무것도 못 하게 하면 이탈이 크다. 그래서 로그인과 개인 사용은 허용하고,
 *   **확인되지 않은 주소로 남의 워크스페이스에 진입하는 것**만 막는다.
 *   이 기능의 실익이 거기에 있다.
 *
 * 클라이언트는 이 코드를 받으면 인증 안내 배너/시트를 띄운다.
 */
public final class EmailVerificationGuard {

    /** 클라이언트가 분기할 수 있게 고정 코드를 쓴다(메시지 문구에 의존하지 않도록). */
    public static final String CODE = "EMAIL_NOT_VERIFIED";

    private EmailVerificationGuard() {}

    public static void require(User user) {
        if (user == null || !user.isEmailVerified()) {
            throw new ApiException(HttpStatus.FORBIDDEN.value(), CODE);
        }
    }
}
