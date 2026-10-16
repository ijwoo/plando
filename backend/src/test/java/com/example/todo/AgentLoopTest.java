package com.example.todo;

import com.example.llm.model.LlmDecision;
import com.example.llm.service.ChatService;
import com.example.llm.service.LlmRouter;
import com.example.llm.util.WorkspaceHolder;
import com.example.todo.entity.Todo;
import com.example.todo.entity.User;
import com.example.todo.entity.Workspace;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeast;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 다단계 실행 루프.
 *
 * 지켜야 할 성질 세 가지:
 *  1. **평범한 요청은 예전 그대로** — LLM 을 한 번만 부른다. 모든 요청이 두 배로 비싸지면 안 된다.
 *  2. **상한이 있다** — 무한 반복과 비용 폭주를 막는다.
 *  3. **중간에 실패해도 앞 결과를 살린다** — 통째로 날리면 무엇이 반영됐는지조차 알 수 없다.
 */
class AgentLoopTest extends IntegrationTestBase {

    @Autowired ChatService chatService;
    @Autowired TestFixtures fx;
    @Autowired com.example.todo.repository.TodoRepository todoRepository;

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

    private static LlmDecision decision(String action, Map<String, Object> args) {
        LlmDecision d = new LlmDecision();
        d.setAction(action);
        d.setArgs(new LinkedHashMap<>(args));
        return d;
    }

    /** 호출 순서대로 결정을 돌려준다. 다 떨어지면 마지막 것을 반복한다. */
    private void stubSequence(List<LlmDecision> seq) {
        List<LlmDecision> queue = new ArrayList<>(seq);
        when(llmRouter.decide(any(), any())).thenAnswer(inv ->
                queue.isEmpty() ? decision("chat", Map.of()) : queue.remove(0));
    }

    @Test
    @DisplayName("continue 가 없으면 LLM 을 한 번만 부른다 (비용 회귀 방지)")
    void singleStepDoesNotCallLlmTwice() {
        User me = fx.user("loop1");
        Workspace ws = fx.workspace("루프1", me);
        loginAs(me, ws);

        stubSequence(List.of(decision("search_tasks", Map.of("query", "보고서"))));

        Map<String, Object> res = chatService.handle("보고서 찾아줘", Map.of());

        verify(llmRouter, times(1)).decide(any(), any());
        assertThat((List<?>) res.get("steps")).hasSize(1);
    }

    @Test
    @DisplayName("continue 가 true 면 결과를 되먹여 다음 도구를 실행한다")
    void continuesWhenAsked() {
        User me = fx.user("loop2");
        Workspace ws = fx.workspace("루프2", me);
        loginAs(me, ws);

        stubSequence(List.of(
                decision("search_tasks", Map.of("overdue", true, "continue", true)),
                decision("create_task", Map.of("title", "후속 정리"))   // continue 없음 → 종료
        ));

        Map<String, Object> res = chatService.handle("지난 것들 정리하고 후속 만들어줘", Map.of());

        List<?> steps = (List<?>) res.get("steps");
        assertThat(steps).as("두 도구가 순서대로 실행돼야 한다").hasSize(2);
        assertThat(steps.get(0)).hasFieldOrPropertyWithValue("tool", "search_tasks");
        assertThat(steps.get(1)).hasFieldOrPropertyWithValue("tool", "create_task");
        verify(llmRouter, times(2)).decide(any(), any());
    }

