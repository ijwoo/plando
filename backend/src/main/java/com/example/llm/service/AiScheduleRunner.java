package com.example.llm.service;

import com.example.llm.agent.AgentSpec;
import com.example.llm.util.WorkspaceHolder;
import com.example.todo.entity.AiSchedule;
import com.example.todo.entity.NotificationType;
import com.example.todo.repository.AiScheduleRepository;
import com.example.todo.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 예약된 역할을 시각에 맞춰 돌리고, 결과를 알림으로 보낸다.
 *
 * 매분 돈다. 5분 단위로 돌리면 "8시 정각 브리핑" 이 8시 3분에 오는데, 정해둔 시각에
 * 안 오는 알림은 사용자가 설정을 못 믿게 만든다. 질의는 인덱스 하나 타는 한 건이라 매분
 * 돌아도 부담이 없다.
 *
 * **사람이 없는 실행이라 평소보다 조심한다:**
 *  - 조회 전용 역할만 돌린다(만들 때 검사했어도 도구 목록은 나중에 바뀔 수 있다).
 *  - 사용량이 남지 않았으면 아예 부르지 않는다 — 직접 물어보려고 아껴둔 몫을 예약이 먹으면 안 된다.
 *  - 한 건이 실패해도 나머지는 계속 돈다.
 */
@Component
@RequiredArgsConstructor
public class AiScheduleRunner {

    private static final Logger log = LoggerFactory.getLogger(AiScheduleRunner.class);
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    /** 알림 본문 길이. 푸시에서 잘리는 데다, 길면 어차피 안 읽는다. */
    private static final int MAX_BODY = 300;

    /** 제목 컬럼이 50자다. 역할 이름이 길면 잘라서라도 보낸다 — 저장 실패로 통째로 잃는 것보다 낫다. */
    private static final int MAX_TITLE = 50;

    private final AiScheduleRepository repository;
    private final AiScheduleService scheduleService;
    private final ChatService chatService;
    private final AiUsageLimiter usageLimiter;
    private final NotificationService notificationService;

    /** 매분 0초. cron: 초 분 시 일 월 요일 */
    @Scheduled(cron = "0 * * * * *", zone = "Asia/Seoul")
    public void runDueSchedules() {
        LocalDateTime now = LocalDateTime.now(KST);
        List<AiSchedule> due = repository.findByEnabledTrueAndRunHourAndRunMinute(
                (short) now.getHour(), (short) now.getMinute());
        if (due.isEmpty()) return;

        for (AiSchedule schedule : due) {
            if (!schedule.runsOn(now.getDayOfWeek())) continue;
            try {
                runOne(schedule, now);
            } catch (Exception e) {
                // 한 사람의 예약이 실패해도 다음 사람 것은 돌아야 한다
                log.warn("[AiSchedule] {}번 실행 실패: {}", schedule.getId(), e.getMessage());
            }
        }
    }

