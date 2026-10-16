package com.example.todo.exception;

import io.sentry.Sentry;
import jakarta.servlet.http.HttpServletRequest;
import org.apache.catalina.connector.ClientAbortException;
import org.springframework.http.HttpStatus;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(GlobalExceptionHandler.class);

    private final ErrorLogger errorLogger;

    public GlobalExceptionHandler(ErrorLogger errorLogger) {
        this.errorLogger = errorLogger;
    }

    /**
     * 서버 결함을 기록한다 — 로그 한 줄 + Sentry.
     *
     * **왜 Sentry 로 직접 보내는가:** Sentry 의 기본 HandlerExceptionResolver 는 이 @RestControllerAdvice
     * 보다 늦게 돌기 때문에, 여기서 예외를 처리해 버리면 Sentry 는 예외를 **아예 보지 못한다.**
     * DSN 을 넣고 실제로 확인했더니 일부러 낸 404·400 은 물론 500 도 한 건도 올라가지 않았다
     * (테스트 이벤트만 도착). 그래서 명시적으로 보고한다.
     *
     * **왜 4xx 는 보내지 않는가:** 없는 글 조회·잘못된 입력 같은 것까지 이슈로 쌓으면 무료 할당량이
     * 금방 닳고, 무엇보다 알림이 잦아지면 결국 아무도 안 보게 된다. 사용자 입력 문제는 로그로만 남긴다.
     */
    private void reportServerFault(HttpServletRequest req, Throwable e, int status) {
        errorLogger.record(req, e, status, true);
        Sentry.captureException(e);
    }

    /** 연결 끊김인가. 메시지까지 보는 이유는 드라이버·컨테이너마다 감싸는 타입이 달라서다. */
    private boolean isClientDisconnect(Throwable e) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (t instanceof ClientAbortException || t instanceof AsyncRequestNotUsableException) return true;
            String m = t.getMessage();
            if (t instanceof java.io.IOException && m != null
                    && (m.contains("Broken pipe") || m.contains("Connection reset"))) return true;
            if (t.getCause() == t) break;
        }
        return false;
    }

    /** 사용자 입력 문제 — 로그 한 줄만. Sentry 로는 보내지 않는다. */
    private void reportClientError(HttpServletRequest req, Throwable e, int status) {
        errorLogger.record(req, e, status, false);
    }

    /**
     * DB 계층 오류. 아래 RuntimeException 핸들러가 e.getMessage()를 그대로 내려주는데,
     * DataAccessException 도 RuntimeException 이라 **원본 SQL 과 제약 이름이 클라이언트로 샜다.**
     * 실제로 사용자에게 이런 응답이 갔다:
     *   "duplicate key value violates unique constraint \"uk_todo_tag\" ...
     *    [insert into todo.todo_tag (tag_id,todo_id) values (?,?)]"
     * 스키마·테이블·제약 이름이 그대로 노출되고, 사용자는 무슨 뜻인지 알 수도 없다.
     * 원인은 서버 로그로 남기고 클라이언트에는 사람이 읽을 문장만 준다.
     */
    @ExceptionHandler(org.springframework.dao.DataAccessException.class)
    public ResponseEntity<Map<String, String>> handleDataAccess(
            org.springframework.dao.DataAccessException e, HttpServletRequest req) {
        reportServerFault(req, e, HttpStatus.CONFLICT.value());
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Map.of("message", "요청을 처리하지 못했어요. 화면을 새로고침한 뒤 다시 시도해 주세요."));
    }

    /**
     * 스프링이 요청을 바인딩하다 던지는 예외들. 아래 RuntimeException 핸들러가 메시지를 그대로
     * 내려주는 바람에 **프레임워크 내부 사정이 사용자에게 그대로 노출됐다.** 실제 응답 예:
     *   GET /api/todos/abc → 400
     *   "Method parameter 'id': Failed to convert value of type 'java.lang.String' to
     *    required type 'java.lang.Long'; For input string: \"abc\""
     * 패키지 구조·파라미터 이름·내부 타입이 다 드러나고, 사용자는 읽어도 알 수 없는 문장이다.
     * 원인은 로그로만 남기고 클라이언트에는 고정된 한국어 문장을 준다.
     */
    @ExceptionHandler(org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class)
    public ResponseEntity<Map<String, String>> handleTypeMismatch(
            org.springframework.web.method.annotation.MethodArgumentTypeMismatchException e) {
        log.warn("[요청] 파라미터 타입 불일치: name={}, value={}", e.getName(), e.getValue());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("message", "요청 값이 올바르지 않습니다. 입력값을 확인해 주세요."));
    }

    /** 본문 JSON 파싱 실패 — 파싱 오류 원문에는 DTO 클래스명·필드 경로가 들어 있어 그대로 주면 안 된다. */
    @ExceptionHandler(org.springframework.http.converter.HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, String>> handleNotReadable(
            org.springframework.http.converter.HttpMessageNotReadableException e) {
        log.warn("[요청] 본문을 읽을 수 없음: {}", e.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("message", "요청 형식이 올바르지 않습니다."));
    }

    /**
     * 필수 쿼리 파라미터 누락. 이건 **checked 예외**라 RuntimeException 핸들러에 안 걸리고
     * 맨 아래 generic 핸들러로 떨어져 **500** 이 나갔다(예: q 없이 GET /api/search).
     * 클라이언트 잘못이므로 400 이 맞다.
     * MissingServletRequestParameterException·MissingRequestHeaderException 등이 모두
     * ServletRequestBindingException 하위라 한 곳에서 받는다.
     */
    @ExceptionHandler(org.springframework.web.bind.ServletRequestBindingException.class)
    public ResponseEntity<Map<String, String>> handleBinding(
            org.springframework.web.bind.ServletRequestBindingException e) {
        log.warn("[요청] 필수 값 누락/바인딩 실패: {}", e.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("message", "요청에 필요한 값이 빠졌습니다."));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(fe -> fe.getDefaultMessage())
                .orElse("입력값을 확인해주세요.");
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("message", message));
    }

    /** 비즈니스 로직 예외: status 코드와 메시지를 직접 지정 */
    /** 관리자 OTP 재확인 필요 — 화면이 code 를 보고 OTP 입력으로 돌아간다. */
    @ExceptionHandler(com.example.todo.config.AdminAccessInterceptor.AdminStepUpRequired.class)
    public ResponseEntity<Map<String, String>> handleAdminStepUp(ApiException e, HttpServletRequest req) {
        reportClientError(req, e, e.getStatus());
        return ResponseEntity.status(e.getStatus())
                .body(Map.of("message", e.getMessage(), "code", "ADMIN_STEP_UP"));
    }

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Map<String, String>> handleApiException(ApiException e, HttpServletRequest req) {
        // 대부분은 업무상 정상인 4xx(권한 없음·없는 항목 등)다. 5xx 로 던진 것만 결함으로 본다.
        if (e.getStatus() >= 500) {
            reportServerFault(req, e, e.getStatus());
        } else {
            reportClientError(req, e, e.getStatus());
        }
        return ResponseEntity.status(e.getStatus())
                .body(Map.of("message", e.getMessage()));
    }

    /**
     * 도메인 RuntimeException — 사람이 읽을 한국어 메시지를 담아 던진 것들.
     *
     * 주의: "코드베이스의 모든 RuntimeException 은 보여줘도 된다"는 전제로 메시지를 그대로
     * 내려준다. 프레임워크가 던지는 RuntimeException(DataAccessException 등)은 그 전제가
     * 성립하지 않으므로 **더 구체적인 핸들러로 먼저 가로채야 한다**(위 handleDataAccess).
     * 새로운 프레임워크 예외를 만나면 여기 말고 전용 핸들러를 추가할 것.
     */
    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, String>> handleRuntime(RuntimeException e, HttpServletRequest req) {
        String message = e.getMessage();
        if (message == null || message.isBlank()) {
            // 메시지 없는 RuntimeException 은 사람이 의도해 던진 게 아닐 가능성이 크다.
            // 예전엔 여기에 보고가 없어서 400 만 나가고 **로그·Sentry 어디에도 안 남았다** —
            // AI 응답이 "요청을 처리할 수 없습니다"로만 돌아오는데 원인을 볼 방법이 없었다.
            message = "요청을 처리할 수 없습니다.";
            reportServerFault(req, e, HttpStatus.BAD_REQUEST.value());
        } else {
            reportClientError(req, e, HttpStatus.BAD_REQUEST.value());
        }
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("message", message));
    }

    /**
     * 클라이언트가 응답을 받다 말고 끊은 경우 — 서버 잘못이 아니다.
     *
     * 탭을 닫거나 새로고침하거나 화면을 옮기면 브라우저가 연결을 끊는데, 그때 응답을 쓰던
     * 톰캣이 "Broken pipe" 를 던진다. 고칠 것이 없고 **응답을 돌려줄 상대도 이미 없다**
     * (죽은 소켓에 쓰면 또 예외가 난다).
     *
     * [고치는 결함] 아래 catch-all 이 이것까지 Sentry 로 올렸다. 사용자가 화면을 옮길 때마다
     * 이슈가 쌓이면 무료 할당량이 닳는 것보다 **진짜 오류가 그 사이에 묻히는 것**이 더 나쁘다.
     * 알림이 잦아지면 결국 아무도 안 본다.
     */
    @ExceptionHandler({ ClientAbortException.class, AsyncRequestNotUsableException.class })
    public void handleClientDisconnect(Exception e, HttpServletRequest req) {
        log.debug("[ClientAbort] {} {} — 클라이언트가 연결을 끊음: {}",
                req.getMethod(), req.getRequestURI(), e.getMessage());
    }

    /** 예상치 못한 서버 오류 */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleException(Exception e, HttpServletRequest req) {
        /* 원인 사슬 어딘가가 연결 끊김이면 위와 같이 취급한다.
           래핑돼 들어오는 경로가 있어서 타입만 보면 새어 나간다. */
        if (isClientDisconnect(e)) {
            log.debug("[ClientAbort] {} {} — 클라이언트가 연결을 끊음", req.getMethod(), req.getRequestURI());
            return null;
        }
        // 예전엔 여기에 로그조차 없어서, 500 이 나도 Sentry·로그 어디에도 흔적이 남지 않았다.
        reportServerFault(req, e, HttpStatus.INTERNAL_SERVER_ERROR.value());
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("message", "서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."));
    }
}
