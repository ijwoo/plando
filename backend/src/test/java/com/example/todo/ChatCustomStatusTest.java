package com.example.todo;

import com.example.llm.model.LlmDecision;
import com.example.llm.service.ChatService;
import com.example.llm.service.LlmRouter;
import com.example.llm.util.WorkspaceHolder;
import com.example.todo.entity.User;
import com.example.todo.entity.WorkflowStatus;
import com.example.todo.entity.Workspace;
import com.example.todo.repository.WorkflowStatusRepository;
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
 * 커스텀 상태를 사람 말로 부른다.
 *
 * [고정하는 결함] 답변 문구가 기본 3개(TODO·IN_PROGRESS·DONE)만 알아서, 커스텀 상태로
 * 바꾸면 **"st_b823cdb609 상태로 바꿨어요"** 처럼 내부 키가 그대로 나갔다.
 * 프로덕션에 '검토중'·'배포대기' 같은 커스텀 상태가 실제로 쓰이고 있다.
 *
 * 프롬프트에는 라벨(상태(라벨=key))을 넣어주면서 정작 답변에서는 못 쓰던 셈이다.
 */
class ChatCustomStatusTest extends IntegrationTestBase {

    @Autowired TestFixtures fx;
    @Autowired ChatService chatService;
    @Autowired WorkflowStatusRepository workflowStatusRepository;

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

    /** 워크스페이스에 커스텀 상태를 하나 만든다. */
    private void addStatus(Workspace ws, String key, String label, int order) {
        WorkflowStatus s = new WorkflowStatus();
        s.setWorkspace(ws);
        s.setStatusKey(key);
        s.setLabel(label);
        s.setSortOrder(order);
        s.setCategory(com.example.todo.entity.StatusCategory.IN_PROGRESS);
        s.setColor("#3B82F6");
        workflowStatusRepository.save(s);
    }

    @Test
    @DisplayName("커스텀 상태는 라벨로 말한다")
    void usesCustomLabel() {
        User me = fx.user("st1");
        Workspace ws = fx.workspace("상태 워크스페이스", me);
        loginAs(me, ws);
        addStatus(ws, "st_b823cdb609", "검토중", 10);
        var t = fx.todo(ws, me, "보고서");

        LlmDecision d = new LlmDecision();
        d.setAction("update_task");
        d.setArgs(Map.of("taskId", "T-" + t.getId(), "status", "st_b823cdb609"));
        when(llmRouter.decide(any(), any())).thenReturn(d);

        Map<String, Object> res = chatService.handle("검토중으로 바꿔줘", new LinkedHashMap<>());

        String msg = String.valueOf(res.get("assistantMessage"));
        assertThat(msg).as("내부 키가 사용자에게 보이면 안 된다").doesNotContain("st_b823cdb609");
        assertThat(msg).contains("검토중");
    }

    @Test
    @DisplayName("기본 상태는 그대로 한국어로 나온다")
    void keepsBuiltInLabels() {
        /* 커스텀 조회가 끼어들어 기본 동작이 깨지면 안 된다 — 반대 방향도 고정한다. */
        User me = fx.user("st2");
        Workspace ws = fx.workspace("상태 워크스페이스2", me);
        loginAs(me, ws);
        var t = fx.todo(ws, me, "보고서");

        LlmDecision d = new LlmDecision();
        d.setAction("update_task");
        d.setArgs(Map.of("taskId", "T-" + t.getId(), "status", "IN_PROGRESS"));
        when(llmRouter.decide(any(), any())).thenReturn(d);

        Map<String, Object> res = chatService.handle("진행중으로 바꿔줘", new LinkedHashMap<>());
        assertThat(String.valueOf(res.get("assistantMessage"))).contains("진행 중");
    }

    @Test
    @DisplayName("모르는 키는 있는 그대로 두되 답변은 나간다")
    void unknownKeyDoesNotBreak() {
        /* 라벨 조회는 덤이다. 못 찾는다고 답변을 잃으면 배보다 배꼽이 크다. */
        User me = fx.user("st3");
        Workspace ws = fx.workspace("상태 워크스페이스3", me);
        loginAs(me, ws);
        var t = fx.todo(ws, me, "보고서");

        LlmDecision d = new LlmDecision();
        d.setAction("update_task");
        d.setArgs(Map.of("taskId", "T-" + t.getId(), "status", "DONE"));
        when(llmRouter.decide(any(), any())).thenReturn(d);

        Map<String, Object> res = chatService.handle("완료로 바꿔줘", new LinkedHashMap<>());
        assertThat(String.valueOf(res.get("assistantMessage"))).isNotBlank().contains("완료");
    }
}