    /**
     * 예약 한 건.
     *
     * 먼저 **집는다**(claim). 조건부 UPDATE 라 여러 인스턴스가 동시에 들어와도 한쪽만
     * 1을 받는다. 집기 전에 LLM 을 부르면 배포가 겹친 순간에 알림이 두 번 가고 사용량도
     * 두 번 나간다.
     *
     * 트랜잭션을 이 메서드에 걸지 않는다. 같은 빈 안에서 부르면 프록시를 타지 않아
     * @Transactional 이 **조용히 무시되기** 때문이다. 대신 DB 를 건드리는 두 지점
     * (claim / save)이 각각 리포지토리 프록시를 통해 자기 트랜잭션을 갖는다. LLM 호출이
     * 트랜잭션 안에 들어가지 않는 이점도 있다 — 응답이 느려도 커넥션을 붙잡지 않는다.
     */
    public void runOne(AiSchedule schedule, LocalDateTime now) {
        // 같은 분에 이미 돌았으면 넘어간다(재기동·인스턴스 중복)
        if (repository.claim(schedule.getId(), now, now.withSecond(0).withNano(0)) != 1) {
            log.debug("[AiSchedule] {}번은 다른 쪽이 이미 실행함", schedule.getId());
            return;
        }
        schedule.markRan(now);   // 아래에서 save() 해도 방금 집은 표시가 지워지지 않게

        AgentSpec agent = scheduleService.findAgent(schedule.getWorkspaceId(), schedule.getAgentId());
        if (agent == null) {
            /* 역할이 지워졌다. 계속 켜두면 매일 조용히 실패하고, 사용자는 알림이 왜 안 오는지
               모른다. 꺼두고 한 번 알린다 — 무언가 멈췄으면 멈췄다고 말해야 한다. */
            schedule.disable();
            repository.save(schedule);
            notify(schedule, "예약이 멈췄어요", "연결된 역할이 없어졌어요. 예약을 다시 설정해 주세요.");
            log.info("[AiSchedule] {}번 역할 없음 → 비활성화", schedule.getId());
            return;
        }
        if (!agent.readOnly()) {
            /* 만들 때는 조회 전용이었는데 그 뒤 역할에 변경 도구가 붙은 경우다.
               사람이 없는 사이 데이터를 바꾸지 않는다는 약속이 먼저다. */
            schedule.disable();
            repository.save(schedule);
            notify(schedule, "예약이 멈췄어요",
                    "'" + agent.name() + "' 역할이 데이터를 바꿀 수 있게 바뀌었어요. 예약은 조회만 할 수 있어요.");
            log.info("[AiSchedule] {}번 역할이 더는 조회 전용이 아님 → 비활성화", schedule.getId());
            return;
        }

        if (usageLimiter.peek(schedule.getUserEmail()).exceeded()) {
            // 조용히 넘어간다. "한도를 다 썼다" 는 푸시는 매일 아침 오면 그 자체가 소음이다.
            log.info("[AiSchedule] {}번 사용량 소진 → 건너뜀", schedule.getId());
            return;
        }

        String body = execute(schedule);
        if (body == null || body.isBlank()) {
            log.info("[AiSchedule] {}번 결과가 비어 알림을 보내지 않음", schedule.getId());
            return;
        }
        notify(schedule, title(agent), body);
        log.info("[AiSchedule] {}번 완료 — {}", schedule.getId(), schedule.getUserEmail());
    }

    /**
     * 사람 없이 ChatService 를 부른다.
     *
     * ChatService 는 로그인한 사용자(SecurityContext)와 워크스페이스(ThreadLocal)를 보고
     * 동작한다. 크론 스레드에는 둘 다 없으므로 **세우고 반드시 지운다** — 스레드는 재사용되기
     * 때문에, 안 지우면 다음 예약이 앞사람의 워크스페이스를 들여다보게 된다.
     */
    private String execute(AiSchedule schedule) {
        try {
            WorkspaceHolder.set(schedule.getWorkspaceId());
            SecurityContextHolder.getContext().setAuthentication(
                    new UsernamePasswordAuthenticationToken(schedule.getUserEmail(), null, List.of()));

            Map<String, Object> context = new LinkedHashMap<>();
            context.put("agentId", schedule.getAgentId());
            Map<String, Object> result = chatService.handle(schedule.getPrompt(), context);

            Object message = result == null ? null : result.get("assistantMessage");
            return message == null ? null : truncate(String.valueOf(message), MAX_BODY);
        } finally {
            WorkspaceHolder.clear();
            SecurityContextHolder.clearContext();
        }
    }

    private String title(AgentSpec agent) {
        String emoji = agent.emoji() == null || agent.emoji().isBlank() ? "" : agent.emoji() + " ";
        return truncate(emoji + agent.name(), MAX_TITLE);
    }

    private void notify(AiSchedule schedule, String title, String body) {
        notificationService.createNotification(
                schedule.getUserEmail(),
                null,
                NotificationType.AI_SCHEDULE.name(),
                title,
                body,
                /* 어떤 예약이 보낸 것인지 실어 보낸다.
                   [고치는 결함] null 이라 탭하면 **빈 AI 화면**으로만 갔다. "기한이 지난 일정이
                   2개 있어요" 를 읽고 눌러도 무엇이 지났는지 볼 방법이 없었다 — 알려만 주고
                   길은 막아둔 셈이다. 예약 id 가 있으면 앱이 그 질문을 다시 던져 결과를 보여준다. */
                schedule.getId(),
                schedule.getWorkspaceId());
    }

    private static String truncate(String s, int max) {
        String t = s.trim();
        return t.length() <= max ? t : t.substring(0, max - 1) + "…";
    }
}
