package com.example.todo;

import com.example.todo.entity.User;
import com.example.todo.entity.Workspace;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 오류 응답이 내부 사정을 흘리지 않는지 (commit 9fe3f04 / a2114ed).
 */
class ErrorResponseIntegrationTest extends IntegrationTestBase {

    @Autowired TestFixtures fx;

    @Test
    @DisplayName("DB 제약 위반이 나도 SQL·스키마·테이블·컬럼 이름이 응답에 실리지 않는다")
    void databaseErrorsAreNotLeakedToClient() throws Exception {
        /* [고정하는 결함] GlobalExceptionHandler 에 RuntimeException 핸들러가 e.getMessage()
           를 그대로 내려주고 있었다. DataAccessException 도 RuntimeException 이라
           **DB 오류 원문이 사용자 화면에 그대로 떴다.** 실제로 나간 응답:
             "duplicate key value violates unique constraint \"uk_todo_tag\" ...
              [insert into todo.todo_tag (tag_id,todo_id) values (?,?)]"
           스키마·테이블·제약 이름이 노출되고(공격자에겐 지도), 사용자는 읽어도 뜻을 모른다.
           전용 handleDataAccess 가 원인은 서버 로그로만 남기고 사람이 읽을 문장만 준다.

           재현 경로: workflow_status.label 은 varchar(64) 인데 생성 API 에 길이 검사가 없다
           (원래의 uk_todo_tag 경로는 지금 서버가 중복을 접어서 더 이상 DB 까지 가지 않는다).
           어느 경로든 DB 계층 오류가 클라이언트로 새면 안 된다는 계약은 같다. */
        User owner = fx.user("owner");
        Workspace ws = fx.workspace("팀", owner);

        String tooLongLabel = "가".repeat(200); // varchar(64) 초과

        String body = mvc.perform(post("/api/statuses")
                        .header(HttpHeaders.AUTHORIZATION, fx.bearer(owner))
                        .header("X-Workspace-Id", ws.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "label", tooLongLabel, "color", "#000000", "category", "TODO"))))
                // 409 = 전용 handleDataAccess 를 탔다는 뜻. 이걸 확인하지 않으면 요청이
                // 그냥 성공했을 때도 아래 '문자열 없음' 검사가 통과해 버린다(공허한 통과 방지).
                .andExpect(status().isConflict())
                .andReturn().getResponse().getContentAsString();

        assertThat(json.readTree(body).get("message").asText())
                .isEqualTo("요청을 처리하지 못했어요. 화면을 새로고침한 뒤 다시 시도해 주세요.");
        assertThat(body).doesNotContainIgnoringCase("insert into");
        assertThat(body).doesNotContainIgnoringCase("update ");
        assertThat(body).doesNotContainIgnoringCase("workflow_status");
        assertThat(body).doesNotContainIgnoringCase("todo.");
        assertThat(body).doesNotContainIgnoringCase("varchar");
        assertThat(body).doesNotContainIgnoringCase("constraint");
        assertThat(body).doesNotContainIgnoringCase("org.hibernate");
        assertThat(body).doesNotContainIgnoringCase("sql");
    }

    @Test
    @DisplayName("경로 변수 타입이 틀리면 프레임워크 영문 메시지가 아니라 고정 한국어 400 이 나간다")
    void badPathVariableTypeReturnsFixedKoreanMessage() throws Exception {
        /* [고정하는 결함] MethodArgumentTypeMismatchException 이 RuntimeException 핸들러로
           떨어져 프레임워크 메시지가 그대로 사용자에게 갔다. 실제 응답:
             GET /api/todos/abc → 400
             "Method parameter 'id': Failed to convert value of type 'java.lang.String'
              to required type 'java.lang.Long'; For input string: \"abc\""
           패키지·파라미터 이름·내부 타입이 드러나고, 사용자는 읽어도 알 수 없다. */
        User owner = fx.user("owner");
        Workspace ws = fx.workspace("팀", owner);

        String body = mvc.perform(get("/api/todos/abc")
                        .header(HttpHeaders.AUTHORIZATION, fx.bearer(owner))
                        .header("X-Workspace-Id", ws.getId()))
                .andExpect(status().isBadRequest())
                .andReturn().getResponse().getContentAsString();

        assertThat(json.readTree(body).get("message").asText())
                .isEqualTo("요청 값이 올바르지 않습니다. 입력값을 확인해 주세요.");
        assertThat(body).doesNotContain("java.lang.String");
        assertThat(body).doesNotContain("Failed to convert");
    }
}
