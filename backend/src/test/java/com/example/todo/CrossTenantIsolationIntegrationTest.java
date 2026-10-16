package com.example.todo;

import com.example.todo.entity.Todo;
import com.example.todo.entity.User;
import com.example.todo.entity.Workspace;
import com.example.todo.entity.WorkspaceRole;
import com.example.todo.repository.RecruitmentRepository;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 크로스 테넌트 격리 (commit 2c51743 — 워크스페이스 탈취 1건 + 정보 유출 1건).
 */
class CrossTenantIsolationIntegrationTest extends IntegrationTestBase {

    @Autowired TestFixtures fx;
    @Autowired RecruitmentRepository recruitmentRepository;

    private String recruitmentBody(Long workspaceId) throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("title", "모집글");
        body.put("summary", "소개");
        body.put("category", "스터디");
        body.put("maxMembers", 4);
        body.put("workspaceId", workspaceId);
        return json.writeValueAsString(body);
    }

    @Test
    @DisplayName("내가 속하지 않은 워크스페이스 id 로는 모집글을 만들 수 없다")
    void recruitmentCannotBeLinkedToForeignWorkspace() throws Exception {
        /* [고정하는 결함] 예전엔 클라이언트가 준 workspaceId 를 findById 만 하고 소속을
           확인하지 않았다. 워크스페이스 id 는 순차값이라 추측이 쉽고, 남의 id 로 모집글을
           만들면 그 글의 '작성자'가 된다. 상세 응답은 작성자에게 **그 워크스페이스의
           초대코드를 그대로 내려주므로**, 그 코드로 join 하면 남의 팀에 MEMBER 로 들어갈
           수 있었다. 게다가 지원 수락 처리는 joinWorkspace 의 가드를 우회해 멤버를 직접
           심으므로, 작성자가 임의의 사람을 남의 팀에 넣는 것까지 가능했다 — 워크스페이스 탈취.
           내가 참여 중인 워크스페이스만 연결할 수 있어야 한다. */
        User victim = fx.user("victim");
        Workspace victimWs = fx.workspace("피해자 팀", victim);

        User attacker = fx.user("attacker");
        Workspace attackerWs = fx.workspace("공격자 팀", attacker);

        long before = recruitmentRepository.count();

        mvc.perform(post("/api/recruitments")
                        .header(HttpHeaders.AUTHORIZATION, fx.bearer(attacker))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(recruitmentBody(victimWs.getId())))
                .andExpect(status().isForbidden());

        assertThat(recruitmentRepository.count()).isEqualTo(before);

        // 자기 워크스페이스는 정상적으로 연결된다 — 기능을 죽이지 않았음을 함께 고정
        mvc.perform(post("/api/recruitments")
                        .header(HttpHeaders.AUTHORIZATION, fx.bearer(attacker))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(recruitmentBody(attackerWs.getId())))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("다른 워크스페이스의 할 일을 DM 에 링크해도 제목이 새어 나오지 않는다")
    void dmLinkedTodoFromAnotherWorkspaceIsNotLeaked() throws Exception {
        /* [고정하는 결함] sendMessage 는 replyToId 는 '같은 방인가'를 검사하면서
           linkedTodoId 는 무검증으로 저장했고, 조회 쪽도 워크스페이스 스코프 없는
           findById 로 제목·상태를 응답에 실었다. 임의의 정수를 넣어 메시지를 보내면
           **다른 팀의 할 일 제목이 그대로 돌아왔다** — id 를 1부터 훑으면 전 테넌트 덤프.
           지금은 저장 시 방의 워크스페이스로 스코프해 걸러내고(무효면 null 저장),
           조회(단건·배치)에서도 한 번 더 거른다. 두 경로 모두 확인한다. */
        User victim = fx.user("victim");
        Workspace victimWs = fx.workspace("피해자 팀", victim);
        Todo secret = fx.todo(victimWs, victim, "대외비 인수합병 계획");

        User attacker = fx.user("attacker");
        Workspace attackerWs = fx.workspace("공격자 팀", attacker);
        User buddy = fx.user("buddy");
        fx.member(attackerWs, buddy, WorkspaceRole.MEMBER);

        String roomJson = mvc.perform(post("/api/dm/rooms")
                        .header(HttpHeaders.AUTHORIZATION, fx.bearer(attacker))
                        .header("X-Workspace-Id", attackerWs.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("partnerId", buddy.getId()))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        long roomId = json.readTree(roomJson).get("id").asLong();

        // 전송 응답 — 저장 시점에 걸러졌는지
        String sent = mvc.perform(post("/api/dm/rooms/" + roomId + "/messages")
                        .header(HttpHeaders.AUTHORIZATION, fx.bearer(attacker))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "content", "이거 봐",
                                "linkedTodoId", secret.getId()))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        assertThat(sent).doesNotContain("대외비 인수합병 계획");
        JsonNode sentNode = json.readTree(sent);
        assertThat(sentNode.get("linkedTodoTitle").isNull()).isTrue();
        assertThat(sentNode.get("linkedTodoId").isNull()).isTrue();

        // 목록 조회 응답(배치 경로) — 과거 데이터 대비 필터도 살아 있는지
        String list = mvc.perform(get("/api/dm/rooms/" + roomId + "/messages")
                        .header(HttpHeaders.AUTHORIZATION, fx.bearer(attacker)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        assertThat(list).doesNotContain("대외비 인수합병 계획");
    }
}
