package com.example.todo;

import com.example.todo.entity.Todo;
import com.example.todo.entity.User;
import com.example.todo.entity.Workspace;
import com.example.todo.entity.WorkspaceRole;
import com.example.todo.repository.TodoRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 샘플 할 일 보호 규칙과 역할 기반 편집 권한(PermissionService)을 HTTP 경계에서 고정한다.
 */
class TodoPermissionIntegrationTest extends IntegrationTestBase {

    @Autowired TestFixtures fx;
    @Autowired TodoRepository todoRepository;

    private String todoBody(String title) throws Exception {
        // priority 는 todo.priority 가 NOT NULL 이라 실제 클라이언트도 항상 보낸다.
        return json.writeValueAsString(Map.of("title", title, "status", "TODO", "priority", "MEDIUM"));
    }

    @Test
    @DisplayName("샘플 할 일은 OWNER 도 수정할 수 없다 (PUT·PATCH 양쪽)")
    void sampleTodoIsReadOnlyEvenForOwner() throws Exception {
        /* [고정하는 결함] 샘플(isSample)은 온보딩 시드라 역할과 무관하게 읽기 전용이다.
           바로 아래 테스트에서 "샘플 **삭제**는 ADMIN+ 에게 허용"으로 규칙을 열었는데
           (commit a2114ed — 남의 워크스페이스에 심긴 샘플을 치울 방법이 없던 문제),
           그 예외가 **수정**까지 번지면 안 된다. 최고 권한인 OWNER 로도 403 이어야 한다.
           PATCH 는 예전에 권한 검사를 통째로 우회하는 경로였으므로 함께 못 박는다. */
        User owner = fx.user("owner");
        Workspace ws = fx.workspace("팀", owner);
        Todo sample = fx.sampleTodo(ws, owner, "온보딩 샘플");

        mvc.perform(put("/api/todos/" + sample.getId())
                        .header(HttpHeaders.AUTHORIZATION, fx.bearer(owner))
                        .header("X-Workspace-Id", ws.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(todoBody("수정 시도")))
                .andExpect(status().isForbidden());

        mvc.perform(patch("/api/todos/" + sample.getId())
                        .header(HttpHeaders.AUTHORIZATION, fx.bearer(owner))
                        .header("X-Workspace-Id", ws.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("field", "title", "value", "수정 시도"))))
                .andExpect(status().isForbidden());

        assertThat(todoRepository.findById(sample.getId()).orElseThrow().getTitle())
                .isEqualTo("온보딩 샘플");
    }

    @Test
    @DisplayName("샘플 할 일 삭제: MEMBER 는 403, ADMIN 은 허용")
    void sampleTodoDeleteIsAdminOnly() throws Exception {
        /* [고정하는 결함] 예전엔 샘플 삭제가 **역할 무관 전면 차단**이었다(403).
           그런데 샘플 생성 엔드포인트에 워크스페이스 검사가 없어서(commit a2114ed) 남의
           워크스페이스에 샘플이 심길 수 있었고, 그렇게 생긴 할 일은 그 워크스페이스의
           OWNER 조차 지울 수 없는 영구 쓰레기가 됐다.
           규칙을 "샘플 삭제 = ADMIN 이상"으로 좁혀 열었다. 두 방향을 다 고정한다 —
           MEMBER 는 여전히 못 지우고(보호), ADMIN 은 지울 수 있다(탈출구). */
        User owner = fx.user("owner");
        Workspace ws = fx.workspace("팀", owner);
        User memberUser = fx.user("member");
        fx.member(ws, memberUser, WorkspaceRole.MEMBER);
        User adminUser = fx.user("admin");
        fx.member(ws, adminUser, WorkspaceRole.ADMIN);

        Todo forMember = fx.sampleTodo(ws, owner, "샘플1");
        mvc.perform(delete("/api/todos/" + forMember.getId())
                        .header(HttpHeaders.AUTHORIZATION, fx.bearer(memberUser))
                        .header("X-Workspace-Id", ws.getId()))
                .andExpect(status().isForbidden());
        assertThat(todoRepository.findById(forMember.getId())).isPresent();

        Todo forAdmin = fx.sampleTodo(ws, owner, "샘플2");
        mvc.perform(delete("/api/todos/" + forAdmin.getId())
                        .header(HttpHeaders.AUTHORIZATION, fx.bearer(adminUser))
                        .header("X-Workspace-Id", ws.getId()))
                .andExpect(status().isOk());
        assertThat(todoRepository.findById(forAdmin.getId())).isEmpty();
    }

    @Test
    @DisplayName("VIEWER 는 할 일을 만들 수 없고 MEMBER 는 만들 수 있다")
    void viewerCannotCreateTodoButMemberCan() throws Exception {
        /* [고정하는 결함] 생성 권한 검사가 컨트롤러마다 흩어져 있어 역할이 무시되는
           진입점이 있었다. 지금은 POST /api/todos 가 requireCanCreateContent(MEMBER+)를
           반드시 통과한다. VIEWER=읽기 전용이라는 계약을 HTTP 경계에서 고정한다.
           (한쪽만 확인하면 "전부 막혔다"는 회귀를 못 잡으므로 MEMBER 성공도 함께 본다.) */
        User owner = fx.user("owner");
        Workspace ws = fx.workspace("팀", owner);
        User viewer = fx.user("viewer");
        fx.member(ws, viewer, WorkspaceRole.VIEWER);
        User memberUser = fx.user("member");
        fx.member(ws, memberUser, WorkspaceRole.MEMBER);

        mvc.perform(post("/api/todos")
                        .header(HttpHeaders.AUTHORIZATION, fx.bearer(viewer))
                        .header("X-Workspace-Id", ws.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(todoBody("뷰어가 만든 할 일")))
                .andExpect(status().isForbidden());

        mvc.perform(post("/api/todos")
                        .header(HttpHeaders.AUTHORIZATION, fx.bearer(memberUser))
                        .header("X-Workspace-Id", ws.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(todoBody("멤버가 만든 할 일")))
                .andExpect(status().isOk());
    }
}
