package com.example.todo;

import com.example.llm.model.LlmDecision;
import com.example.llm.repo.DbTaskRepository;
import com.example.llm.service.ChatService;
import com.example.llm.service.LlmRouter;
import com.example.llm.util.WorkspaceHolder;
import com.example.todo.entity.Todo;
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

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * "이번주 할 일" 처럼 하루가 아닌 조회.
 *
 * [고정하는 결함] 도구에 날짜가 dueDate 하나뿐이라, 모델이 "이번주"를 **이번주 금요일 하루**로
 * 좁혔다. 그 결과 월요일에 있던 일정이 통째로 빠졌는데 화면에는 "일정은 없어요"라고 떴다.
 * 조회가 조용히 틀리는 건 오류보다 나쁘다 — 사용자는 없는 줄 알고 넘어간다.
 *
 * 그래서 여기서 못 박는 것:
 *  1. 기간이 주어지면 그 사이 **모든 날짜**가 나온다.
 *  2. 기간 밖은 안 나온다(전체 조회로 퇴화하지 않는다).
 *  3. 보관된 것은 빠진다 — "이번주 할 일"은 살아 있는 것을 뜻한다.
 */
class ChatSearchRangeTest extends IntegrationTestBase {

    @Autowired TestFixtures fx;
    @Autowired DbTaskRepository taskRepository;
    @Autowired TodoRepository todoRepository;
    @Autowired ChatService chatService;

    @MockitoBean LlmRouter llmRouter;

    @AfterEach
    void clearHolder() {
        WorkspaceHolder.clear();
        SecurityContextHolder.clearContext();
    }

    private Todo todoOn(Workspace ws, User me, String title, LocalDate due) {
        Todo t = fx.todo(ws, me, title);
        t.setDueDate(due);
        return todoRepository.save(t);
    }

    @Test
    @DisplayName("기간 조회는 시작·중간·끝 날짜를 모두 포함한다")
    void rangeCoversEveryDayInclusive() {
        User me = fx.user("range1");
        Workspace ws = fx.workspace("기간 조회 워크스페이스", me);
        WorkspaceHolder.set(ws.getId());

        LocalDate monday = LocalDate.of(2026, 8, 3);
        LocalDate sunday = monday.plusDays(6);

        todoOn(ws, me, "월요일 일정", monday);              // 경계 시작
        todoOn(ws, me, "화요일 저녁약속", monday.plusDays(1));
        todoOn(ws, me, "일요일 일정", sunday);              // 경계 끝
        todoOn(ws, me, "지난주 일정", monday.minusDays(1)); // 기간 밖
        todoOn(ws, me, "다음주 일정", sunday.plusDays(1));  // 기간 밖

        var found = taskRepository.searchRange(me.getEmail(), monday, sunday, null, null, null, 50);

        assertThat(found).extracting(t -> t.title)
                .as("하루로 좁히면 화요일 일정이 빠진다 — 그게 원래 버그였다")
                .containsExactlyInAnyOrder("월요일 일정", "화요일 저녁약속", "일요일 일정");
    }

    @Test
    @DisplayName("보관된 할 일은 기간 조회에 나오지 않는다")
    void archivedIsExcluded() {
        User me = fx.user("range2");
        Workspace ws = fx.workspace("기간 조회 워크스페이스2", me);
        WorkspaceHolder.set(ws.getId());

        LocalDate day = LocalDate.of(2026, 8, 5);
        todoOn(ws, me, "살아있는 일정", day);

        Todo archived = todoOn(ws, me, "보관된 일정", day);
        archived.setArchived(true);
        todoRepository.save(archived);

        var found = taskRepository.searchRange(me.getEmail(), day.minusDays(2), day.plusDays(2),
                null, null, null, 50);

        assertThat(found).extracting(t -> t.title).containsExactly("살아있는 일정");
    }

