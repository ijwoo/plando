package com.example.llm.service;

import com.example.llm.domain.Task;
import com.example.llm.domain.TaskPatch;
import com.example.llm.gateway.TaskGateway;
import com.example.llm.agent.AgentRegistry;
import com.example.llm.agent.AgentResolver;
import com.example.llm.agent.AgentSpec;
import com.example.llm.agent.AgentStep;
import com.example.llm.model.LlmDecision;
import com.example.llm.util.KoreanJosa;
import com.example.llm.tool.ToolRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Slf4j
@Service
public class ChatService {

    private final LlmRouter llmRouter;
    private final TaskGateway taskGateway;
    private final WorkspaceAiContext aiContext;
    private final AiUsageLimiter usageLimiter;
    private final ResultSummarizer resultSummarizer;
    private final AgentResolver agentResolver;
    private final ResponseWriter responseWriter;

    private static final int    MAX_LIMIT         = 50;
    /** 한 번에 만들 수 있는 초안 수. 넘치면 버리되 **몇 개가 빠졌는지 반드시 말한다.** */
    private static final int    MAX_BULK_CREATE   = 14;

    private static final String CTX_PENDING_ACTION        = "pendingAction";
    private static final String CTX_PENDING_MISSING_FIELDS = "pendingMissingFields";
    private static final String CTX_PENDING_ARGS          = "pendingArgs";
    private static final String CTX_LAST_TASK_ID          = "lastTaskId";
    private static final String CTX_LAST_SEARCH_IDS       = "lastSearchIds";

    public ChatService(LlmRouter llmRouter, TaskGateway taskGateway, WorkspaceAiContext aiContext,
                       AiUsageLimiter usageLimiter, AgentResolver agentResolver,
                       ResultSummarizer resultSummarizer, ResponseWriter responseWriter) {
        this.llmRouter     = llmRouter;
        this.taskGateway   = taskGateway;
        this.aiContext     = aiContext;
        this.usageLimiter  = usageLimiter;
        this.resultSummarizer = resultSummarizer;
        this.agentResolver = agentResolver;
        this.responseWriter = responseWriter;
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> handle(String message, Map<String, Object> context) {
        /*
         * 방어 복사 — 호출부가 **불변 맵**을 넘길 수 있다.
         * ChatController 는 body 에 context 가 없으면 Map.of() 를 넘기는데, 예전엔 여기서
         * 그대로 put 을 해서 UnsupportedOperationException 이 났다. 즉 context 필드를 빼고
         * 호출하면 AI 가 **무조건 실패**했다(400 "요청을 처리할 수 없습니다").
         * 웹 클라이언트는 항상 context 를 보내서 드러나지 않았을 뿐이다.
         * 덤으로, 호출자의 맵을 건드리지 않게 된다.
         */
        context = (context == null) ? new LinkedHashMap<>() : new LinkedHashMap<>(context);
        context.put("message", message);

        log.info("[Chat] message={}", message);

        String pendingAction = str(context.get(CTX_PENDING_ACTION));

        if (!isBlank(pendingAction)) {
            if (isCancelMessage(message)) {
                clearPending(context);
                return reply("네, 진행하던 요청은 취소했어요.", "INFO", Map.of());
            }

            List<String> missingFields = context.get(CTX_PENDING_MISSING_FIELDS) instanceof List<?> l
                    ? (List<String>) l : List.of();

            if (!isLikelyFollowUpAnswer(message, missingFields) && looksLikeFreshIntent(message)) {
                clearPending(context);
            }
        }

        Map<String, Object> pendingResult = tryHandlePending(message, context);
        if (pendingResult != null) return pendingResult;

        LlmDecision decision = decideOrLimited(message, context);
        String action = str(decision.getAction());
        Map<String, Object> args = decision.getArgs() == null
                ? new LinkedHashMap<>() : new LinkedHashMap<>(decision.getArgs());

        log.info("[Chat] decision action={} args={}", action, args);

        // 실행 단계를 기록해 응답에 싣는다 — 화면이 "무엇을 했는지"를 그릴 수 있게.
        List<AgentStep> steps = new ArrayList<>();
        return withVoice(runAgentLoop(decision, action, args, message, context, steps), context);
    }

    /** 한 요청에서 실행할 수 있는 최대 도구 수. 무한 반복과 비용 폭주를 막는 안전장치. */
    private static final int MAX_STEPS = 5;

    /**
     * 다단계 실행 루프.
     *
     * **기본은 한 단계다.** LLM 이 args.continue = true 를 넣었을 때만 결과를 되먹여 다음 도구를
     * 고르게 한다. 그래서 평범한 요청은 예전과 똑같이 LLM 을 한 번만 부른다 — 모든 요청이
     * 두 배로 비싸지면 안 된다.
     *
     * 중간에 실패해도 **앞 단계 결과는 살린다.** 3단계 중 2단계에서 멈췄으면 "여기까지 했고
     * 여기서 멈췄다"를 보여줘야 사용자가 다음 행동을 정할 수 있다. 통째로 날리면 무엇이
     * 반영됐는지조차 알 수 없다.
     */
    private Map<String, Object> runAgentLoop(LlmDecision decision, String action, Map<String, Object> args,
                                             String message, Map<String, Object> context,
                                             List<AgentStep> steps) {
        List<Object> allActions = new ArrayList<>();
        List<String> changeMessages = new ArrayList<>();
        String lastMessage = null;
        Map<String, Object> lastResult = null;
        Set<String> executed = new HashSet<>();

        for (int i = 0; i < MAX_STEPS; i++) {
            boolean wantsMore = Boolean.TRUE.equals(args.get("continue"));

            /* 똑같은 실행을 두 번 하지 않는다.
               프롬프트로 타이르는 것만으로는 부족했다 — 같은 taskId 수정을 네 번 반복하다
               단계 상한에서 멈춘 적이 있다. 인자가 같으면 결과도 같으니 진전이 없고,
               실패한 요청이었다면 다시 해도 똑같이 실패한다. */
            if (!executed.add(stepKey(action, args))) {
                log.info("[Agent] 같은 실행 반복 감지 → 중단: action={} args={}", action, args);
                break;
            }

            Map<String, Object> res;
            try {
                res = dispatch(action, args, message, context, decision, steps);
            } catch (RuntimeException e) {
                // 단계 기록은 runStep 이 이미 남겼다. 앞 결과를 살려서 돌려준다.
                if (steps.size() <= 1 && allActions.isEmpty()) throw e;   // 첫 단계 실패면 평소대로
                log.warn("[Agent] {}단계에서 멈춤: {}", steps.size(), e.getMessage());
                return finishLoop(allActions, changeMessages, lastMessage, steps, e.getMessage());
            }

            lastResult = res;
            if (res != null) {
                Object acts = res.get("actions");
                if (acts instanceof List<?> l) {
                    l.forEach(a -> supersedeStaleListing(allActions, a));
                    allActions.addAll(l);
                }
                Object msg = res.get("assistantMessage");
                if (msg != null && !String.valueOf(msg).isBlank()) {
                    lastMessage = String.valueOf(msg);
                    /* 바꾼 것은 하나도 빠뜨리지 않고 말한다.
                       [고치는 결함] 두 건을 완료로 바꿨는데 답변은 마지막 한 건만 말했다.
                       사용자는 1건만 바뀐 줄 알고 나머지를 다시 시킨다. */
                    if (ToolRegistry.isMutating(action) && !hasError(res)) changeMessages.add(lastMessage);
                }
            }

            if (!wantsMore) break;

            /* 같은 이유로 두 번 막히면 그만한다.
               대상만 바꿔가며 같은 실패를 반복하는 경우가 있다(예: 전부 샘플이라 무엇을
               골라도 수정 불가). 반복 가드는 인자가 같을 때만 잡으므로 여기서 따로 끊는다.
               막힌 이유가 같다면 다음 시도도 같은 곳에서 막힌다 — 빨간 줄만 늘고 LLM 호출만 쓴다. */
            String blocker = repeatedBlocker(steps);
            if (blocker != null) {
                log.info("[Agent] 같은 이유로 반복 실패 → 중단: {}", blocker);
                return finishLoop(allActions, changeMessages, lastMessage, steps,
                        "같은 이유로 계속 막혀서 여기서 멈췄어요.");
            }

            // 실행 결과를 다음 판단의 재료로 넘긴다
            /* args 를 빼면 모델은 **무엇을** 건드렸는지 모른다. 실제로 같은 taskId 를 네 번
               연속 수정하다 단계 상한에서 멈췄다. "이미 처리한 건 다시 건드리지 마라" 는
               규칙은 무엇을 처리했는지 보일 때만 지킬 수 있다.
               error 도 넣는다 — 실패를 모르면 같은 실패를 반복한다. */
            context.put("previousSteps", steps.stream().map(st -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("tool", String.valueOf(st.getTool()));
                m.put("summary", String.valueOf(st.getSummary()));
                m.put("args", st.getArgs());
                m.put("ok", st.isOk());
                if (st.getError() != null) m.put("error", st.getError());
                m.put("result", st.getContextResult());   // 화면 요약이 아니라 id 가 든 쪽
                return m;
            }).toList());

            LlmDecision next = decideOrLimited(message, context);
            /* 사용량이 떨어져 멈춘 것이면 **그렇다고 말한다.**
               [고치는 결함] 단계 상한과 반복 실패는 이유를 붙이는데 사용량 소진만 조용히
               break 했다. 세 건 바뀐 화면을 보고 사용자는 "다 됐다" 로 읽는다 —
               실은 한도에 걸려 멈춘 것이고 나머지는 그대로 남아 있다. */
            if (next.getArgs() != null && Boolean.TRUE.equals(next.getArgs().get("limitExceeded"))) {
                log.info("[Agent] 사용량 소진으로 중단 — {}단계까지 진행", steps.size());
                return finishLoop(allActions, changeMessages, lastMessage, steps,
                        "오늘 쓸 수 있는 AI 횟수를 다 써서 여기까지만 했어요. 남은 건 내일 다시 말씀해 주세요.");
            }
            String nextAction = str(next.getAction());
            if (isTerminal(nextAction)) break;

            decision = next;
            action = nextAction;
            args = next.getArgs() == null ? new LinkedHashMap<>() : new LinkedHashMap<>(next.getArgs());
            log.info("[Agent] {}단계 → action={}", steps.size() + 1, action);
        }

        if (steps.size() >= MAX_STEPS) {
            log.info("[Agent] 최대 단계({})에 도달해 멈춥니다", MAX_STEPS);
            return finishLoop(allActions, changeMessages, lastMessage, steps,
                    "한 번에 처리할 수 있는 단계를 넘어서 여기까지만 진행했어요. 남은 건 다시 말씀해 주세요.");
        }
        // 단계가 하나뿐이면 예전과 완전히 같은 응답을 돌려준다(불필요한 형태 변화 방지)
        if (steps.size() <= 1 && lastResult != null) return withSteps(lastResult, steps);
        return finishLoop(allActions, changeMessages, lastMessage, steps, null);
    }