    @Test
    @DisplayName("계속 continue 를 내도 상한에서 멈추고 그 사실을 알린다")
    void stopsAtMaxSteps() {
        /* [고정하는 결함] 상한이 없으면 LLM 이 continue 를 계속 내는 순간 요청 하나가
           무한히 도구를 부르고 비용이 폭주한다. 멈추는 것만으로는 부족하고,
           "여기까지만 했다"를 사용자에게 알려야 남은 일을 다시 시킬 수 있다. */
        User me = fx.user("loop3");
        Workspace ws = fx.workspace("루프3", me);
        loginAs(me, ws);

        /* 항상 continue 를 내되 **매번 다른 인자**로 낸다.
           같은 인자면 반복 가드가 먼저 잡아서 상한까지 가지 않는다 — 여기서 확인하려는 건
           "말은 되지만 끝없이 이어지는" 경우에도 상한이 있다는 것이다. */
        java.util.concurrent.atomic.AtomicInteger n = new java.util.concurrent.atomic.AtomicInteger();
        when(llmRouter.decide(any(), any())).thenAnswer(inv ->
                decision("search_tasks", Map.of("query", "x" + n.incrementAndGet(), "continue", true)));

        Map<String, Object> res = chatService.handle("계속 찾아줘", Map.of());

        List<?> steps = (List<?>) res.get("steps");
        assertThat(steps).as("상한(5)을 넘지 않아야 한다").hasSizeLessThanOrEqualTo(5);
        assertThat(String.valueOf(res.get("assistantMessage")))
                .as("어디까지 했는지 알려야 한다")
                .contains("여기까지");
        verify(llmRouter, atLeast(2)).decide(any(), any());
    }

