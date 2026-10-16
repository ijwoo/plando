package com.example.todo;

import com.example.llm.model.LlmDecision;
import com.example.llm.service.ChatService;
import com.example.llm.service.LlmRouter;
import com.example.llm.util.WorkspaceHolder;
import com.example.todo.entity.Todo;
import com.example.todo.entity.User;
import com.example.todo.entity.Workspace;
import com.example.todo.repository.LogRepository;
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
 * 이미 그 값인 것을 또 바꾸지 않는다.
 *
 * [고정하는 결함] 실사용에서 나왔다. 다섯 건을 진행 중으로 바꾼 다음 턴에 "나머지도" 라고
 * 했더니 **방금 바꾼 것을 또 바꾸고 "바꿨어요" 라고 보고했다.**
 *
 * 한 요청 안의 중복 가드(executed)는 턴이 바뀌면 초기화된다. 그리고 수정 경로가 현재 값과
 * 비교하지 않아서 IN_PROGRESS → IN_PROGRESS 도 그대로 통과했다.
 *
 * 나쁜 점이 둘이다: 사용자에게 거짓으로 보고하고, 다단계에서는 모델이 "했다" 로 읽어
 * 남은 것을 처리할 단계(상한 5)를 헛되이 쓴다.
 */
class ChatNoOpUpdateTest extends IntegrationTestBase {

    @Autowired TestFixtures fx;
    @Autowired ChatService chatService;
    @Autowired TodoRepository todoRepository;
    @Autowired LogRepository logRepository;

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

    private void stubUpdate(Long todoId, String status) {
        LlmDecision d = new LlmDecision();
        d.setAction("update_task");
        d.setArgs(Map.of("taskId", "T-" + todoId, "status", status));
        when(llmRouter.decide(any(), any())).thenReturn(d);
    }

    private Map<String, Object> ask(String msg) {
        return chatService.handle(msg, new LinkedHashMap<>());
    }

    @SuppressWarnings("unchecked")
    private List<String> actionTypes(Map<String, Object> res) {
        return ((List<Map<String, Object>>) res.get("actions")).stream()
                .map(a -> String.valueOf(a.get("type"))).toList();
    }

    @Test
    @DisplayName("이미 진행 중이면 다시 바꾸지 않고 그렇다고 말한다")
    void alreadyInProgress() {
        User me = fx.user("noop1");
        Workspace ws = fx.workspace("중복 워크스페이스", me);
        loginAs(me, ws);
        Todo t = fx.todo(ws, me, "회의 준비");
        t.setStatus("IN_PROGRESS");
        todoRepository.save(t);

        stubUpdate(t.getId(), "IN_PROGRESS");
        Map<String, Object> res = ask("진행중으로 바꿔줘");

        assertThat(String.valueOf(res.get("assistantMessage")))
                .as("바꾼 게 없는데 '바꿨어요' 라고 하면 거짓 보고다")
                .doesNotContain("바꿨어요")
                .contains("이미").contains("진행 중");
        assertThat(actionTypes(res))
                .as("변경으로 세면 결과 카드 개수가 부풀려진다")
                .doesNotContain("TASK_UPDATED");
    }

    @Test
    @DisplayName("값이 다르면 그대로 바꾼다")
    void stillUpdatesWhenDifferent() {
        /* 과하게 막으면 정작 수정이 안 된다 — 반대 방향도 함께 고정한다. */
        User me = fx.user("noop2");
        Workspace ws = fx.workspace("중복 워크스페이스2", me);
        loginAs(me, ws);
        Todo t = fx.todo(ws, me, "회의 준비");   // 기본 TODO

        stubUpdate(t.getId(), "IN_PROGRESS");
        Map<String, Object> res = ask("진행중으로 바꿔줘");

        assertThat(actionTypes(res)).contains("TASK_UPDATED");
        assertThat(todoRepository.findById(t.getId()).orElseThrow().getStatus()).isEqualTo("IN_PROGRESS");
    }

    @Test
    @DisplayName("이미 그 값이면 변경 이력을 남기지 않는다")
    void doesNotLogChange() {
        /* 쓰지 않았으면 이력도 없어야 한다. 이력이 쌓이면 "누가 언제 바꿨나" 를 볼 때
           아무도 손대지 않은 변경이 줄줄이 나온다. */
        User me = fx.user("noop3");
        Workspace ws = fx.workspace("중복 워크스페이스3", me);
        loginAs(me, ws);
        Todo t = fx.todo(ws, me, "회의 준비");
        t.setStatus("IN_PROGRESS");
        todoRepository.save(t);
        long before = logRepository.findAll().stream().filter(l -> l.getTodoId().equals(t.getId())).count();

        stubUpdate(t.getId(), "IN_PROGRESS");
        ask("진행중으로 바꿔줘");

        long after = logRepository.findAll().stream().filter(l -> l.getTodoId().equals(t.getId())).count();
        assertThat(after).as("바꾼 게 없으면 이력도 늘지 않아야 한다").isEqualTo(before);
    }

    @Test
    @DisplayName("우선순위도 같은 규칙을 따른다")
    void samePriority() {
        User me = fx.user("noop4");
        Workspace ws = fx.workspace("중복 워크스페이스4", me);
        loginAs(me, ws);
        Todo t = fx.todo(ws, me, "계약서 검토");
        t.setPriority(com.example.todo.entity.Priority.HIGH);
        todoRepository.save(t);

        LlmDecision d = new LlmDecision();
        d.setAction("update_task");
        d.setArgs(Map.of("taskId", "T-" + t.getId(), "priority", "HIGH"));
        when(llmRouter.decide(any(), any())).thenReturn(d);

        Map<String, Object> res = ask("높음으로 바꿔줘");
        assertThat(String.valueOf(res.get("assistantMessage"))).contains("이미");
        assertThat(actionTypes(res)).doesNotContain("TASK_UPDATED");
    }
}