    /**
     * 조회 결과는 **덮어쓴다**. 만들기·수정·삭제는 전부 남긴다.
     *
     * [고치는 결함] 한 요청에서 조회가 두 번 일어나면 답변은 마지막 조회(8개)를 말하는데
     * 화면 카드는 첫 조회(3개)를 그렸다. 프론트가 첫 TASK_LISTED 를 집기 때문인데,
     * 애초에 앞 조회는 **중간 과정의 스냅샷**이라 최종 답변과 나란히 놓일 물건이 아니다.
     * 숫자가 서로 다른 두 개가 한 화면에 뜨면 사용자는 무엇을 믿어야 할지 모른다.
     *
     * 반대로 생성·수정·삭제는 각각이 실제로 일어난 사건이라 하나도 지우면 안 된다.
     * ("A 만들고 B도 만들어" 에서 A 를 지우면 만든 적 없는 것처럼 보인다.)
     */
    private void supersedeStaleListing(List<Object> allActions, Object incoming) {
        if (!(incoming instanceof Map<?, ?> m) || !"TASK_LISTED".equals(m.get("type"))) return;
        allActions.removeIf(a -> a instanceof Map<?, ?> prev && "TASK_LISTED".equals(prev.get("type")));
    }

    /**
     * 역할이 요약을 켜 두었으면 한 줄을 덧붙인다.
     *
     * 서버가 만드는 문장은 "몇 개를 찾았는지" 까지다. "무엇부터 할지" 는 판단이라 LLM 이
     * 필요하고, 그래서 호출이 한 번 더 든다 — **역할마다 켜고 끈다.**
     *
     * [고치는 결함] 처음엔 이 로직을 일반 조회 경로에만 넣었다. 마감 지난 조회는 위에서
     * 먼저 return 하는 별도 분기라 요약이 그냥 건너뛰어졌다 — 정작 브리핑에 가장 많이 쓰는
     * 경로였다. 조회의 꼬리를 한 곳으로 모아 둘 다 지나가게 한다.
     */
    private String withSummary(String message, List<Task> list, Map<String, Object> ctx) {
        if (list == null || list.isEmpty()) return message;
        AgentSpec spec = agentResolver.resolve(str(ctx.get("agentId")));
        if (!spec.summarize()) return message;
        /* 말투 다시 쓰기가 켜져 있으면 요약은 건너뛴다. 다시 쓰는 쪽이 "무엇부터 할지"까지
           담을 수 있어서, 둘 다 부르면 같은 값을 위해 LLM 을 두 번 쓰는 셈이 된다. */
        if (spec.voice()) return message;
        // 사용량을 못 쓰면 요약 없이 넘어간다 — 요약 때문에 조회가 막히면 배보다 배꼽이 크다
        if (!usageLimiter.tryConsume(currentUserEmail())) {
            log.info("[Summary] 사용량이 남지 않아 건너뜀");
            return message;
        }
        String line = resultSummarizer.summarize(list, LocalDate.now());
        return line == null ? message : message + "\n" + line;
    }

    /**
     * 답변 문장을 역할의 말투로 다시 쓴다 — 모든 경로가 지나는 단일 관문.
     *
     * **사실은 서버가 확정하고, 문장만 다시 쓴다.** 개수·id·무엇이 바뀌었는지는 이미
     * actions 에 들어 있고, ResponseWriter 는 그걸 재료로 표현만 바꾼다. 통째로 LLM 에
     * 맡기면 예전에 고친 버그가 되살아난다 — 답변과 카드가 다른 개수를 말하거나 없는
     * id 를 지어내던 문제가 실제로 있었다.
     *
     * 켠 역할에서만 돈다. 실패하거나 검증에 걸리면 원래 문장을 그대로 쓴다.
     */
    private Map<String, Object> withVoice(Map<String, Object> res, Map<String, Object> ctx) {
        if (res == null) return null;
        AgentSpec spec = agentResolver.resolve(str(ctx.get("agentId")));
        if (!spec.voice()) return res;

        String baseline = str(res.get("assistantMessage"));
        if (baseline.isBlank()) return res;

        if (!usageLimiter.tryConsume(currentUserEmail())) {
            log.info("[Voice] 사용량이 남지 않아 건너뜀");
            return res;
        }
        String written = responseWriter.rewrite(baseline, factsOf(res), spec.instructions());
        if (written == null) return res;

        Map<String, Object> out = new LinkedHashMap<>(res);
        out.put("assistantMessage", written);
        return out;
    }

    /**
     * 다시 쓰기에 넘길 "확정된 사실".
     *
     * actions 에서 뽑는다 — 화면 카드가 그리는 것과 **같은 출처**라야 답변과 카드가
     * 어긋나지 않는다. 제목·마감·우선순위까지만 넣는다(설명·태그는 문장 판단에 안 쓰인다).
     */
    private String factsOf(Map<String, Object> res) {
        Object acts = res.get("actions");
        if (!(acts instanceof List<?> list)) return "";
        StringBuilder b = new StringBuilder();
        for (Object a : list) {
            if (!(a instanceof Map<?, ?> m)) continue;
            String type = String.valueOf(m.get("type"));
            Object payload = m.get("payload");
            if (!(payload instanceof Map<?, ?> p)) continue;

            if ("TASK_LISTED".equals(type)) {
                Object tasks = p.get("tasks");
                int n = (tasks instanceof List<?> tl) ? tl.size() : 0;
                b.append("조회 결과 ").append(n).append("개\n");
                if (tasks instanceof List<?> tl) {
                    tl.stream().limit(VOICE_MAX_ITEMS).forEach(t -> appendTask(b, t));
                    if (tl.size() > VOICE_MAX_ITEMS) b.append("- (외 ").append(tl.size() - VOICE_MAX_ITEMS).append("건)\n");
                }
            } else if ("TASK_CREATED".equals(type) || "TASK_UPDATED".equals(type)) {
                b.append("TASK_CREATED".equals(type) ? "만든 것:\n" : "바꾼 것:\n");
                appendTask(b, p.get("task"));
            } else if ("TASK_DELETED".equals(type)) {
                b.append("지운 것: ").append(str(p.get("taskId"))).append('\n');
            }
        }
        return b.toString();
    }

    /** 문장 판단에 쓰이는 필드만. */
    private void appendTask(StringBuilder b, Object task) {
        if (!(task instanceof Map<?, ?> t)) return;
        b.append("- ").append(str(t.get("id")))
         .append(' ').append(str(t.get("title")))
         .append(" | 마감 ").append(t.get("dueDate") == null ? "없음" : str(t.get("dueDate")))
         .append(" | 우선순위 ").append(t.get("priority") == null ? "없음" : str(t.get("priority")))
         .append(" | 상태 ").append(t.get("status") == null ? "없음" : str(t.get("status")))
         .append('\n');
    }

    /** 사실로 넘길 항목 수. 넘으면 건수로 줄인다 — 길어봐야 토큰만 먹고 판단은 안 달라진다. */
    private static final int VOICE_MAX_ITEMS = 12;

    /**
     * 상한에 걸렸을 때 덧붙이는 말.
     *
     * "50개를 찾았어요" 만 보면 그게 전부인지 잘린 것인지 알 수 없다. 이어지는 대화도
     * 망친다 — "다 진행중으로 바꿔줘" 의 "다" 가 실제로는 50개까지가 된다.
     */
    private String moreNote(boolean more, int limit) {
        return more ? " 한 번에 " + limit + "개까지 보여드려요. 더 있어요." : "";
    }

    /** 답변에 그대로 나열할 변경 문장의 최대 줄 수. 넘으면 건수로 줄인다. */
    private static final int MAX_CHANGE_LINES = 5;

    private String joinChanges(List<String> messages) {
        if (messages.size() <= MAX_CHANGE_LINES) return String.join("\n", messages);
        List<String> head = messages.subList(0, MAX_CHANGE_LINES);
        return String.join("\n", head) + "\n외 " + (messages.size() - MAX_CHANGE_LINES) + "건 더 처리했어요.";
    }

    private boolean hasError(Map<String, Object> res) {
        return failureReasonOf(res) != null;
    }

    /**
     * 조회 카드를 지금 상태로 맞춘다.
     *
     * [고치는 결함] 찾아서 완료 처리한 다음에도 카드의 두 항목이 여전히 "할 일" 로 떴다.
     * 카드는 1단계 조회의 스냅샷인데 2·3단계가 그걸 바꿔놨기 때문이다. "완료로 바꿨어요"
     * 바로 아래에 안 바뀐 목록이 있으면 사용자는 실패한 줄 안다.
     *
     * 지운 항목은 목록에서 뺀다 — 없는 것을 남겨두면 열었을 때 오류가 난다.
     */
    @SuppressWarnings("unchecked")
    private void reconcileListing(List<Object> allActions) {
        Map<String, Object> listing = null;
        Map<String, Map<String, Object>> updated = new LinkedHashMap<>();
        Set<String> deleted = new HashSet<>();

        for (Object a : allActions) {
            if (!(a instanceof Map<?, ?> m)) continue;
            String type = String.valueOf(m.get("type"));
            if (!(m.get("payload") instanceof Map<?, ?> payload)) continue;
            switch (type) {
                case "TASK_LISTED"  -> listing = (Map<String, Object>) m;
                case "TASK_UPDATED" -> {
                    if (payload.get("task") instanceof Map<?, ?> t && t.get("id") != null) {
                        updated.put(String.valueOf(t.get("id")), (Map<String, Object>) t);
                    }
                }
                case "TASK_DELETED" -> {
                    if (payload.get("id") != null) deleted.add(String.valueOf(payload.get("id")));
                }
                default -> { }
            }
        }
        if (listing == null || (updated.isEmpty() && deleted.isEmpty())) return;

        Map<String, Object> payload = (Map<String, Object>) listing.get("payload");
        if (!(payload.get("tasks") instanceof List<?> tasks)) return;

        List<Map<String, Object>> fresh = tasks.stream()
                .filter(t -> t instanceof Map)
                .map(t -> (Map<String, Object>) t)
                .filter(t -> !deleted.contains(String.valueOf(t.get("id"))))
                .map(t -> updated.getOrDefault(String.valueOf(t.get("id")), t))
                .toList();

        Map<String, Object> newPayload = new LinkedHashMap<>(payload);
        newPayload.put("tasks", fresh);
        newPayload.put("count", fresh.size());
        // reply() 가 불변 맵을 돌려주므로 통째로 갈아끼운다
        Map<String, Object> newListing = new LinkedHashMap<>(listing);
        newListing.put("payload", newPayload);
        allActions.set(allActions.indexOf(listing), newListing);
    }

