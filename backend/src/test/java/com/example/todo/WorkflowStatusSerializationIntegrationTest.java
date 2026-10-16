package com.example.todo;

import com.example.todo.entity.User;
import com.example.todo.entity.Workspace;
import com.fasterxml.jackson.core.type.TypeReference;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * GET /api/statuses 의 직렬화 계약 (commit a2114ed).
 */
class WorkflowStatusSerializationIntegrationTest extends IntegrationTestBase {

    @Autowired TestFixtures fx;

    @Test
    @DisplayName("기본 상태 플래그는 JSON 키 `isDefault` 로 나가야 한다 (`default` 아님)")
    void defaultFlagIsSerializedAsIsDefault() throws Exception {
        /* [고정하는 결함] primitive boolean 의 getter 는 isDefault() 라서 Jackson 이
           프로퍼티 이름을 "default" 로 잡았고, JSON 키가 `default` 로 나갔다.
           그런데 웹과 iOS 앱 **둘 다** `isDefault` 를 읽고 있었다. 오류 없이 undefined 가
           되어, 워크스페이스가 지정한 기본 상태가 양쪽 모두에서 조용히 무시되고
           "첫 미시작 상태"로 폴백됐다(기본 상태 별표가 안 켜지고, 완료 취소가 엉뚱한
           상태로 가던 원인). 값이 아니라 **키 이름**이 계약이므로 키를 직접 검사한다.
           `default` 키가 없다는 것도 함께 본다 — 필드명을 isDefault 로 두면 Jackson 이
           두 키를 모두 내보내 클라이언트가 어느 쪽을 믿을지 모르게 된다. */
        User owner = fx.user("owner");
        Workspace ws = fx.workspace("팀", owner);

        String body = mvc.perform(get("/api/statuses")
                        .header(HttpHeaders.AUTHORIZATION, fx.bearer(owner))
                        .header("X-Workspace-Id", ws.getId()))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        List<Map<String, Object>> statuses = json.readValue(body, new TypeReference<>() {});
        assertThat(statuses).isNotEmpty();

        for (Map<String, Object> s : statuses) {
            assertThat(s).containsKey("isDefault");
            assertThat(s).doesNotContainKey("default");
        }

        // 기본 3상태 시드에서 기본값은 TODO 하나뿐 — 값 자체도 실려 나가는지 확인
        List<Map<String, Object>> defaults = statuses.stream()
                .filter(s -> Boolean.TRUE.equals(s.get("isDefault")))
                .toList();
        assertThat(defaults).hasSize(1);
        assertThat(defaults.get(0).get("statusKey")).isEqualTo("TODO");
    }
}
