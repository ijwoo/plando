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
 * AI 가 바꾼 것도 활동 이력에 남는다.
 *
 * [고정하는 결함] 프로덕션 실측에서 **AI 수정이 이력에 한 건도 안 남았다.**
 * DbTaskRepository 가 todoRepository.save() 를 직접 불러서, 이력을 남기는 TodoService 를
 * 거치지 않았기 때문이다. 그래서 AI 로 다섯 건을 바꿔도 활동 탭은 비어 있었고
 * "이거 누가 바꿨지" 를 볼 수 없었다. 되돌릴 근거도 사라진다.
 *
 * 필드명은 수기 편집과 **같아야** 한다 — 다르면 같은 변경이 AI 것만 다르게 그려진다.
 */
class AiChangeLogTest extends IntegrationTestBase {

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

    private List<com.example.todo.entity.TodoLog> logsOf(Long todoId) {
        return logRepository.findAll().stream().filter(l -> l.getTodoId().equals(todoId)).toList();
    }

    @Test
    @DisplayName("AI 상태 변경이 이력에 남는다")
    void logsStatusChange() {
        User me = fx.user("log1");
        Workspace ws = fx.workspace("이력 워크스페이스", me);
        loginAs(me, ws);
        Todo t = fx.todo(ws, me, "보고서");

        LlmDecision d = new LlmDecision();
        d.setAction("update_task");
        d.setArgs(Map.of("taskId", "T-" + t.getId(), "status", "IN_PROGRESS"));
        when(llmRouter.decide(any(), any())).thenReturn(d);

        chatService.handle("진행중으로 바꿔줘", new LinkedHashMap<>());

        var logs = logsOf(t.getId());
        assertThat(logs).as("AI 가 바꿨는데 이력이 없으면 누가 한 건지 알 수 없다").isNotEmpty();
        var statusLog = logs.stream().filter(l -> "status".equals(l.getField())).findFirst();
        assertThat(statusLog).isPresent();
        assertThat(statusLog.get().getBeforeValue()).as("되돌리려면 이전 값이 필요하다").isEqualTo("TODO");
        assertThat(statusLog.get().getAfterValue()).isEqualTo("IN_PROGRESS");
        assertThat(statusLog.get().getModifier()).isEqualTo(me.getEmail());
    }

    @Test
    @DisplayName("필드명이 수기 편집과 같다")
    void usesSameFieldNames() {
        /* 활동 탭은 필드명으로 문장을 만든다(todoLogFormatters). 이름이 어긋나면
           같은 변경이 AI 것만 "태스크를 수정했어요" 로 뭉뚱그려진다. */
        User me = fx.user("log2");
        Workspace ws = fx.workspace("이력 워크스페이스2", me);
        loginAs(me, ws);
        Todo t = fx.todo(ws, me, "보고서");

        LlmDecision d = new LlmDecision();
        d.setAction("update_task");
        d.setArgs(Map.of("taskId", "T-" + t.getId(), "priority", "HIGH"));
        when(llmRouter.decide(any(), any())).thenReturn(d);

        chatService.handle("높음으로 바꿔줘", new LinkedHashMap<>());

        assertThat(logsOf(t.getId())).extracting("field").contains("priority");
    }

    @Test
    @DisplayName("바뀐 게 없으면 이력도 안 남는다")
    void noLogWhenNothingChanged() {
        /* 이력이 부풀면 "누가 언제 바꿨나" 를 볼 때 아무도 손대지 않은 변경이 줄줄이 나온다. */
        User me = fx.user("log3");
        Workspace ws = fx.workspace("이력 워크스페이스3", me);
        loginAs(me, ws);
        Todo t = fx.todo(ws, me, "보고서");
        t.setStatus("IN_PROGRESS");
        todoRepository.save(t);
        int before = logsOf(t.getId()).size();

        LlmDecision d = new LlmDecision();
        d.setAction("update_task");
        d.setArgs(Map.of("taskId", "T-" + t.getId(), "status", "IN_PROGRESS"));
        when(llmRouter.decide(any(), any())).thenReturn(d);

        chatService.handle("진행중으로 바꿔줘", new LinkedHashMap<>());
        assertThat(logsOf(t.getId())).hasSize(before);
    }
}