    /** 같은 도구가 같은 이유로 두 번 이상 막혔으면 그 이유를 돌려준다. */
    private String repeatedBlocker(List<AgentStep> steps) {
        Map<String, Integer> hits = new LinkedHashMap<>();
        for (AgentStep st : steps) {
            if (st.isOk() || st.getError() == null) continue;
            String key = st.getTool() + "|" + st.getError();
            if (hits.merge(key, 1, Integer::sum) >= 2) return st.getError();
        }
        return null;
    }

    /** 같은 실행인지 판별할 열쇠. continue 는 "더 할 게 있나" 라 실행 내용이 아니다. */
    private String stepKey(String action, Map<String, Object> args) {
        Map<String, Object> copy = new java.util.TreeMap<>(args == null ? Map.of() : args);
        copy.remove("continue");
        return action + "|" + copy;
    }

    /** 여러 단계의 결과를 하나의 응답으로 합친다. */
    private Map<String, Object> finishLoop(List<Object> allActions, List<String> changeMessages,
                                           String lastMessage,
                                           List<AgentStep> steps, String note) {
        reconcileListing(allActions);

        Map<String, Object> out = new LinkedHashMap<>();
        String msg = changeMessages.size() >= 2 ? joinChanges(changeMessages)
                : (lastMessage == null ? "" : lastMessage);
        if (note != null && !note.isBlank()) {
            msg = msg.isBlank() ? note : msg + "\n" + note;
        }
        out.put("assistantMessage", msg);
        out.put("actions", allActions);
        out.put("steps", steps);
        return out;
    }

    /** 더 이어갈 수 없는 action — 여기서 루프를 멈춘다. */
    private boolean isTerminal(String action) {
        return action == null || "chat".equals(action) || "need_more_info".equals(action);
    }

    /** action 하나를 실행하면서 단계를 기록한다. */
    private Map<String, Object> dispatch(String action, Map<String, Object> args, String message,
                                         Map<String, Object> context, LlmDecision decision,
                                         List<AgentStep> steps) {
        /*
         * 에이전트 도구 제한 — **실행 계층의 방어선**.
         * 프롬프트에도 같은 제한을 적지만 그건 안내일 뿐이다. LLM 이 어긋나면 그대로 실행된다.
         * "조회만 하는 도우미"가 삭제를 실행하는 순간 그 약속은 거짓말이 되므로, 여기서 막는다.
         */
        AgentSpec agent = agentResolver.resolve(str(context.get("agentId")));
        if (!agent.allows(action)) {
            log.warn("[Agent] '{}' 역할에서 허용되지 않은 도구 차단: {}", agent.name(), action);
            return reply(
                    "\"" + agent.name() + "\" 로는 그 작업을 할 수 없어요. 다른 역할로 바꿔서 다시 말씀해 주세요.",
                    "INFO", Map.of("blockedTool", action, "agentId", agent.id()));
        }
        return switch (action) {
            case "search_tasks"  -> runStep(steps, action, args, () -> search(args, message, context));
            case "create_task"   -> runStep(steps, action, args, () -> create(args, message, context));
            case "update_task"   -> runStep(steps, action, args, () -> update(args, message, context));
            case "delete_task"   -> runStep(steps, action, args, () -> delete(args, message, context));
            case "need_more_info" -> {
                String question        = str(decision.getQuestion());
                String guessedAction   = guessPendingAction(message, question);
                List<String> missing   = guessMissingFields(message, question);
                // LLM이 이미 파싱한 partial args 유지 (dueDate 등 포함 가능)
                Map<String, Object> pa = new LinkedHashMap<>(args);
                yield needMoreInfo(question, missing, context, guessedAction, pa);
            }
            default -> {
                // 인젝션 차단
                if (Boolean.TRUE.equals(args.get("blocked"))) {
                    yield reply("요청을 처리할 수 없어요.", "INFO", Map.of());
                }
                /* LLM 자체가 안 되는 상황 — 최근 일정을 보여주는 평소 폴백을 타면 안 된다.
                   "왜 내 말을 못 알아듣지"가 아니라 "지금 AI 가 안 되는구나"를 알려야 한다. */
                if (Boolean.TRUE.equals(args.get("llmUnavailable"))) {
                    yield reply(str(args.get("reason")), "INFO", Map.of("llmUnavailable", true));
                }
                /* 상한 초과 — "못 알아들었다"와 전혀 다른 상황이다.
                   그냥 안 되면 사용자는 고장으로 받아들이므로 이유와 회복 시점을 알린다. */
                if (Boolean.TRUE.equals(args.get("limitExceeded"))) {
                    yield reply(
                            "오늘 쓸 수 있는 AI 횟수를 다 썼어요. 내일 다시 이용해 주세요.",
                            "INFO", Map.of("limitExceeded", true));
                }
                // chat 폴백 — 최근 일정을 함께 보여줌
                List<Task> recent = taskGateway.search(null, null, null, null, null, 5);
                if (recent.isEmpty()) {
                    yield reply("할 일 관리를 도와드릴게요. \"내일 팀 회의 추가해줘\", \"진행 중인 일정 보여줘\" 처럼 말씀해주세요.",
                            "INFO", Map.of());
                }
                yield Map.of(
                        "assistantMessage", "최근 일정 " + recent.size() + "개예요. 추가/수정/삭제도 말씀해주세요.",
                        "actions", List.of(Map.of("type", "TASK_LISTED", "payload", Map.of(
                                "count", recent.size(),
                                "tasks", recent.stream().map(this::taskToMap).toList()
                        )))
                );
            }
        };
    }

    // ── CRUD 처리 ────────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private Map<String, Object> tryHandlePending(String message, Map<String, Object> context) {
        String pendingAction = str(context.get(CTX_PENDING_ACTION));
        if (isBlank(pendingAction)) return null;

        List<String> missingFields = (List<String>) context.get(CTX_PENDING_MISSING_FIELDS);
        Map<String, Object> pendingArgs = context.get(CTX_PENDING_ARGS) instanceof Map<?, ?> m
                ? new LinkedHashMap<>((Map<String, Object>) m) : new LinkedHashMap<>();