    @Test
    @DisplayName("기간 조회도 워크스페이스를 넘지 않는다")
    void rangeStaysInsideWorkspace() {
        /* 단일 날짜 조회에는 격리 테스트가 있는데 새 경로에 없으면, 같은 실수를 새 문으로
           다시 하게 된다. 조회 경로가 늘 때마다 같은 것을 못 박는다. */
        User me = fx.user("range3");
        Workspace mine = fx.workspace("내 워크스페이스", me);
        User other = fx.user("range4");
        Workspace theirs = fx.workspace("남의 워크스페이스", other);

        LocalDate day = LocalDate.of(2026, 8, 5);
        todoOn(theirs, other, "남의 일정", day);
        todoOn(mine, me, "내 일정", day);

        WorkspaceHolder.set(mine.getId());
        var found = taskRepository.searchRange(me.getEmail(), day.minusDays(3), day.plusDays(3),
                null, null, null, 50);

        assertThat(found).extracting(t -> t.title).containsExactly("내 일정");
    }

    @Test
    @DisplayName("대화 경로 전체: 기간 인자가 조회까지 닿고 답변에 기간이 나온다")
    void rangeFlowsThroughChatService() {
        /* 저장소만 고쳐도 ChatService 가 dueFrom·dueTo 를 안 읽으면 사용자에게는 아무것도 안 바뀐다.
           그 구간이 이 버그의 실제 지점이었으므로 대화 경로로도 한 번 통과시킨다. */
        User me = fx.user("range5");
        Workspace ws = fx.workspace("대화 경로 워크스페이스", me);
        WorkspaceHolder.set(ws.getId());
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(me.getEmail(), null, List.of()));

        LocalDate monday = LocalDate.of(2026, 8, 3);
        todoOn(ws, me, "월요일 일정", monday);
        todoOn(ws, me, "화요일 저녁약속", monday.plusDays(1));

        LlmDecision decision = new LlmDecision();
        decision.setAction("search_tasks");
        decision.setArgs(Map.of("dueFrom", monday.toString(), "dueTo", monday.plusDays(6).toString()));
        when(llmRouter.decide(any(), any())).thenReturn(decision);   // handle() 은 2-인자 오버로드를 쓴다

        Map<String, Object> res = chatService.handle("이번주 할 일 알려줘", null);

        assertThat(String.valueOf(res.get("assistantMessage")))
                .as("하루로 좁히면 \"...일정은 없어요\" 가 뜬다 — 그게 사용자가 겪은 화면이었다")
                .contains("2개");
        assertThat(String.valueOf(res.get("assistantMessage")))
                .as("하루가 아니라 기간을 조회했음이 문장에 드러나야 한다")
                .contains("2026-08-03 ~ 2026-08-09");
    }

    @Test
    @DisplayName("단계 추적에 조회한 기간이 드러난다")
    void traceShowsTheRange() {
        /* [고정하는 결함] 단계에 보여줄 인자를 화이트리스트로 추리는데 dueFrom·dueTo 를 안 넣어서
           "할 일 조회 {limit: 50}" 으로만 떴다. 어느 범위를 본 건지 알 수 없으면, 결과가 이상해도
           사용자가 짚어낼 수가 없다 — 이 버그를 신고할 수 있었던 이유가 바로 날짜가 보였기 때문이다. */
        User me = fx.user("range6");
        Workspace ws = fx.workspace("추적 워크스페이스", me);
        WorkspaceHolder.set(ws.getId());
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(me.getEmail(), null, List.of()));

        LocalDate monday = LocalDate.of(2026, 8, 3);
        todoOn(ws, me, "월요일 일정", monday);

        LlmDecision decision = new LlmDecision();
        decision.setAction("search_tasks");
        decision.setArgs(Map.of("dueFrom", monday.toString(), "dueTo", monday.plusDays(6).toString()));
        when(llmRouter.decide(any(), any())).thenReturn(decision);

        Map<String, Object> res = chatService.handle("이번주 할 일 알려줘", null);

        @SuppressWarnings("unchecked")
        List<com.example.llm.agent.AgentStep> steps =
                (List<com.example.llm.agent.AgentStep>) res.get("steps");
        assertThat(steps).isNotEmpty();
        assertThat(steps.get(0).getArgs())
                .as("날짜가 빠지면 어느 범위를 조회했는지 화면에서 알 수 없다")
                .containsEntry("dueFrom", "2026-08-03")
                .containsEntry("dueTo", "2026-08-09");
        assertThat(steps.get(0).getSummary()).contains("2026-08-03 ~ 2026-08-09");
    }
}
