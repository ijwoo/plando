package com.example.todo;

import com.example.llm.model.LlmDecision;
import com.example.llm.service.ChatService;
import com.example.llm.service.LlmRouter;
import com.example.llm.util.WorkspaceHolder;
import com.example.todo.entity.User;
import com.example.todo.entity.Workspace;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * AI 가 실행한 단계가 응답에 실리는지.
 *
 * 왜 필요한가: 예전에는 AI 가 무엇을 했는지 알 방법이 결과 문장 하나뿐이었다.
 * "3건을 찾았어요" 는 **어떤 조건으로** 찾았는지 말해주지 않아서, 결과가 이상해도 사용자는
 * 고칠 단서를 못 얻고 AI 를 못 믿게 될 뿐이었다.
 */
class AgentTraceTest extends IntegrationTestBase {

    @Autowired ChatService chatService;
    @Autowired TestFixtures fx;

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

    private void stubDecision(String action, Map<String, Object> args) {
        LlmDecision d = new LlmDecision();
        d.setAction(action);
        d.setArgs(args);
        when(llmRouter.decide(any(), any())).thenReturn(d);
        when(llmRouter.decide(any(), any(), any())).thenReturn(d);
    }

    @Test
    @DisplayName("조회 요청이 도구·인자·건수가 담긴 단계로 기록된다")
    void searchIsRecordedAsStep() {
        User me = fx.user("tracer");
        Workspace ws = fx.workspace("추적 워크스페이스", me);
        fx.todo(ws, me, "보고서 초안");
        loginAs(me, ws);

        stubDecision("search_tasks", Map.of("query", "보고서"));

        Map<String, Object> res = chatService.handle("보고서 찾아줘", Map.of());

        assertThat(res).containsKey("steps");
        List<?> steps = (List<?>) res.get("steps");
        assertThat(steps).as("실행한 도구가 단계로 남아야 한다").hasSize(1);

        var step = steps.get(0);
        assertThat(step).hasFieldOrPropertyWithValue("tool", "search_tasks");
        assertThat(step).hasFieldOrPropertyWithValue("ok", true);
        assertThat(step).hasFieldOrPropertyWithValue("mutating", false);

        assertThat(String.valueOf(step))
                .as("단계 객체가 직렬화 가능한 형태여야 화면까지 간다")
                .isNotBlank();
    }

    @Test
    @DisplayName("데이터를 바꾸는 도구는 mutating 으로 표시된다")
    void mutatingToolIsMarkedInTrace() {
        /* 화면에서 "무엇을 바꿨는지"를 다르게 표시하고, 되돌리기 안내의 근거가 된다.
           조회와 삭제가 같은 모양으로 보이면 사용자는 위험한 동작을 알아채지 못한다. */
        User me = fx.user("tracer2");
        Workspace ws = fx.workspace("추적 워크스페이스2", me);
        loginAs(me, ws);

        stubDecision("create_task", Map.of("title", "새 할 일"));

        Map<String, Object> res = chatService.handle("새 할 일 만들어줘", Map.of());

        List<?> steps = (List<?>) res.get("steps");
        assertThat(steps).hasSize(1);
        assertThat(steps.get(0)).hasFieldOrPropertyWithValue("mutating", true);
        assertThat(steps.get(0)).hasFieldOrPropertyWithValue("tool", "create_task");
    }

    @Test
    @DisplayName("도구가 실패하면 단계도 실패로 남는다 (예외가 안 났어도)")
    void failedToolIsRecordedAsFailedStep() {
        /* [고정하는 결함] 삭제·수정은 실패해도 예외 대신 ERROR 액션과 안내 문구를 돌려준다.
           그걸 성공으로 기록해서 **단계에는 초록 체크, 답변에는 "삭제하지 못했어요"** 가 동시에
           떴다. 화면이 서로 다른 말을 하면 사용자는 무엇을 믿어야 할지 모른다. */
        User me = fx.user("tracer4");
        Workspace ws = fx.workspace("추적 워크스페이스4", me);
        loginAs(me, ws);

        // 존재하지 않는 할 일 삭제 → 게이트웨이가 false 를 돌려주고 ERROR 액션이 실린다
        stubDecision("delete_task", Map.of("taskId", "T-99999999"));

        Map<String, Object> res = chatService.handle("그거 지워줘", Map.of());

        List<?> steps = (List<?>) res.get("steps");
        assertThat(steps).hasSize(1);
        assertThat(steps.get(0))
                .as("실패한 도구가 성공으로 남으면 화면이 거짓을 말한다")
                .hasFieldOrPropertyWithValue("ok", false);
        assertThat(String.valueOf(steps.get(0)))
                .as("단계 객체가 온전해야 화면까지 간다")
                .isNotBlank();
    }

    @Test
    @DisplayName("도구가 없는 응답(chat)에는 단계를 만들지 않는다")
    void chatHasNoSteps() {
        // 아무 도구도 안 쓴 대화에 빈 단계 목록을 붙이면 화면에 의미 없는 껍데기가 생긴다.
        User me = fx.user("tracer3");
        Workspace ws = fx.workspace("추적 워크스페이스3", me);
        loginAs(me, ws);

        stubDecision("chat", Map.of());

        Map<String, Object> res = chatService.handle("안녕", Map.of());
        assertThat(res).doesNotContainKey("steps");
    }
}