        if ("create_task".equals(pendingAction)) {
            if (containsMissing(missingFields, "title"))        pendingArgs.put("title", message.trim());
            else if (containsMissing(missingFields, "dueDate")) fillIsoDateFromFollowUp(pendingArgs, "create_task", message);
            return create(pendingArgs, buildMergedMessage(message, pendingArgs), context);
        }
        if ("update_task".equals(pendingAction)) {
            if (containsMissing(missingFields, "taskId"))       pendingArgs.put("taskId", normalizeTaskId(message));
            else if (containsMissing(missingFields, "title"))   pendingArgs.put("title", message.trim());
            else if (containsMissing(missingFields, "dueDate")) fillIsoDateFromFollowUp(pendingArgs, "update_task", message);
            return update(pendingArgs, buildMergedMessage(message, pendingArgs), context);
        }
        if ("delete_task".equals(pendingAction)) {
            /* 확인을 기다리는 중이면 "네" 계열일 때만 진행한다.
               아니라고 하거나 알아들을 수 없으면 **지우지 않는다** — 되돌릴 수 없는 일에서
               모호한 대답을 승낙으로 읽으면 안 된다. */
            if (containsMissing(missingFields, "confirmDelete")) {
                if (!isAffirmative(message)) {
                    clearPending(context);
                    return reply("삭제하지 않았어요. 지울 일정을 제목이나 번호로 알려주세요.", "INFO", Map.of());
                }
                return delete(pendingArgs, buildMergedMessage(message, pendingArgs), context);
            }
            if (containsMissing(missingFields, "taskId"))  pendingArgs.put("taskId", normalizeTaskId(message));
            return delete(pendingArgs, buildMergedMessage(message, pendingArgs), context);
        }
        if ("search_tasks".equals(pendingAction)) {
            if (containsMissing(missingFields, "dueDate")) fillIsoDateFromFollowUp(pendingArgs, "search_tasks", message);
            return search(pendingArgs, buildMergedMessage(message, pendingArgs), context);
        }
        return null;
    }

    private Map<String, Object> search(Map<String, Object> args, String message, Map<String, Object> ctx) {
        clearPending(ctx);

        boolean overdue    = Boolean.TRUE.equals(args.get("overdue"));
        String  query      = str(args.get("query"));
        String  status     = normalizeStatus(str(args.get("status")));
        String  priority   = normalizePriority(str(args.get("priority")));
        String  assigneeId = resolveAssigneeId(str(firstNonNull(args.get("assigneeId"), ctx.get("userId"))));
        int       limit   = Math.min(num(args.get("limit"), 10), MAX_LIMIT);
        LocalDate dueDate = parseDate(str(args.get("dueDate")));
        LocalDate dueFrom = parseDate(str(args.get("dueFrom")));
        LocalDate dueTo   = parseDate(str(args.get("dueTo")));

        /* 한쪽만 온 기간은 버리지 않는다.
           "이번주부터"처럼 한쪽만 채워 보내는 일이 잦은데, 그때 dueFrom 을 무시하면
           조건 없는 전체 조회가 되어 엉뚱한 결과를 자신 있게 내놓는다. */
        if (dueFrom != null && dueTo == null) dueTo   = dueFrom.plusDays(6);
        if (dueTo != null && dueFrom == null) dueFrom = dueTo.minusDays(6);

        /* 상한에 걸렸는지 알려면 **한 건 더** 읽어야 한다.
           딱 limit 만큼 읽으면 "50개가 전부" 인지 "50개까지만 보여준 것" 인지 구분할 수 없다.
           읽는 비용은 한 건뿐이고, 넘치면 잘라서 돌려준다. */
        int probe = limit + 1;

        // 기한 초과 조회
        if (overdue) {
            List<Task> list = taskGateway.searchOverdue(probe);
            boolean more = list.size() > limit;
            if (more) list = list.subList(0, limit);
            if (list.isEmpty()) {
                return reply("기한이 지난 일정이 없어요.", "TASK_LISTED",
                        Map.of("count", 0, "tasks", List.of()));
            }
            return Map.of(
                    "assistantMessage", withSummary(
                            "기한이 지난 일정이 " + list.size() + "개 있어요." + moreNote(more, limit), list, ctx),
                    "actions", List.of(Map.of("type", "TASK_LISTED", "payload", Map.of(
                            "count", list.size(),
                            "tasks", list.stream().map(this::taskToMap).toList()
                    )))
            );
        }

        /* 기간 조회.
           "이번주 할 일"을 하루(이번주 금요일)로 해석해 다른 날짜의 일정이 통째로 빠지던 문제.
           도구에 기간이 없으면 모델은 날짜 하나로 밀어 넣는 것 말고 할 수 있는 게 없다. */
        boolean ranged = dueFrom != null && dueTo != null;
        List<Task> list = ranged
                ? taskGateway.searchRange(dueFrom, dueTo, status, priority, assigneeId, probe)
                : taskGateway.search(query, status, priority, assigneeId, dueDate, probe);
        boolean more = list.size() > limit;
        if (more) list = list.subList(0, limit);

        log.info("[Chat][Search] results={} ranged={}", list.size(), ranged);

        String dateLabel = ranged ? (dueFrom + " ~ " + dueTo)
                : (dueDate == null ? null : dueDate.toString());

        return Map.of(
                "assistantMessage",
                withSummary(buildSearchMessage(list, dateLabel, status, priority, query) + moreNote(more, limit), list, ctx),
                "actions", List.of(Map.of("type", "TASK_LISTED", "payload", Map.of(
                        "count", list.size(),
                        "tasks", list.stream().map(this::taskToMap).toList()
                )))
        );
    }

    /**
     * 데모 전용(무인증 공개) 처리. 기존 handle()은 손대지 않는다(ADDITIVE).
     *
     * 안전 불변식:
     *  - 파싱(LlmRouter.decide) + 초안(create) 경로만 재사용 — create()는 DB write 0(초안만).
     *  - create_task 외 액션(update/delete/search/chat/need_more_info)은 taskGateway를 절대 호출하지 않고
     *    무해 안내로 폴백 → 어떤 LLM 출력에도 DB 뮤테이션·조회가 발생하지 않는다.
     *  - WorkspaceHolder(데모 워크스페이스)는 호출자(컨트롤러)가 세팅/클리어.
     *
     * @param maxTokens LLM 출력 토큰 하드 캡(공유 자원 보호). null 금지 권장.
     */
    public Map<String, Object> demoHandle(String message, Integer maxTokens) {
        LlmDecision decision = llmRouter.decide(message, Map.of(), maxTokens);
        String action = str(decision.getAction());
        Map<String, Object> args = decision.getArgs() == null
                ? new LinkedHashMap<>() : new LinkedHashMap<>(decision.getArgs());
        log.info("[DemoAssistant] action={} args={}", action, args);

        // 인젝션 차단 신호 → 무해 응답 (원문·프롬프트 노출 없음)
        if (Boolean.TRUE.equals(args.get("blocked"))) {
            return reply("요청을 처리할 수 없어요.", "INFO", Map.of());
        }
        if (Boolean.TRUE.equals(args.get("llmUnavailable"))) {
            return reply(str(args.get("reason")), "INFO", Map.of("llmUnavailable", true));
        }
        // 생성만 체험 — create()는 초안만 만들고 저장하지 않음. 다건(tasks[])·단건 모두 처리.
        if ("create_task".equals(action)) {
            return create(args, message, new LinkedHashMap<>());
        }
        // 그 외(조회·수정·삭제·잡담·인젝션 폴백) → 게이트웨이 미호출, 무해 안내.
        return reply(
                "이 데모에서는 새 일정 만들기만 체험할 수 있어요. 예: \"내일 3시 팀 회의 추가\", \"금요일까지 매일 스탠드업\"",
                "INFO", Map.of());
    }

    /** args(또는 tasks 배열의 한 항목)를 Task 초안으로 변환 — 저장하지 않음 */
    private Task buildTaskDraft(Map<String, Object> args, Map<String, Object> ctx) {
        Task t = new Task();
        t.projectId  = str(firstNonNull(args.get("projectId"), ctx.get("projectId")));
        t.title      = cleanTitle(str(args.get("title")));
        t.description = str(args.get("description"));
        t.priority   = normalizePriority(str(args.get("priority")));
        t.assigneeId = str(firstNonNull(args.get("assigneeId"), ctx.get("userId")));
        t.status     = "TODO";
        t.dueDate      = parseDate(str(args.get("dueDate")));
        t.startAt      = parseDate(str(args.get("startDate")));
        t.startTime    = parseTime(str(args.get("startTime")));
        t.endTime      = parseTime(str(args.get("endTime")));
        t.locationName = str(args.get("locationName"));

        // ── 이름 → 실데이터 매핑 (보안: LLM 출력은 신뢰하지 않고 워크스페이스 DB와 대조, 미매칭은 버림) ──
        String projectName = str(args.get("projectName"));
        if (!isBlank(projectName) && isBlank(t.projectId)) {
            String pid = aiContext.resolveProjectId(projectName);
            if (pid != null) t.projectId = pid;
        }
        String assigneeName = str(args.get("assigneeName"));
        if (!isBlank(assigneeName)) {
            String email = aiContext.resolveMemberEmail(assigneeName);
            if (email != null) t.assigneeId = email; // 워크스페이스 멤버만 매칭됨
        }
        String statusKey = str(args.get("statusKey"));
        if (!isBlank(statusKey)) {
            String key = aiContext.resolveStatusKey(statusKey);
            if (key != null) t.status = key; // 실존 상태 key만
        }
        if (args.get("tagNames") instanceof List<?> tn) {
            List<String> names = tn.stream().filter(x -> x instanceof String).map(x -> (String) x).toList();
            List<Map<String, Object>> resolved = aiContext.resolveTags(names);
            if (!resolved.isEmpty()) t.tags = resolved; // 실존 태그만, 자동 생성 없음
        }
        return t;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> create(Map<String, Object> args, String message, Map<String, Object> ctx) {
        clearPending(ctx);

        // 다건 생성 — "~까지 매일 1시간씩 늘어나는 일정" 같은 요청은 LLM이 args.tasks 배열로 반환.
        // 항목별 TASK_CREATED 액션을 전부 내려 클라이언트가 개별 초안 카드로 확정하게 한다.
        if (args.get("tasks") instanceof List<?> rawList && !rawList.isEmpty()) {
            List<Map<String, Object>> actions = new java.util.ArrayList<>();
            int dropped = 0;
            for (int i = 0; i < rawList.size(); i++) {
                Object o = rawList.get(i);
                if (!(o instanceof Map)) continue;
                if (actions.size() >= MAX_BULK_CREATE) {
                    /* 상한에 걸려 못 만든 것을 **센다.**
                       [고치는 결함] 예전엔 조용히 break 하고 "14개 만들었어요" 라고만 했다.
                       "다음 달까지 매일" 처럼 30건을 부탁해도 16건이 사라진 걸 알 수 없었다.
                       상한 자체는 폭주 방지로 맞다 — 문제는 말하지 않는 것이었다. */
                    dropped++;
                    continue;
                }
                Task item = buildTaskDraft((Map<String, Object>) o, ctx);
                if (isBlank(item.title)) continue;
                actions.add(Map.of("type", "TASK_CREATED", "payload", Map.of("task", taskToMap(item))));
            }
            if (!actions.isEmpty()) {
                log.info("[Chat][Create] 다건 초안 {}건 (parsed only, not saved), 상한으로 빠짐 {}건",
                        actions.size(), dropped);
                String note = dropped > 0
                        ? " 한 번에 " + MAX_BULK_CREATE + "개까지만 만들 수 있어서 " + dropped + "개는 빠졌어요."
                        : "";
                return Map.of(
                        "assistantMessage", actions.size() + "개의 일정 초안을 만들었어요. 카드마다 확인 후 추가해주세요." + note,
                        "actions", actions
                );
            }
            // 유효 항목 없음 → 단건 흐름 폴백
        }

        Task t = buildTaskDraft(args, ctx);

        if (isBlank(t.title)) {
            return needMoreInfo(
                    "생성할 일정 제목이 필요해요. 예: \"내일까지 로그인 버그 수정 추가해줘\"",
                    List.of("title"), ctx, "create_task", args);
        }

        if (isVagueTitle(t.title)) {
            if (t.dueDate == null) {
                return needMoreInfo(
                        "어떤 일정으로 만들까요? 제목과 날짜를 같이 알려주세요. 예: \"내일 팀 리뷰 추가해줘\"",
                        List.of("title", "dueDate"), ctx, "create_task", args);
            }
            return needMoreInfo(
                    "제목이 조금 애매해요. 조금 더 구체적으로 알려주세요. 예: \"팀 스프린트 회의\"",
                    List.of("title"), ctx, "create_task", args);
        }

        log.info("[Chat][Create] title={} (parsed only, not saved)", t.title);

        String msg = buildCreateMessage(t);
        return Map.of(
                "assistantMessage", msg,
                "actions", List.of(Map.of("type", "TASK_CREATED", "payload", Map.of("task", taskToMap(t))))
        );
    }

    private Map<String, Object> update(Map<String, Object> args, String message, Map<String, Object> ctx) {
        clearPending(ctx);

        String rawTaskRef = str(firstNonNull(args.get("taskId"), ctx.get("taskId")));
        // 이전 검색 결과의 순서 번호로 해석 (예: "2번" → lastSearchIds[1])
        String posResolved = resolvePositionFromLastSearch(rawTaskRef, ctx);
        if (!isBlank(posResolved)) rawTaskRef = posResolved;
        String taskId = normalizeTaskId(rawTaskRef);

        if (looksLikeConcreteTaskId(taskId)) {
            taskId = resolveSpecialTaskRef(taskId, ctx);
        } else {
            taskId = null;
        }

        if (isBlank(taskId)) {
            String titleCandidate = !isBlank(rawTaskRef)
                    ? rawTaskRef : extractTaskTitleCandidate(message);
            LocalDate dueDateHint = parseDate(str(args.get("dueDate")));
            List<Task> candidates = findTaskCandidatesByTitle(titleCandidate, dueDateHint);

            if (candidates.size() == 1) {
                taskId = candidates.get(0).id;
            } else if (candidates.size() > 1) {
                return needMoreInfo(buildAmbiguousQuestion(candidates, "수정"),
                        List.of("taskId"), ctx, "update_task", args);
            } else {
                String q = rawTaskRef != null && (rawTaskRef.contains("방금") || rawTaskRef.contains("마지막"))
                        ? "최근에 만든 일정이 없어요. 일정 제목이나 번호로 알려주세요."
                        : "어떤 일정을 수정할지 모르겠어요. 제목이나 번호로 알려주세요. 예: \"팀 회의 완료해줘\"";
                return needMoreInfo(q, List.of("taskId"), ctx, "update_task", args);
            }
        }

        TaskPatch patch = new TaskPatch();
        patch.title       = cleanTitle(str(args.get("title")));
        patch.description = str(args.get("description"));
        patch.status      = normalizeStatus(str(args.get("status")));
        patch.priority    = normalizePriority(str(args.get("priority")));
        patch.assigneeId  = str(args.get("assigneeId"));
        patch.dueDate  = parseDate(str(args.get("dueDate")));
        patch.startAt  = parseDate(str(args.get("startDate")));
        patch.startTime = parseTime(str(args.get("startTime")));
        patch.endTime   = parseTime(str(args.get("endTime")));
        patch.clearDueDate  = Boolean.TRUE.equals(args.get("clearDueDate"));
        patch.clearStartAt  = Boolean.TRUE.equals(args.get("clearStartAt"));

        if (isPatchEmpty(patch)) {
            return needMoreInfo(
                    "무엇을 수정할지 알려주세요. 예: \"팀 회의 완료해줘\", \"여행 계획 마감일 다음주로 바꿔줘\"",
                    List.of("status", "priority", "title", "dueDate", "assigneeId"),
                    ctx, "update_task", args);
        }

        Task existing = taskGateway.getById(taskId);
        if (existing != null && existing.isSample) {
            /* 거절도 실패다. actions 를 비워 두면 단계에 초록 체크가 뜨면서
               "수정할 수 없어요" 가 같이 나온다 — 화면이 서로 다른 말을 한다.
               다단계에서는 더 나쁘다: 성공으로 읽은 모델이 같은 대상을 계속 다시 시도한다. */
            return Map.of(
                    "assistantMessage", "샘플 할 일은 챗봇으로 수정할 수 없어요.",
                    "actions", List.of(Map.of("type", "ERROR", "payload", Map.of("id", taskId)))
            );
        }

        /* 이미 그 값이면 쓰지 않는다.
           [고치는 결함] 다섯 건을 진행 중으로 바꾼 다음 턴에 "나머지도" 라고 하면, 방금 바꾼
           것을 **또 바꾸고 "바꿨어요" 라고 보고했다.** 한 요청 안의 중복 가드(executed)는
           턴이 바뀌면 초기화되고, 여기서는 현재 값과 비교하지 않아 그대로 통과했다.
           고쳐야 할 이유가 둘이다 — 사용자에게 거짓으로 보고하고, 다단계에서는 모델이
           "했다" 로 읽어 남은 것을 처리할 단계를 헛되이 쓴다. */
        if (existing != null && isNoOp(existing, patch)) {
            log.info("[Chat][Update] 이미 같은 값이라 건너뜀 id={}", taskId);
            /* 제목 뒤에 조사를 붙이지 않는다 — 사용자가 지은 이름이라 받침을 알 수 없고,
               "은(는)" 처럼 괄호를 내보내면 기계가 쓴 글로 읽힌다. 쉼표로 끊는다.
               뒤쪽 "이에요/예요" 는 우리가 고른 말이라 받침을 보고 정할 수 있다. */
            String target = describePatchTarget(patch);
            return Map.of(
                    "assistantMessage", "\"" + (existing.title == null ? shortId(taskId) : existing.title)
                            + "\", 이미 " + target + KoreanJosa.iEyo(target) + ".",
                    "actions", List.of(Map.of("type", "TASK_UNCHANGED",
                            "payload", Map.of("task", taskToMap(existing))))
            );
        }

        Task updated = taskGateway.update(taskId, patch);
        rememberLastTask(ctx, updated.id);

        log.info("[Chat][Update] id={}", updated.id);

        return Map.of(
                "assistantMessage", buildUpdateMessage(updated, patch),
                "actions", List.of(Map.of("type", "TASK_UPDATED", "payload", Map.of("task", taskToMap(updated))))
        );
    }

    /**
     * 이 수정이 실제로 바꾸는 게 있는가.
     *
     * 지정한 필드가 **전부** 지금 값과 같으면 쓸 이유가 없다. 하나라도 다르면 수정이다.
     * 지정하지 않은 필드(null)는 보지 않는다 — patch 는 부분 수정이다.
     */
    private boolean isNoOp(Task cur, TaskPatch p) {
        if (p.clearDueDate && cur.dueDate != null) return false;
        if (p.clearStartAt && cur.startAt != null) return false;
        return same(p.title, cur.title)
                && same(p.description, cur.description)
                && same(p.status, cur.status)
                && same(p.priority, cur.priority)
                && same(p.assigneeId, cur.assigneeId)
                && same(p.dueDate, cur.dueDate)
                && same(p.startAt, cur.startAt)
                && same(p.startTime, cur.startTime)
                && same(p.endTime, cur.endTime);
    }

    /** 지정 안 했으면(null) 비교 대상이 아니므로 "같다"로 본다. */
    private boolean same(Object patched, Object current) {
        if (patched == null) return true;
        if (patched instanceof String str && str.isBlank()) return true;
        return patched.equals(current);
    }

    /** "이미 ○○" 문장에 넣을 말. 무엇이 이미 그 값인지 알려줘야 사용자가 납득한다. */
    private String describePatchTarget(TaskPatch p) {
        if (p.status != null)   return readableStatus(p.status);
        if (p.priority != null) return readablePriority(p.priority) + " 우선순위";
        if (p.dueDate != null)  return p.dueDate + " 마감";
        return "같은 내용";
    }

    private Map<String, Object> delete(Map<String, Object> args, String message, Map<String, Object> ctx) {
        clearPending(ctx);

        String rawTaskRef = str(firstNonNull(args.get("taskId"), args.get("id")));
        String posResolved = resolvePositionFromLastSearch(rawTaskRef, ctx);
        if (!isBlank(posResolved)) rawTaskRef = posResolved;
        String taskId = normalizeTaskId(rawTaskRef);

        if (looksLikeConcreteTaskId(taskId)) {
            taskId = resolveSpecialTaskRef(taskId, ctx);
        } else {
            taskId = null;
        }

        if (isBlank(taskId)) {
            String titleCandidate = !isBlank(rawTaskRef)
                    ? rawTaskRef : extractTaskTitleCandidate(message);
            LocalDate dueDateHint = parseDate(str(args.get("dueDate")));
            List<Task> candidates = findTaskCandidatesByTitle(titleCandidate, dueDateHint);

            if (candidates.size() == 1) {
                Task only = candidates.get(0);
                /* **제목이 정확히 맞을 때만 바로 지운다.**
                   [고치는 결함] 키워드만 걸쳐도 후보가 하나면 곧바로 지웠다. 실측에서
                   "분기 실적 보고서 삭제해줘" 가 "분기 실적 보고서 최종본 정리" 를 지웠다.
                   삭제는 되돌릴 수 없으므로 얼추 맞는 것으로는 실행하지 않는다.
                   수정에는 같은 제한을 두지 않는다 — 잘못 바꿔도 되돌릴 수 있다. */
                if (isExactTitle(titleCandidate, only)) {
                    taskId = only.id;
                } else {
                    Map<String, Object> confirmArgs = new LinkedHashMap<>(args);
                    confirmArgs.put("taskId", only.id);
                    return needMoreInfo(
                            "\"" + nullSafe(only.title, shortId(only.id) + "번 일정") + "\", 이걸 말씀하신 건가요? "
                                    + "삭제는 되돌릴 수 없어요. 맞으면 \"네\" 라고 알려주세요.",
                            List.of("confirmDelete"), ctx, "delete_task", confirmArgs);
                }
            } else if (candidates.size() > 1) {
                return needMoreInfo(buildAmbiguousQuestion(candidates, "삭제"),
                        List.of("taskId"), ctx, "delete_task", args);
            } else {
                String q = rawTaskRef != null && (rawTaskRef.contains("방금") || rawTaskRef.contains("마지막"))
                        ? "최근 일정 기록이 없어요. 일정 제목이나 번호로 알려주세요."
                        : "어떤 일정을 삭제할지 모르겠어요. 제목이나 번호로 알려주세요. 예: \"여행 계획 삭제해줘\"";
                return needMoreInfo(q, List.of("taskId"), ctx, "delete_task", args);
            }
        }

        log.info("[Chat][Delete] taskId={}", taskId);

        Task existing = taskGateway.getById(taskId);
        if (existing != null && existing.isSample) {
            return Map.of(
                    "assistantMessage", "샘플 할 일은 챗봇으로 삭제할 수 없어요. 설정에서 샘플을 한꺼번에 정리할 수 있어요.",
                    "actions", List.of(Map.of("type", "ERROR", "payload", Map.of("id", taskId)))
            );
        }

        boolean ok = taskGateway.delete(taskId);
        if (!ok) {
            return Map.of(
                    "assistantMessage", "삭제하지 못했어요. 본인이 만든 일정인지, 번호가 맞는지 확인해주세요.",
                    "actions", List.of(Map.of("type", "ERROR", "payload", Map.of("id", taskId)))
            );
        }

        /* 무엇이 사라졌는지 말한다.
           [고치는 결함] "1314번 일정을 삭제했어요" 라고만 해서, 되돌릴 수 없는 일을 하고도
           무엇을 잃었는지 알 수 없었다. 번호는 사용자가 기억하는 이름이 아니다. */
        String deletedName = (existing != null && !isBlank(existing.title))
                ? "\"" + existing.title + "\""
                : shortId(taskId) + "번 일정";
        return Map.of(
                "assistantMessage", deletedName + ", 삭제했어요. 되돌릴 수 없어요.",
                "actions", List.of(Map.of("type", "TASK_DELETED", "payload", Map.of("id", taskId)))
        );
    }

    // ── 응답 메시지 빌더 ─────────────────────────────────────────────────────

    private String buildSearchMessage(List<Task> list, String dueLabel, String status,
                                      String priority, String query) {
        if (list.isEmpty()) {
            if (priority != null) return readablePriority(priority) + " 우선순위 일정이 없어요.";
            if (!isBlank(status)) return readableStatus(status) + " 상태인 일정이 없어요.";
            if (dueLabel != null) return dueLabel + " 일정은 없어요.";
            if (!isBlank(query))  return "\"" + query + "\"와 관련된 일정이 없어요.";
            return "조건에 맞는 일정이 없어요.";
        }

        StringBuilder sb = new StringBuilder();
        if (priority != null)        sb.append(readablePriority(priority)).append(" 우선순위 일정 ");
        else if (dueLabel != null)   sb.append(dueLabel).append(" 일정 ");
        else if (!isBlank(status))   sb.append(readableStatus(status)).append(" 상태 일정 ");
        else if (!isBlank(query))    sb.append("\"").append(query).append("\" 관련 일정 ");
        else                          sb.append("일정 ");
        sb.append(list.size()).append("개를 찾았어요.");

        /*
         * 목록은 여기 적지 않는다.
         *
         * 예전엔 "N개를 찾았어요" 아래에 "1) 제목 · 상태 · 우선순위 · 날짜" 를 다섯 줄 붙였다.
         * 그런데 **그 목록은 바로 아래 결과 카드에 이미 있다.** 같은 내용을 두 번 보여주니
         * 말풍선이 벽처럼 길어지고, 정작 카드(우선순위 배지·담당자·열기 버튼)는 아래로 밀렸다.
         * 텍스트는 "무엇을 몇 개 찾았는지"만 말하고 나머지는 카드가 한다.
         */
        return sb.toString();
    }

    /**
     * 생성 결과 문구.
     *
     * 마감·장소·우선순위를 한 줄에 이어 붙이면 "…추가했어요. 마감: 2026-08-10 장소: 강남역,
     * 우선순위: 보통" 처럼 읽기 힘든 한 덩어리가 된다. **그 값들은 바로 아래 카드에 배지로
     * 이미 보인다.** 문구는 무엇을 만들었는지만 말한다.
     */
    private String buildCreateMessage(Task created) {
        return "\"" + nullSafe(created.title, "새 일정") + "\" 추가했어요.";
    }

    /**
     * 무엇을 바꿨는지 한 줄.
     *
     * **제목 뒤에는 조사를 붙이지 않는다.** 사용자가 지은 이름이라 받침을 알 수 없다
     * (이모지·영문일 수도 있다). 예전엔 "을" 을 고정으로 붙여서 "회의"을 처럼 나왔다.
     * 조사가 필요한 자리는 우리가 고른 말(상태·우선순위)에만 둔다 — 거기는 받침을 안다.
     * 날짜는 숫자로 끝나므로 "로" 가 맞다.
     */
    private String buildUpdateMessage(Task updated, TaskPatch patch) {
        String name = nullSafe(updated.title, shortId(updated.id) + "번 일정");
        String q = "\"" + name + "\"";
        if (patch.clearDueDate)        return q + " 마감일을 없앴어요.";
        if (!isBlank(patch.status)) {
            String st = readableStatus(patch.status);
            return q + ", " + st + " 상태로 바꿨어요.";
        }
        if (!isBlank(patch.priority)) {
            String pr = readablePriority(patch.priority);
            return q + " 우선순위를 " + pr + KoreanJosa.euRo(pr) + " 바꿨어요.";
        }
        if (patch.dueDate != null)     return q + " 마감일을 " + patch.dueDate + "로 바꿨어요.";
        if (patch.startAt != null)     return q + " 시작일을 " + patch.startAt + "로 바꿨어요.";
        if (!isBlank(patch.title))     return "일정 제목을 \"" + patch.title + "\"로 바꿨어요.";
        if (!isBlank(patch.assigneeId)) return q + " 담당자를 바꿨어요.";
        return q + ", 수정했어요.";
    }

    private String buildAmbiguousQuestion(List<Task> tasks, String action) {
        StringBuilder sb = new StringBuilder("같은 제목의 일정이 여러 개예요. 어떤 걸 ")
                .append(action).append("할지 번호로 골라주세요.");
        int max = Math.min(tasks.size(), 3);
        for (int i = 0; i < max; i++) {
            Task t = tasks.get(i);
            sb.append("\n").append(i + 1).append(") ").append(nullSafe(t.title, "(제목 없음)"));
            if (t.dueDate != null)  sb.append(" · ").append(t.dueDate);
            if (!isBlank(t.status)) sb.append(" · ").append(readableStatus(t.status));
            sb.append(" (").append(t.id).append(")");
        }
        return sb.toString();
    }

    // ── pending 관리 ─────────────────────────────────────────────────────────

    private Map<String, Object> needMoreInfo(String question, List<String> missingFields,
                                             Map<String, Object> ctx, String pendingAction,
                                             Map<String, Object> pendingArgs) {
        savePending(ctx, pendingAction, missingFields, pendingArgs);
        return Map.of(
                "assistantMessage", question,
                "actions", List.of(Map.of("type", "NEED_MORE_INFO", "payload", Map.of(
                        "question", question,
                        "missingFields", missingFields,
                        "pendingAction", pendingAction == null ? "" : pendingAction,
                        "pendingArgs",   pendingArgs   == null ? Map.of() : pendingArgs
                )))
        );
    }

    private void savePending(Map<String, Object> ctx, String pendingAction,
                             List<String> missingFields, Map<String, Object> pendingArgs) {
        if (ctx == null) return;
        if (isBlank(pendingAction)) { clearPending(ctx); return; }
        ctx.put(CTX_PENDING_ACTION, pendingAction);
        ctx.put(CTX_PENDING_MISSING_FIELDS, missingFields == null ? List.of() : missingFields);
        ctx.put(CTX_PENDING_ARGS, pendingArgs == null ? new LinkedHashMap<>() : new LinkedHashMap<>(pendingArgs));
    }

    private void clearPending(Map<String, Object> ctx) {
        if (ctx == null) return;
        ctx.remove(CTX_PENDING_ACTION);
        ctx.remove(CTX_PENDING_MISSING_FIELDS);
        ctx.remove(CTX_PENDING_ARGS);
    }

    private void rememberLastTask(Map<String, Object> ctx, String taskId) {
        if (ctx == null || isBlank(taskId)) return;
        ctx.put(CTX_LAST_TASK_ID, taskId);
    }

    private String resolveSpecialTaskRef(String taskId, Map<String, Object> ctx) {
        if (!isBlank(taskId)) {
            String lower = taskId.toLowerCase();
            if (lower.contains("방금") || lower.contains("마지막")) return str(ctx.get(CTX_LAST_TASK_ID));
            return taskId;
        }
        return null;
    }

    // ── 날짜 파싱 — LLM이 ISO 변환, 백엔드는 수신만 ─────────────────────────

    /**
     * pending 날짜 follow-up: LlmRouter 를 재호출해 ISO 날짜를 추출한 뒤 pendingArgs 에 채운다.
     * (예: 사용자가 "내일"이라고 답했을 때 "2026-04-15" 로 변환)
     */
    private void fillIsoDateFromFollowUp(Map<String, Object> pendingArgs,
                                         String pendingAction, String dateAnswer) {
        if (isBlank(dateAnswer)) return;
        String title = str(pendingArgs.get("title"));
        String syntheticMsg = switch (pendingAction) {
            case "create_task"  -> isBlank(title)
                    ? ("아무거나 " + dateAnswer + "까지")
                    : ("\"" + title + "\" " + dateAnswer + "까지 추가");
            case "update_task"  -> "마감일 " + dateAnswer + "로 변경";
            case "search_tasks" -> dateAnswer + " 일정 보여줘";
            default             -> dateAnswer;
        };
        LlmDecision d = decideOrLimited(syntheticMsg, Map.of());
        if (d != null && d.getArgs() != null) {
            String iso = str(d.getArgs().get("dueDate"));
            if (!isBlank(iso)) pendingArgs.put("dueDate", iso);
        }
    }

    // ── 검색 결과 순서 번호 해석 ─────────────────────────────────────────────

    /**
     * "2번" / "2" 같은 단순 순서 번호를 이전 검색 결과의 실제 Task ID로 변환한다.
     * context에 lastSearchIds가 없거나 범위 초과 시 null 반환 → 기존 ID 해석으로 폴백.
     */
    @SuppressWarnings("unchecked")
    private String resolvePositionFromLastSearch(String rawRef, Map<String, Object> ctx) {
        if (isBlank(rawRef)) return null;
        String clean = rawRef.replaceAll("번$", "").trim();
        int pos;
        try { pos = Integer.parseInt(clean); } catch (NumberFormatException e) { return null; }
        Object raw = ctx.get(CTX_LAST_SEARCH_IDS);
        if (!(raw instanceof List<?> list) || list.isEmpty()) return null;
        if (pos < 1 || pos > list.size()) return null;
        return String.valueOf(list.get(pos - 1)); // 1-based → 0-based
    }

    // ── 제목 기반 검색 ───────────────────────────────────────────────────────

    private List<Task> findTaskCandidatesByTitle(String titleCandidate, LocalDate dueDate) {
        if (isBlank(titleCandidate)) return List.of();

        List<Task> found = taskGateway.search(titleCandidate, null, null, null, dueDate, 5);
        if (found.isEmpty()) found = taskGateway.search(titleCandidate, null, null, null, null, 5);
        if (found.isEmpty()) return found;

        String norm = normalizeTitleKey(titleCandidate);
        List<Task> exact = found.stream()
                .filter(t -> normalizeTitleKey(t.title).equals(norm)).toList();
        return exact.isEmpty() ? found : exact;
    }

    /** 제목이 그 할 일과 정확히 같은가(공백·대소문자 무시). 삭제에서만 쓴다. */
    private boolean isExactTitle(String titleCandidate, Task task) {
        if (task == null || isBlank(titleCandidate) || isBlank(task.title)) return false;
        return normalizeTitleKey(task.title).equals(normalizeTitleKey(titleCandidate));
    }

    /**
     * 승낙인가. **아는 말일 때만 참이다.**
     * 모르는 대답을 승낙으로 읽으면 되돌릴 수 없는 일이 벌어진다.
     */
    private boolean isAffirmative(String message) {
        if (isBlank(message)) return false;
        String m = message.trim().replaceAll("[.!\\s]", "");
        return m.equals("네") || m.equals("넵") || m.equals("예") || m.equals("응") || m.equals("어")
                || m.equals("맞아") || m.equals("맞아요") || m.equals("그래") || m.equals("그래요")
                || m.equals("좋아") || m.equals("좋아요") || m.equals("확인")
                || m.equalsIgnoreCase("ok") || m.equalsIgnoreCase("yes")
                || m.equals("삭제") || m.equals("지워") || m.equals("지워줘") || m.equals("삭제해줘");
    }

    private String normalizeTitleKey(String s) {
        return s == null ? "" : s.replaceAll("\\s+", "").trim().toLowerCase();
    }

    // ── 의도 분류 헬퍼 ───────────────────────────────────────────────────────

    private boolean isCancelMessage(String message) {
        if (isBlank(message)) return false;
        String m = message.trim();
        return m.equals("취소") || m.equals("필요없어") || m.equals("필요 없어")
                || m.equals("됐어") || m.equals("그만") || m.equals("아니야")
                || m.equals("아니") || m.equals("말고") || m.equals("다시")
                || m.equals("그냥둬") || m.equals("괜찮아");
    }

    private boolean looksLikeFreshIntent(String message) {
        if (isBlank(message)) return false;
        String m = message.trim();
        return m.contains("조회") || m.contains("보여줘") || m.contains("목록")
                || m.contains("검색") || m.contains("찾아줘") || m.contains("추가")
                || m.contains("만들") || m.contains("생성") || m.contains("삭제")
                || m.contains("지워") || m.contains("수정") || m.contains("바꿔")
                || m.contains("변경") || m.contains("등록");
    }

    private boolean isLikelyFollowUpAnswer(String message, List<String> missingFields) {
        if (isBlank(message) || missingFields == null || missingFields.isEmpty()) return false;
        String m = message.trim();
        if (containsMissing(missingFields, "title"))   return !looksLikeFreshIntent(m) && m.length() >= 2;
        if (containsMissing(missingFields, "dueDate")) return !looksLikeFreshIntent(m) && m.length() >= 2;
        if (containsMissing(missingFields, "taskId"))  return normalizeTaskId(m) != null || !isBlank(extractTaskTitleCandidate(m));
        return false;
    }

    private boolean containsMissing(List<String> fields, String target) {
        if (fields == null || fields.isEmpty()) return false;
        return fields.stream().anyMatch(v -> target.equalsIgnoreCase(str(v)));
    }

    private String guessPendingAction(String message, String question) {
        String m = str(message), q = str(question);
        if (!isBlank(m)) {
            if (m.contains("추가") || m.contains("만들") || m.contains("생성") || m.contains("등록")) return "create_task";
            if (m.contains("수정") || m.contains("바꿔") || m.contains("변경")) return "update_task";
            if (m.contains("삭제") || m.contains("지워")) return "delete_task";
            if (m.contains("보여") || m.contains("조회") || m.contains("찾아")) return "search_tasks";
        }
        if (!isBlank(q)) {
            if (q.contains("제목") || q.contains("날짜") || q.contains("일정")) return "create_task";
        }
        return null;
    }

    private List<String> guessMissingFields(String message, String question) {
        String q = str(question), m = str(message);
        List<String> fields = new ArrayList<>();
        if (!isBlank(q)) {
            if (q.contains("제목")) fields.add("title");
            if (q.contains("날짜")) fields.add("dueDate");
            if (q.contains("번호") || q.contains("ID") || q.contains("어떤")) fields.add("taskId");
        }
        if (fields.isEmpty() && !isBlank(m)) {
            if (m.contains("추가") || m.contains("만들") || m.contains("생성")) fields.add("title");
            if (m.contains("삭제") || m.contains("지워")) fields.add("taskId");
            if (m.contains("수정") || m.contains("바꿔")) fields.add("taskId");
        }
        return fields;
    }

    // ── 텍스트 유틸 ─────────────────────────────────────────────────────────

    private String extractTaskTitleCandidate(String message) {
        if (isBlank(message)) return null;
        String m = message.trim();
        if (m.contains("방금") || m.contains("마지막")) return null;

        m = m.replaceAll("(?i)\\bT-\\d+\\b", " ").replaceAll("\\b\\d+번\\b", " ").replaceAll("\\b\\d+\\b", " ");
        m = m.replaceAll("(완료(로)?\\s*바꿔줘|완료\\s*처리해줘|완료해줘)", " ");
        m = m.replaceAll("(진행(중|\\s*중)(으로)?\\s*바꿔줘?)", " ");
        m = m.replaceAll("(삭제해줘|지워줘|제거해줘|없애줘)", " ");
        m = m.replaceAll("(수정해줘|바꿔줘|변경해줘)", " ");
        m = m.replaceAll("(높음|보통|낮음|긴급)(으로)?\\s*(바꿔줘|설정|변경)?", " ");
        m = m.replaceAll("우선순위\\s*(높음|보통|낮음)(으로)?", " ");
        m = m.replaceAll("(오늘|내일|모레|글피|다음주|이번주|주말)", " ");
        m = m.replaceAll("\\d{4}-\\d{1,2}-\\d{1,2}", " ").replaceAll("\\d{1,2}\\s*월\\s*\\d{1,2}\\s*일", " ");
        m = m.replaceAll("(일정|태스크|할일|할 일)", " ");
        m = m.replaceAll("(을|를|이|가|은|는|좀|그거|그것|한테|에게)", " ");
        m = m.replaceAll("\\s+", " ").trim();

        return m.isBlank() ? null : m;
    }

    private String cleanTitle(String title) {
        if (title == null) return null;
        String t = title.trim();
        t = t.replaceAll("^(할일|할 일|태스크|일정)\\s*", "");
        t = t.replaceAll("\\s*(추가해줘|만들어줘|등록해줘|생성해줘|추가|등록)$", "");
        t = t.trim();
        return t.isBlank() ? null : t;
    }

    private boolean isVagueTitle(String title) {
        if (title == null) return true;
        String t = title.trim();
        if (t.length() <= 2) return true;
        String[] bad = {"일정", "태스크", "할일", "작업", "업무", "회의", "추가", "등록"};
        if (t.matches(".*(일정|태스크|할일|작업|업무)\\s*(하나|추가|등록|생성).*")) return true;
        int hit = 0;
        for (String b : bad) if (t.contains(b)) hit++;
        return hit >= 2;
    }

    private boolean isPatchEmpty(TaskPatch p) {
        return isBlank(p.title) && p.description == null && isBlank(p.status)
                && isBlank(p.priority) && p.dueDate == null && p.startAt == null
                && !p.clearDueDate && !p.clearStartAt && isBlank(p.assigneeId);
    }

    private String normalizeTaskId(Object raw) {
        String taskId = str(raw);
        if (isBlank(taskId)) return null;
        if (taskId.contains("방금") || taskId.contains("마지막")) return taskId;
        taskId = taskId.replaceAll("번$", "").trim();
        if (taskId.matches("\\d+")) return "T-" + taskId;
        if (taskId.matches("(?i)t-\\d+")) return "T-" + taskId.substring(taskId.indexOf('-') + 1);
        return taskId;
    }

    private boolean looksLikeConcreteTaskId(String taskRef) {
        if (isBlank(taskRef)) return false;
        String v = taskRef.trim();
        if (v.contains("방금") || v.contains("마지막")) return true;
        return v.matches("\\d+") || v.matches("(?i)T-\\d+");
    }

    private String buildMergedMessage(String message, Map<String, Object> args) {
        String title = str(args.get("title"));
        StringBuilder sb = new StringBuilder();
        if (!isBlank(title))   sb.append(title).append(" ");
        if (!isBlank(message)) sb.append(message);
        return sb.toString().trim();
    }

    // ── 정규화 ───────────────────────────────────────────────────────────────

    private String normalizeStatus(String raw) {
        if (raw == null) return null;
        String s = raw.trim().toLowerCase();
        if (s.equals("todo") || s.contains("할일") || s.contains("할 일") || s.contains("안 한")) return "TODO";
        if (s.equals("in_progress") || s.contains("진행중") || s.contains("진행 중") || s.contains("작업 중")) return "IN_PROGRESS";
        if (s.equals("done") || s.contains("완료") || s.contains("끝")) return "DONE";
        return raw.toUpperCase();
    }

    private String normalizePriority(String raw) {
        if (raw == null) return null;
        String s = raw.trim().toLowerCase();
        if (s.equals("high")   || s.contains("높") || s.contains("긴급") || s.contains("급"))  return "HIGH";
        if (s.equals("medium") || s.contains("보통") || s.contains("중간"))                    return "MEDIUM";
        if (s.equals("low")    || s.contains("낮") || s.contains("천천"))                      return "LOW";
        return raw.toUpperCase();
    }

    /**
     * 상태를 사람이 읽는 말로.
     *
     * [고치는 결함] 예전엔 기본 3개만 알고 나머지는 **받은 문자열을 그대로** 내보냈다.
     * 그래서 커스텀 상태로 바꾸면 "st_b823cdb609 상태로 바꿨어요" 가 됐다.
     * 워크스페이스 라벨을 먼저 보고, 없을 때만 기본 3개 규칙으로 떨어진다.
     */
    private String readableStatus(String status) {
        if (status == null) return "";
        String custom = safeStatusLabel(status);
        if (custom != null) return custom;
        return switch (status.toUpperCase()) {
            case "TODO"        -> "할 일";
            case "IN_PROGRESS" -> "진행 중";
            case "DONE"        -> "완료";
            default            -> status;
        };
    }

    /** 라벨 조회는 덤이다 — 실패해도 답변은 나가야 하므로 삼킨다(워크스페이스 미설정 등). */
    private String safeStatusLabel(String status) {
        try {
            return aiContext.statusLabel(status);
        } catch (Exception e) {
            return null;
        }
    }

    private String readablePriority(String priority) {
        if (priority == null) return "";
        return switch (priority.toUpperCase()) {
            case "HIGH"   -> "높음";
            case "MEDIUM" -> "보통";
            case "LOW"    -> "낮음";
            default       -> priority;
        };
    }

    // ── 공통 유틸 ────────────────────────────────────────────────────────────

    private Map<String, Object> taskToMap(Task t) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id",          t.id);
        m.put("projectId",   t.projectId);
        m.put("title",       t.title);
        m.put("description", t.description);
        m.put("status",      t.status);
        m.put("priority",    t.priority);
        m.put("startAt",     t.startAt   == null ? null : t.startAt.toString());
        m.put("dueDate",     t.dueDate   == null ? null : t.dueDate.toString());
        m.put("startTime",   t.startTime == null ? null : t.startTime.toString());
        m.put("endTime",     t.endTime   == null ? null : t.endTime.toString());
        m.put("assigneeId",    t.assigneeId);
        m.put("locationName",  t.locationName);
        m.put("tags",          t.tags == null ? List.of() : t.tags);
        return m;
    }

    // ── 사용량 상한 ──────────────────────────────────────────────────────────

    /**
     * 상한을 확인하고 LLM 을 부른다.
     *
     * **루프의 모든 호출 지점에 건다.** 첫 호출만 막으면 다단계 루프가 그대로 우회한다 —
     * 한 요청이 LLM 을 최대 5번 부르므로 상한이 5배까지 느슨해진다.
     */
    private LlmDecision decideOrLimited(String message, Map<String, Object> context) {
        if (!usageLimiter.tryConsume(currentUserEmail())) {
            LlmDecision limited = new LlmDecision();
            limited.setAction("chat");
            limited.setArgs(Map.of("limitExceeded", true));
            return limited;
        }
        return llmRouter.decide(message, context);
    }

    // ── 실행 추적 ────────────────────────────────────────────────────────────

    /**
     * 도구 하나를 실행하면서 단계를 기록한다.
     *
     * 실패해도 **예외를 삼키지 않는다.** 여기서 조용히 넘기면 사용자는 "됐다"고 오해한다.
     * 대신 단계에 실패로 남기고 다시 던져서, 위쪽의 예외 처리가 사용자에게 알리게 한다.
     */
    private Map<String, Object> runStep(List<AgentStep> steps, String tool,
                                        Map<String, Object> args,
                                        java.util.function.Supplier<Map<String, Object>> body) {
        AgentStep step = AgentStep.of(tool, summarizeTool(tool, args), ToolRegistry.isMutating(tool))
                .withArgs(traceArgs(args));
        long t0 = System.nanoTime();
        try {
            Map<String, Object> res = body.get();
            /*
             * 예외가 안 났다고 성공은 아니다.
             * 삭제·수정은 실패해도 예외 대신 ERROR 액션과 안내 문구를 돌려준다. 그걸 성공으로
             * 기록하면 **단계에는 초록 체크, 답변에는 "삭제하지 못했어요"** 가 동시에 뜬다.
             * 화면이 서로 다른 말을 하는 순간 사용자는 무엇을 믿어야 할지 모른다(실제로 겪음).
             */
            String failure = failureReasonOf(res);
            if (failure != null) {
                step.failed(failure, elapsedMs(t0));
            } else {
                step.succeeded(summarizeResult(res), elapsedMs(t0))
                        .withContext(contextResult(res));
            }
            steps.add(step);
            return res;
        } catch (RuntimeException e) {
            String reason = e.getMessage();
            step.failed(isBlank(reason) ? "처리하지 못했어요." : reason, elapsedMs(t0));
            steps.add(step);
            throw e;
        }
    }

    /**
     * 응답이 실패를 나타내는가. 맞으면 사용자에게 보여줄 사유를 돌려준다.
     * 도구가 예외 대신 ERROR 액션으로 실패를 알리는 경우를 잡는다.
     */
    private String failureReasonOf(Map<String, Object> res) {
        if (res == null) return null;
        Object actions = res.get("actions");
        if (!(actions instanceof List<?> list)) return null;
        boolean hasError = list.stream().anyMatch(a ->
                a instanceof Map<?, ?> m && "ERROR".equals(String.valueOf(m.get("type"))));
        if (!hasError) return null;
        String msg = str(res.get("assistantMessage"));
        return isBlank(msg) ? "처리하지 못했어요." : msg;
    }

    private static long elapsedMs(long startNanos) {
        return Math.max(0, (System.nanoTime() - startNanos) / 1_000_000);
    }

    /** 응답에 단계를 얹는다. reply() 가 불변 맵을 돌려주므로 반드시 복사해서 넣는다. */
    private Map<String, Object> withSteps(Map<String, Object> res, List<AgentStep> steps) {
        if (res == null) return Map.of("steps", steps);
        if (steps.isEmpty()) return res;
        Map<String, Object> merged = new LinkedHashMap<>(res);
        merged.put("steps", steps);
        return merged;
    }

    /** 사람이 읽을 한 줄. 화면의 단계 목록에 그대로 쓰인다. */
    private String summarizeTool(String tool, Map<String, Object> args) {
        return switch (tool) {
            case "search_tasks" -> {
                if (Boolean.TRUE.equals(args.get("overdue"))) yield "마감 지난 할 일 조회";
                String q = str(args.get("query"));
                if (!isBlank(q)) yield "\"" + q + "\" 로 할 일 조회";
                String from = str(args.get("dueFrom")), to = str(args.get("dueTo"));
                if (!isBlank(from) && !isBlank(to)) yield from + " ~ " + to + " 할 일 조회";
                String due = str(args.get("dueDate"));
                yield isBlank(due) ? "할 일 조회" : due + " 할 일 조회";
            }
            case "create_task" -> {
                Object batch = args.get("tasks");
                if (batch instanceof List<?> l && !l.isEmpty()) yield "할 일 " + l.size() + "건 만들기";
                String title = str(args.get("title"));
                yield isBlank(title) ? "할 일 만들기" : "\"" + title + "\" 만들기";
            }
            case "update_task" -> "할 일 수정";
            case "delete_task" -> "할 일 삭제";
            default -> tool;
        };
    }

    /**
     * 화면에 보여줄 인자만 추린다.
     * 원문을 그대로 실으면 응답이 커지고, 다른 사람의 이메일 같은 값이 섞여 나갈 수 있다.
     */
    private Map<String, Object> traceArgs(Map<String, Object> args) {
        if (args == null || args.isEmpty()) return Map.of();
        Map<String, Object> out = new LinkedHashMap<>();
        for (String key : List.of("query", "status", "priority", "dueDate", "dueFrom", "dueTo",
                                  "assigneeId", "overdue", "limit",
                                  "title", "taskId", "projectName", "statusKey")) {
            Object v = args.get(key);
            if (v != null && !String.valueOf(v).isBlank()) out.put(key, v);
        }
        Object batch = args.get("tasks");
        if (batch instanceof List<?> l && !l.isEmpty()) out.put("건수", l.size());

        /* 마감 지난 조회는 기간을 쓰지 않는다(전체에서 지난 것을 찾는다).
           그런데도 dueFrom·dueTo 를 그대로 보여줘서, 기간 밖 결과가 나오면
           추적이 거짓말하는 것처럼 보였다. 안 쓴 인자는 아예 안 보여준다. */
        if (Boolean.TRUE.equals(args.get("overdue"))) {
            out.remove("dueFrom");
            out.remove("dueTo");
            out.remove("dueDate");
        }
        return out;
    }

    /** 다음 판단에 넘길 결과에 실을 항목 수 상한. 늘리면 매 단계 프롬프트가 그만큼 비싸진다. */
    private static final int CONTEXT_TASKS = 20;

    /**
     * 다음 단계가 쓸 결과. 화면용 요약과 달리 **id 를 담는다**.
     *
     * [고치는 결함] previousSteps 에 {"count": 4} 만 실려서, "찾아서 정리해줘" 의 2단계가
     * 고칠 대상을 알 수 없었다. 모델은 결국 프롬프트 예시의 T-1 을 그대로 써서 매번
     * "할 일을 찾을 수 없습니다: T-1" 로 끝났다 — 다단계 수정이 한 번도 동작하지 않았다.
     *
     * 제목·마감까지만 준다. 설명·태그·위치는 무엇을 고칠지 정하는 데 필요 없고 토큰만 먹는다.
     */
    private Map<String, Object> contextResult(Map<String, Object> res) {
        if (res == null) return Map.of();
        Object actions = res.get("actions");
        if (!(actions instanceof List<?> list) || list.isEmpty()) return Map.of();
        if (!(list.get(0) instanceof Map<?, ?> first)
                || !(first.get("payload") instanceof Map<?, ?> payload)) return Map.of();
        if (!(payload.get("tasks") instanceof List<?> tasks) || tasks.isEmpty()) return Map.of();

        List<Map<String, Object>> compact = tasks.stream()
                .filter(t -> t instanceof Map)
                .map(t -> (Map<?, ?>) t)
                .limit(CONTEXT_TASKS)
                .map(t -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", t.get("id"));
                    m.put("title", t.get("title"));
                    m.put("status", t.get("status"));
                    m.put("dueDate", t.get("dueDate"));
                    return m;
                })
                .toList();

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("count", tasks.size());
        out.put("tasks", compact);
        // 잘렸다는 사실을 숨기면 "나머지도 처리했겠지" 라고 믿게 된다
        if (tasks.size() > compact.size()) out.put("truncated", true);
        return out;
    }

    /** 결과에서 건수 정도만 뽑는다. 할 일 원문은 이미 actions 에 실려 있다. */
    private Map<String, Object> summarizeResult(Map<String, Object> res) {
        if (res == null) return Map.of();
        Object actions = res.get("actions");
        if (actions instanceof List<?> list && !list.isEmpty()
                && list.get(0) instanceof Map<?, ?> first
                && first.get("payload") instanceof Map<?, ?> payload) {
            Object count = payload.get("count");
            if (count != null) return Map.of("count", count);
            Object tasks = payload.get("tasks");
            if (tasks instanceof List<?> tl) return Map.of("count", tl.size());
        }
        return Map.of();
    }

    private Map<String, Object> reply(String msg, String type, Map<String, Object> payload) {
        return Map.of("assistantMessage", msg,
                "actions", List.of(Map.of("type", type, "payload", payload)));
    }

    private static final Set<String> SELF_KEYWORDS = Set.of("me", "나", "나의", "내", "본인", "자신", "myself");

    private String resolveAssigneeId(String assigneeId) {
        if (isBlank(assigneeId)) return null;
        if (SELF_KEYWORDS.contains(assigneeId.toLowerCase())) {
            String email = currentUserEmail();
            return isBlank(email) ? null : email;
        }
        return assigneeId;
    }

    private String currentUserEmail() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) return null;
        if ("anonymousUser".equals(auth.getName())) return null;
        return auth.getName();
    }

    private boolean isBlank(String s)         { return s == null || s.isBlank(); }
    private String  str(Object o)             { return o == null ? null : String.valueOf(o).trim().isEmpty() ? null : String.valueOf(o).trim(); }
    private int     num(Object o, int def)    { try { return o == null ? def : Integer.parseInt(String.valueOf(o)); } catch (Exception e) { return def; } }
    private Object  firstNonNull(Object a, Object b) { return a != null ? a : b; }
    private String  nullSafe(String v, String fb)    { return isBlank(v) ? fb : v; }
    private String  shortId(String id)               { return isBlank(id) ? "" : id.startsWith("T-") ? id.substring(2) : id; }

    private LocalDate parseDate(String s) {
        try { return (s == null || s.isBlank()) ? null : LocalDate.parse(s); } catch (Exception e) { return null; }
    }

    /**
     * 시간 파싱 — LLM이 "HH:mm" 형식을 안 지키더라도 한국어 표현까지 fallback.
     * 지원:
     *  - "14:00", "14:00:00"
     *  - "2:00"               → 02:00
     *  - "14시", "오후 2시"    → 14:00
     *  - "오전 9시 30분"       → 09:30
     *  - "2시 반"              → 02:30
     *  - "저녁 7시"            → 19:00
     *  - "정오" / "자정"       → 12:00 / 00:00
     */
    private LocalTime parseTime(String s) {
        if (s == null) return null;
        String t = s.trim();
        if (t.isEmpty()) return null;

        // ISO: "HH:mm" / "HH:mm:ss"
        try {
            if (t.length() >= 5 && t.charAt(2) == ':') return LocalTime.parse(t.substring(0, 5));
            if (t.length() >= 4 && t.charAt(1) == ':') return LocalTime.parse("0" + t.substring(0, 4));
        } catch (Exception ignored) {}

        // 특수 키워드
        if (t.contains("정오")) return LocalTime.of(12, 0);
        if (t.contains("자정")) return LocalTime.of(0, 0);

        // 한국어 "N시 (M분|반)?"
        try {
            boolean isPm = t.contains("오후") || t.contains("저녁") || t.contains("밤") || t.contains("PM");
            boolean isAm = t.contains("오전") || t.contains("새벽") || t.contains("아침") || t.contains("AM");

            java.util.regex.Matcher hm = java.util.regex.Pattern.compile("(\\d{1,2})\\s*시").matcher(t);
            if (hm.find()) {
                int hour = Integer.parseInt(hm.group(1));
                if (isPm && hour < 12) hour += 12;
                if (isAm && hour == 12) hour = 0;
                // PM/AM 명시 없고 1-7시는 오후로 가정 (한국어 회화 관례)
                if (!isPm && !isAm && hour >= 1 && hour <= 7) hour += 12;

                int minute = 0;
                java.util.regex.Matcher mm = java.util.regex.Pattern.compile("(\\d{1,2})\\s*분").matcher(t);
                if (mm.find()) minute = Integer.parseInt(mm.group(1));
                else if (t.contains("반")) minute = 30;

                if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
                    return LocalTime.of(hour, minute);
                }
            }
        } catch (Exception ignored) {}

        return null;
    }
}