    @Test
    @DisplayName("chat/need_more_info 로 넘어가면 루프를 멈춘다")
    void terminalActionStopsLoop() {
        User me = fx.user("loop4");
        Workspace ws = fx.workspace("루프4", me);
        loginAs(me, ws);

        stubSequence(List.of(
                decision("search_tasks", Map.of("query", "보고서", "continue", true)),
                decision("chat", Map.of())      // 더 할 게 없다
        ));

        Map<String, Object> res = chatService.handle("보고서 찾아줘", Map.of());

        assertThat((List<?>) res.get("steps"))
                .as("종료 action 은 단계로 남기지 않는다")
                .hasSize(1);
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> actionsOf(Map<String, Object> res, String type) {
        return ((List<Object>) res.get("actions")).stream()
                .map(a -> (Map<String, Object>) a)
                .filter(a -> type.equals(a.get("type")))
                .toList();
    }

    @Test
    @DisplayName("조회가 두 번이면 마지막 결과만 남아 답변 문장과 개수가 일치한다")
    void laterListingSupersedesEarlierOne() {
        /* [고정하는 결함] 답변은 마지막 조회("8개를 찾았어요")를 말하는데 화면 카드는
           첫 조회(3개)를 그렸다. 프론트가 첫 TASK_LISTED 를 집기 때문. 한 화면에서 숫자가
           서로 다른 두 개가 뜨면 사용자는 무엇을 믿어야 할지 모른다 — 실제로 신고받았다. */
        User me = fx.user("loop6");
        Workspace ws = fx.workspace("루프6", me);
        loginAs(me, ws);

        fx.todo(ws, me, "밀린 일 A");
        fx.todo(ws, me, "밀린 일 B");

        stubSequence(List.of(
                decision("search_tasks", Map.of("status", "TODO", "limit", 1, "continue", true)),
                decision("search_tasks", Map.of("limit", 50))
        ));

        Map<String, Object> res = chatService.handle("이번주 밀린 일정 정리좀", Map.of());

        List<Map<String, Object>> listed = actionsOf(res, "TASK_LISTED");
        assertThat(listed).as("중간 조회 결과가 남으면 프론트가 그걸 그린다").hasSize(1);

        Object count = ((Map<String, Object>) listed.get(0).get("payload")).get("count");
        assertThat(String.valueOf(res.get("assistantMessage")))
                .as("문장의 개수와 카드의 개수가 같아야 한다")
                .contains(count + "개");
    }

    @Test
    @DisplayName("만들기가 두 번이면 둘 다 남는다 (조회와 달리 덮어쓰지 않는다)")
    void everyMutationSurvives() {
        /* 조회는 스냅샷이라 마지막만 유효하지만, 생성·수정·삭제는 각각 실제로 일어난
           사건이다. 앞의 것을 지우면 만든 적 없는 것처럼 보인다. */
        User me = fx.user("loop7");
        Workspace ws = fx.workspace("루프7", me);
        loginAs(me, ws);

        stubSequence(List.of(
                decision("create_task", Map.of("title", "A 할 일", "continue", true)),
                decision("create_task", Map.of("title", "B 할 일"))
        ));

        Map<String, Object> res = chatService.handle("A 만들고 B도 만들어", Map.of());

        assertThat(actionsOf(res, "TASK_CREATED"))
                .as("두 건 다 남아야 한다")
                .hasSize(2);
    }

    @Test
    @DisplayName("조회 다음 단계가 실제 id 를 볼 수 있다")
    void nextStepSeesRealTaskIds() {
        /* [고정하는 결함] previousSteps 에 {"count": 4} 만 실렸다. 고칠 대상의 id 가 없으니
           모델은 프롬프트 예시의 T-1 을 그대로 베꼈고, 매번 "할 일을 찾을 수 없습니다: T-1"
           으로 끝났다 — "찾아서 정리해줘" 가 한 번도 동작하지 않았다.

           그래서 2단계 결정을 **넘겨받은 context 에서 직접 읽어** 만든다. id 가 실려오지
           않으면 이 테스트는 진행 자체가 불가능하다. */
        User me = fx.user("loop8");
        Workspace ws = fx.workspace("루프8", me);
        loginAs(me, ws);

        Todo target = fx.todo(ws, me, "밀린 보고서");
        String expectedId = "T-" + target.getId();

        List<String> seenIds = new ArrayList<>();
        when(llmRouter.decide(any(), any())).thenAnswer(inv -> {
            Map<String, Object> ctx = inv.getArgument(1);
            Object prev = ctx == null ? null : ctx.get("previousSteps");
            if (prev == null) {
                return decision("search_tasks", Map.of("query", "보고서", "continue", true));
            }
            // 조회 결과에서 진짜 id 를 꺼내 다음 단계를 만든다
            Map<String, Object> step = (Map<String, Object>) ((List<?>) prev).get(0);
            Map<String, Object> result = (Map<String, Object>) step.get("result");
            List<Map<String, Object>> tasks = (List<Map<String, Object>>) result.get("tasks");
            String id = String.valueOf(tasks.get(0).get("id"));
            seenIds.add(id);
            return decision("update_task", Map.of("taskId", id, "status", "DONE"));
        });

        Map<String, Object> res = chatService.handle("보고서 찾아서 완료 처리해줘", Map.of());

        assertThat(seenIds)
                .as("id 가 안 실리면 모델은 고칠 대상을 알 수 없다")
                .containsExactly(expectedId);

        List<?> steps = (List<?>) res.get("steps");
        assertThat(steps).hasSize(2);
        assertThat(steps.get(1))
                .as("실제 할 일을 고쳤어야 한다 — 없는 id 면 이 단계가 실패로 기록된다")
                .hasFieldOrPropertyWithValue("ok", true);
    }

    @Test
    @DisplayName("화면에 가는 단계에는 할 일 원문이 실리지 않는다")
    void traceStaysCompact() {
        /* id 를 넘기려고 결과를 통째로 실으면 응답이 부풀고 단계 표시도 지저분해진다.
           LLM 에게 주는 것과 화면에 보내는 것은 다른 물건이어야 한다. */
        User me = fx.user("loop9");
        Workspace ws = fx.workspace("루프9", me);
        loginAs(me, ws);
        fx.todo(ws, me, "어떤 할 일");

        stubSequence(List.of(decision("search_tasks", Map.of("limit", 50))));

        Map<String, Object> res = chatService.handle("할 일 보여줘", Map.of());

        List<com.example.llm.agent.AgentStep> steps =
                (List<com.example.llm.agent.AgentStep>) res.get("steps");
        assertThat(steps.get(0).getResult())
                .as("화면용 결과는 건수 요약만")
                .containsOnlyKeys("count");
    }

    @Test
    @DisplayName("같은 실행을 반복하면 상한을 기다리지 않고 멈춘다")
    void identicalStepIsNotRepeated() {
        /* [고정하는 결함] 같은 taskId 수정을 네 번 연속 시도하다 단계 상한에서 멈췄다.
           인자가 같으면 결과도 같으니 진전이 없고, 실패한 요청이면 다시 해도 똑같이 실패한다.
           프롬프트로 타이르는 것만으로는 못 막아서 코드로 막는다. */
        User me = fx.user("loop10");
        Workspace ws = fx.workspace("루프10", me);
        loginAs(me, ws);

        // 매번 완전히 같은 결정을 낸다
        when(llmRouter.decide(any(), any()))
                .thenReturn(decision("search_tasks", Map.of("query", "같은거", "continue", true)));

        Map<String, Object> res = chatService.handle("계속 같은 걸 찾아줘", Map.of());

        assertThat((List<?>) res.get("steps"))
                .as("상한(5)까지 돌지 말고 두 번째에서 멈춰야 한다")
                .hasSize(1);
    }

    @Test
    @DisplayName("인자가 다르면 반복이 아니므로 계속 진행한다")
    void differentArgsStillProceed() {
        // 가드가 과하면 정상적인 다단계까지 막는다. 그 반대편도 못 박아 둔다.
        User me = fx.user("loop11");
        Workspace ws = fx.workspace("루프11", me);
        loginAs(me, ws);

        stubSequence(List.of(
                decision("search_tasks", Map.of("query", "A", "continue", true)),
                decision("search_tasks", Map.of("query", "B"))
        ));

        Map<String, Object> res = chatService.handle("A 찾고 B도 찾아줘", Map.of());

        assertThat((List<?>) res.get("steps")).hasSize(2);
    }

    @Test
    @DisplayName("대상만 바꿔가며 같은 이유로 막히면 멈추고 그 사실을 알린다")
    void stopsWhenBlockedForTheSameReason() {
        /* [고정하는 결함] 게스트 워크스페이스는 전부 샘플이라 무엇을 고쳐도 거절된다.
           모델이 대상 id 만 바꿔가며 네 번 시도했고, 인자가 매번 달라 반복 가드에도
           안 걸린 채 단계 상한까지 갔다. 빨간 줄 네 개와 LLM 호출 네 번이 남았다. */
        User me = fx.user("loop12");
        Workspace ws = fx.workspace("루프12", me);
        loginAs(me, ws);

        // 실제 상황 그대로: 전부 샘플이라 무엇을 고르든 같은 이유로 거절된다
        List<String> ids = new ArrayList<>();
        for (int i = 0; i < 4; i++) {
            Todo t = fx.todo(ws, me, "샘플 " + i);
            t.setIsSample(true);
            ids.add("T-" + todoRepository.save(t).getId());
        }

        java.util.concurrent.atomic.AtomicInteger n = new java.util.concurrent.atomic.AtomicInteger();
        when(llmRouter.decide(any(), any())).thenAnswer(inv ->
                decision("update_task", Map.of(
                        "taskId", ids.get(n.getAndIncrement() % ids.size()),
                        "status", "DONE", "continue", true)));

        Map<String, Object> res = chatService.handle("전부 완료 처리해줘", Map.of());

        assertThat((List<?>) res.get("steps"))
                .as("두 번 막혔으면 상한까지 가지 말아야 한다")
                .hasSizeLessThan(5);
        assertThat(String.valueOf(res.get("assistantMessage")))
                .as("왜 멈췄는지 말해야 한다 — 조용히 멈추면 처리된 줄 안다")
                .contains("같은 이유로 계속 막혀");
    }

    @Test
    @DisplayName("여러 건을 바꿨으면 답변이 전부 말하고 카드도 바뀐 상태로 보인다")
    void everyChangeIsReportedAndListingIsFresh() {
        /* [고정하는 결함] 두 건을 완료로 바꿨는데 답변은 마지막 한 건만 말했고,
           카드는 1단계 조회 스냅샷이라 두 건 다 "할 일" 로 남아 있었다.
           "완료로 바꿨어요" 바로 아래 안 바뀐 목록이 있으면 사용자는 실패한 줄 안다. */
        User me = fx.user("loop13");
        Workspace ws = fx.workspace("루프13", me);
        loginAs(me, ws);

        Todo a = fx.todo(ws, me, "밀린 A");
        Todo b = fx.todo(ws, me, "밀린 B");
        String idA = "T-" + a.getId(), idB = "T-" + b.getId();

        stubSequence(List.of(
                decision("search_tasks", Map.of("query", "밀린", "limit", 50, "continue", true)),
                decision("update_task", Map.of("taskId", idA, "status", "DONE", "continue", true)),
                decision("update_task", Map.of("taskId", idB, "status", "DONE"))
        ));

        Map<String, Object> res = chatService.handle("밀린 거 전부 완료 처리해줘", Map.of());

        assertThat(String.valueOf(res.get("assistantMessage")))
                .as("바꾼 것을 하나도 빠뜨리면 안 된다")
                .contains("밀린 A").contains("밀린 B");

        Map<String, Object> listed = actionsOf(res, "TASK_LISTED").get(0);
        List<Map<String, Object>> tasks =
                (List<Map<String, Object>>) ((Map<String, Object>) listed.get("payload")).get("tasks");
        assertThat(tasks)
                .as("카드가 옛 상태로 남으면 안 바뀐 것처럼 보인다")
                .allSatisfy(t -> assertThat(t.get("status")).isEqualTo("DONE"));
    }

    @Test
    @DisplayName("지운 항목은 조회 카드에서 사라진다")
    void deletedTaskLeavesTheListing() {
        // 없는 것을 카드에 남겨두면 열었을 때 오류가 난다.
        User me = fx.user("loop14");
        Workspace ws = fx.workspace("루프14", me);
        loginAs(me, ws);

        Todo doomed = fx.todo(ws, me, "지울 할 일");
        fx.todo(ws, me, "남을 할 일");

        stubSequence(List.of(
                decision("search_tasks", Map.of("query", "할 일", "limit", 50, "continue", true)),
                decision("delete_task", Map.of("taskId", "T-" + doomed.getId()))
        ));

        Map<String, Object> res = chatService.handle("지울 할 일 삭제해줘", Map.of());

        Map<String, Object> listed = actionsOf(res, "TASK_LISTED").get(0);
        Map<String, Object> payload = (Map<String, Object>) listed.get("payload");
        List<Map<String, Object>> tasks = (List<Map<String, Object>>) payload.get("tasks");

        assertThat(tasks).extracting(t -> t.get("title")).containsExactly("남을 할 일");
        assertThat(payload.get("count")).as("건수도 같이 줄어야 한다").isEqualTo(1);
    }

    @Test
    @DisplayName("마감 지난 조회는 쓰지도 않은 기간을 보여주지 않는다")
    void overdueTraceHidesUnusedRange() {
        /* [고정하는 결함] 칩에는 dueFrom 08-03 / dueTo 08-09 가 떴는데 결과는 07-26·08-02
           였다. overdue 분기가 기간을 무시하는데 화면은 기간으로 찾은 척했다.
           추적이 한 번이라도 거짓말하면 그 뒤로는 아무것도 못 믿는다. */
        User me = fx.user("loop15");
        Workspace ws = fx.workspace("루프15", me);
        loginAs(me, ws);

        stubSequence(List.of(decision("search_tasks",
                Map.of("overdue", true, "dueFrom", "2026-08-03", "dueTo", "2026-08-09", "limit", 50))));

        Map<String, Object> res = chatService.handle("이번주 밀린 일정 알려줘", Map.of());

        List<com.example.llm.agent.AgentStep> steps =
                (List<com.example.llm.agent.AgentStep>) res.get("steps");
        assertThat(steps.get(0).getArgs())
                .as("안 쓴 인자는 안 보여야 한다")
                .containsKey("overdue")
                .doesNotContainKeys("dueFrom", "dueTo", "dueDate");
    }
}
