package com.example.todo;

import com.example.todo.exception.GlobalExceptionHandler;
import jakarta.servlet.http.HttpServletRequest;
import org.apache.catalina.connector.ClientAbortException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;

import java.io.IOException;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 클라이언트 연결 끊김은 오류가 아니다.
 *
 * [고정하는 결함] 탭을 닫거나 화면을 옮기면 톰캣이 "Broken pipe" 를 던지는데, catch-all 이
 * 그것까지 Sentry 로 올렸다. 고칠 것이 없는 잡음이 쌓이면 **진짜 오류가 그 사이에 묻힌다** —
 * 알림이 잦아지면 결국 아무도 안 본다.
 *
 * 응답을 만들지 않는 것도 중요하다. 상대는 이미 끊겼고, 죽은 소켓에 쓰면 또 예외가 난다.
 */
class ClientDisconnectNotReportedTest extends IntegrationTestBase {

    @Autowired GlobalExceptionHandler handler;

    private HttpServletRequest req() {
        MockHttpServletRequest r = new MockHttpServletRequest("GET", "/api/todos");
        return r;
    }

    @Test
    @DisplayName("연결 끊김은 응답을 만들지 않는다")
    void abortProducesNoResponse() {
        assertThat(handler.handleException(new ClientAbortException("Broken pipe"), req()))
                .as("상대가 이미 끊겼는데 응답을 쓰면 또 예외가 난다")
                .isNull();
    }

    @Test
    @DisplayName("감싸여 들어온 연결 끊김도 걸러낸다")
    void wrappedAbortIsDetected() {
        // 컨테이너·드라이버마다 감싸는 타입이 달라서 타입만 보면 새어 나간다
        Exception wrapped = new IllegalStateException("wrapper",
                new AsyncRequestNotUsableException("Response not usable after response errors.",
                        new IOException("Broken pipe")));
        assertThat(handler.handleException(wrapped, req())).isNull();
    }

    @Test
    @DisplayName("진짜 서버 오류는 그대로 500 을 돌려준다")
    void realErrorStillReported() {
        /* 필터가 과하면 반대 사고가 난다 — 진짜 오류까지 조용히 삼키면
           Sentry 를 붙인 의미가 없어진다. */
        var res = handler.handleException(new IllegalStateException("진짜 터진 것"), req());
        assertThat(res).isNotNull();
        assertThat(res.getStatusCode().value()).isEqualTo(500);
    }
}
