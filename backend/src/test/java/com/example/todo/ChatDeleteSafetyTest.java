package com.example.todo;

import com.example.llm.model.LlmDecision;
import com.example.llm.service.ChatService;
import com.example.llm.service.LlmRouter;
import com.example.llm.util.WorkspaceHolder;
import com.example.todo.entity.User;
import com.example.todo.entity.Workspace;
import com.example.todo.repository.TodoRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * 삭제는 되돌릴 수 없다.
 *
 * [고정하는 결함] 제목이 얼추 걸치기만 해도 후보가 하나면 곧바로 지웠다. 프로덕션 실측에서
 * **"분기 실적 보고서 삭제해줘" 가 "분기 실적 보고서 최종본 정리" 를 지웠다.**
 * 그리고 답변은 "1314번 일정을 삭제했어요" 라서 무엇을 잃었는지도 알 수 없었다.
 *
 * 수정에는 같은 제한을 두지 않는다 — 잘못 바꿔도 되돌릴 수 있다. 삭제만 엄격하다.
 */
class ChatDeleteSafetyTest extends IntegrationTestBase {

    @Autowired TestFixtures fx;
    @Autowired ChatService chatService;
    @Autowired TodoRepository todoRepository;

    @MockitoBean LlmRouter llmRouter;

    @AfterEach
    void cleanup() {
        WorkspaceHolder.clear();
        SecurityContextHolder.clearContext();
    }

    private void loginAs(User user, Workspace ws) {
        WorkspaceHolder.set(ws.getId());
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(user.getEmail(), null, List.of()));
    }

    private void stubDelete(String titleRef) {
        LlmDecision d = new LlmDecision();
        d.setAction("delete_task");
        d.setArgs(Map.of("taskId", titleRef));
        when(llmRouter.decide(any(), any())).thenReturn(d);
    }

    @SuppressWarnings("unchecked")
    private List<String> types(Map<String, Object> res) {
        return ((List<Map<String, Object>>) res.get("actions")).stream()
                .map(a -> String.valueOf(a.get("type"))).toList();
    }

    @Test
    @DisplayName("제목이 얼추만 맞으면 지우지 않고 되묻는다")
    void asksWhenTitleOnlyPartlyMatches() {
        User me = fx.user("del1");
        Workspace ws = fx.workspace("삭제 워크스페이스", me);
        loginAs(me, ws);
        var t = fx.todo(ws, me, "분기 실적 보고서 최종본 정리");

        stubDelete("분기 실적 보고서");
        Map<String, Object> res = chatService.handle("분기 실적 보고서 삭제해줘", new LinkedHashMap<>());

        assertThat(types(res)).as("확인 없이 지우면 안 된다").doesNotContain("TASK_DELETED");
        assertThat(String.valueOf(res.get("assistantMessage")))
                .contains("최종본 정리")           // 무엇을 말하는지 보여준다
                .contains("되돌릴 수 없어요");
        assertThat(todoRepository.findById(t.getId())).as("아직 남아 있어야 한다").isPresent();
    }

    @Test
    @DisplayName("되물은 뒤 '네' 라고 하면 지운다")
    void deletesAfterConfirmation() {
        User me = fx.user("del2");
        Workspace ws = fx.workspace("삭제 워크스페이스2", me);
        loginAs(me, ws);
        var t = fx.todo(ws, me, "분기 실적 보고서 최종본 정리");

        stubDelete("분기 실적 보고서");
        Map<String, Object> ctx = new LinkedHashMap<>();
        Map<String, Object> asked = chatService.handle("분기 실적 보고서 삭제해줘", ctx);

        // 되묻기가 남긴 컨텍스트를 그대로 이어 보낸다(클라이언트가 하는 일)
        Map<String, Object> next = new LinkedHashMap<>();
        for (Map<String, Object> a : (List<Map<String, Object>>) asked.get("actions")) {
            if ("NEED_MORE_INFO".equals(a.get("type"))) {
                Map<String, Object> p = (Map<String, Object>) a.get("payload");
                next.put("pendingAction", p.get("pendingAction"));
                next.put("pendingMissingFields", p.get("missingFields"));
                next.put("pendingArgs", p.get("pendingArgs"));
            }
        }
        Map<String, Object> res = chatService.handle("네", next);

        assertThat(types(res)).contains("TASK_DELETED");
        assertThat(todoRepository.findById(t.getId())).isEmpty();
    }

    @Test
    @DisplayName("되물었는데 모르는 대답이면 지우지 않는다")
    void doesNotDeleteOnUnclearAnswer() {
        /* 되돌릴 수 없는 일에서 모호한 대답을 승낙으로 읽으면 안 된다. */
        User me = fx.user("del3");
        Workspace ws = fx.workspace("삭제 워크스페이스3", me);
        loginAs(me, ws);
        var t = fx.todo(ws, me, "분기 실적 보고서 최종본 정리");

        stubDelete("분기 실적 보고서");
        Map<String, Object> ctx = new LinkedHashMap<>();
        Map<String, Object> asked = chatService.handle("분기 실적 보고서 삭제해줘", ctx);

        Map<String, Object> next = new LinkedHashMap<>();
        for (Map<String, Object> a : (List<Map<String, Object>>) asked.get("actions")) {
            if ("NEED_MORE_INFO".equals(a.get("type"))) {
                Map<String, Object> p = (Map<String, Object>) a.get("payload");
                next.put("pendingAction", p.get("pendingAction"));
                next.put("pendingMissingFields", p.get("missingFields"));
                next.put("pendingArgs", p.get("pendingArgs"));
            }
        }
        Map<String, Object> res = chatService.handle("음 글쎄", next);

        assertThat(types(res)).doesNotContain("TASK_DELETED");
        assertThat(todoRepository.findById(t.getId())).isPresent();
    }

    @Test
    @DisplayName("제목이 정확히 맞으면 바로 지우고, 무엇을 지웠는지 말한다")
    void deletesExactMatchAndNamesIt() {
        /* 과하게 막으면 정상 삭제가 안 된다 — 반대 방향도 고정한다.
           그리고 번호가 아니라 제목을 말해야 무엇을 잃었는지 안다. */
        User me = fx.user("del4");
        Workspace ws = fx.workspace("삭제 워크스페이스4", me);
        loginAs(me, ws);
        var t = fx.todo(ws, me, "출장 정산");

        stubDelete("출장 정산");
        Map<String, Object> res = chatService.handle("출장 정산 삭제해줘", new LinkedHashMap<>());

        assertThat(types(res)).contains("TASK_DELETED");
        assertThat(String.valueOf(res.get("assistantMessage")))
                .as("번호는 사용자가 기억하는 이름이 아니다")
                .contains("출장 정산").contains("되돌릴 수 없어요");
        assertThat(todoRepository.findById(t.getId())).isEmpty();
    }
}
