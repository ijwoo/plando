package com.example.llm.service;

import com.example.llm.domain.Task;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

/**
 * 조회 결과를 한 줄로 요약한다.
 *
 * 왜 따로 있는가: 이 앱의 답변 문장은 서버가 만든다(LLM 은 어떤 도구를 부를지만 고른다).
 * 그래서 "3개 중 무엇부터 할지" 같은 판단은 들어갈 자리가 없었다. 그 자리를 만드는 것이
 * 이 클래스다.
 *
 * **호출은 공짜가 아니다.** 조회 한 번마다 LLM 을 한 번 더 부르므로 하루 사용량이 두 배로
 * 든다. 그래서 역할마다 켜고 끄게 했고(AgentSpec.summarize), 호출부가 사용량을 먼저
 * 차감한 뒤에만 여기로 온다.
 *
 * 실패하면 **조용히 null 을 준다.** 요약은 덤이지 본문이 아니다 — 여기서 예외가 나서
 * 조회 결과 자체를 못 보게 되면 배보다 배꼽이 크다.
 */
@Service
public class ResultSummarizer {

    private static final Logger log = LoggerFactory.getLogger(ResultSummarizer.class);

    /** 요약에 넣을 항목 수. 넘는 건 잘라도 판단이 크게 달라지지 않고 토큰만 먹는다. */
    private static final int MAX_ITEMS = 12;

    private static final String SYSTEM = """
            너는 할 일 목록을 보고 **무엇부터 할지 한 문장으로** 말해주는 도우미다.

            규칙:
            - 반드시 한 문장. 두 문장 이상 쓰지 마라.
            - 목록을 나열하지 마라. 개수를 다시 말하지도 마라. 그건 화면에 이미 있다.
            - 무엇부터 할지 하나만 고르고, 왜 그것부터인지 짧게 붙여라.
            - 마감이 지났거나 오늘인 것, 우선순위가 높은 것을 먼저 본다.
            - 고를 근거가 없으면 억지로 고르지 말고 무엇이 눈에 띄는지만 말해라.
            - 존댓말로, 담백하게. 인사말·격려·이모지는 쓰지 마라.

            예: "어제 마감인 계약서 검토부터 끝내시는 게 좋겠어요."
            """;

    private final ChatClient chatClient;

    public ResultSummarizer(ChatClient.Builder builder) {
        this.chatClient = builder.build();
    }

    /** 요약 한 줄. 만들지 못하면 null — 호출부는 원래 문장을 그대로 쓰면 된다. */
    public String summarize(List<Task> tasks, LocalDate today) {
        if (tasks == null || tasks.isEmpty()) return null;
        try {
            String raw = chatClient.prompt()
                    .system(SYSTEM)
                    .user("오늘: " + today + "\n" + compact(tasks))
                    .call()
                    .content();
            return clean(raw);
        } catch (Exception e) {
            // 요약은 덤이다. 실패해도 조회 결과는 그대로 보여야 한다.
            log.warn("[Summary] 실패 — 원래 문장을 쓴다: {}", e.getMessage());
            return null;
        }
    }

    /** 판단에 필요한 것만 남긴다. 설명·태그·위치는 무엇부터 할지 정하는 데 쓰이지 않는다. */
    private String compact(List<Task> tasks) {
        StringBuilder sb = new StringBuilder();
        tasks.stream().limit(MAX_ITEMS).forEach(t -> sb
                .append("- ").append(t.title)
                .append(" | 마감 ").append(t.dueDate == null ? "없음" : t.dueDate)
                .append(" | 우선순위 ").append(t.priority == null ? "없음" : t.priority)
                .append(" | 상태 ").append(t.status == null ? "없음" : t.status)
                .append('\n'));
        if (tasks.size() > MAX_ITEMS) sb.append("(외 ").append(tasks.size() - MAX_ITEMS).append("건)\n");
        return sb.toString();
    }

    /**
     * 한 문장만 남긴다.
     * 규칙을 적어도 모델은 종종 여러 줄을 내놓는다. 화면에는 한 줄만 들어갈 자리라
     * 여기서 잘라야 레이아웃이 무너지지 않는다.
     */
    private String clean(String raw) {
        if (raw == null) return null;
        String s = raw.trim();
        if (s.startsWith("```")) s = s.replaceAll("^```[a-zA-Z]*\\s*", "").replaceAll("```$", "").trim();
        int nl = s.indexOf('\n');
        if (nl > 0) s = s.substring(0, nl).trim();
        if (s.length() > 120) s = s.substring(0, 120).trim();
        return s.isEmpty() ? null : s;
    }
}
