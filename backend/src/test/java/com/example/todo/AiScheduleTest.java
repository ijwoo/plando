package com.example.todo;

import com.example.llm.agent.CustomAgentService;
import com.example.llm.model.LlmDecision;
import com.example.llm.service.AiScheduleRunner;
import com.example.llm.service.AiScheduleService;
import com.example.llm.service.LlmRouter;
import com.example.llm.util.WorkspaceHolder;
import com.example.todo.entity.AiSchedule;
import com.example.todo.entity.NotificationType;
import com.example.todo.entity.User;
import com.example.todo.entity.Workspace;
import com.example.todo.exception.ApiException;
import com.example.todo.repository.AiScheduleRepository;
import com.example.todo.service.NotificationService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.time.DayOfWeek;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 예약 실행 — 역할을 시간에 걸어두기.
 *
 * 이 기능은 **사람이 없을 때 서버가 알아서 AI 를 부른다.** 그래서 평소 대화보다 지킬 것이 많다:
 *  1. 조회 전용 역할만 돈다 — 아침에 열었더니 마감이 옮겨져 있고 누가 한 건지 모르는 상황을 만들지 않는다.
 *  2. 두 번 보내지 않는다 — 블루/그린 배포 중엔 인스턴스가 둘이고 둘 다 크론을 돌린다.
 *  3. 남의 워크스페이스를 들여다보지 않는다 — 크론 스레드는 재사용된다.
 */
class AiScheduleTest extends IntegrationTestBase {

    @Autowired TestFixtures fx;
    @Autowired AiScheduleService scheduleService;
    @Autowired AiScheduleRunner runner;
    @Autowired AiScheduleRepository repository;
    @Autowired CustomAgentService customAgentService;

    @MockitoBean LlmRouter llmRouter;
    @MockitoBean NotificationService notificationService;

    @AfterEach
    void cleanup() {
        WorkspaceHolder.clear();
        SecurityContextHolder.clearContext();
    }

    private void stubSearch() {
        LlmDecision d = new LlmDecision();
        d.setAction("search_tasks");
        d.setArgs(Map.of("query", "보고서", "limit", 50));
        when(llmRouter.decide(any(), any())).thenReturn(d);
    }

    // ── 무엇을 걸 수 있는가 ──────────────────────────────────────────────────

    @Test
    @DisplayName("조회 전용 역할은 예약할 수 있다")
    void readOnlyAgentCanBeScheduled() {
        User me = fx.user("sch1");
        Workspace ws = fx.workspace("예약 워크스페이스", me);

        AiSchedule s = scheduleService.create(ws.getId(), me.getEmail(),
                "review", "오늘 뭐부터 할까?", 8, 0, "DAILY", true);

        assertThat(s.getId()).isNotNull();
        assertThat(s.getAgentId()).isEqualTo("review");
    }

    @Test
    @DisplayName("데이터를 바꾸는 역할은 예약할 수 없다")
    void mutatingAgentIsRejected() {
        /* [고정하는 약속] 사람이 없는 사이 마감이 옮겨지면, 아침에 열었을 때 누가 한 건지
           알 수 없다. 예약은 알려주기만 한다. */
        User me = fx.user("sch2");
        Workspace ws = fx.workspace("예약 워크스페이스2", me);

        assertThatThrownBy(() -> scheduleService.create(ws.getId(), me.getEmail(),
                "planner", "밀린 거 정리해줘", 8, 0, "DAILY", true))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("조회만 하는 역할만");
    }

    @Test
    @DisplayName("도구 제한이 없는 기본 역할도 예약할 수 없다")
    void unrestrictedAgentIsRejected() {
        /* 기본 역할은 '변경 도구가 없는' 게 아니라 '제한이 없는' 것이다 — 무엇이든 할 수 있다.
           readOnly() 가 false 인 이유를 여기서 못 박아 둔다. */
        User me = fx.user("sch3");
        Workspace ws = fx.workspace("예약 워크스페이스3", me);

        assertThatThrownBy(() -> scheduleService.create(ws.getId(), me.getEmail(),
                "default", "브리핑", 8, 0, "DAILY", true))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("조회만 하는 역할만");
    }

    @Test
    @DisplayName("예약 개수에 상한이 있다")
    void limitsScheduleCount() {
        /* 예약 하나가 매일 하루 사용량을 먹는다. 상한이 없으면 예약만으로 하루치를 다 쓰고
           정작 직접 물어볼 때 막힌다. */
        User me = fx.user("sch4");
        Workspace ws = fx.workspace("예약 워크스페이스4", me);
        for (int i = 0; i < 5; i++) {
            scheduleService.create(ws.getId(), me.getEmail(), "review", "브리핑 " + i, 8, i, "DAILY", true);
        }
        assertThatThrownBy(() -> scheduleService.create(ws.getId(), me.getEmail(),
                "review", "하나 더", 9, 0, "DAILY", true))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("5개까지");
    }

    @Test
    @DisplayName("모르는 요일은 버리고, 아무것도 안 남으면 매일로 둔다")
    void invalidDaysFallBackToDaily() {
        /* 모르는 값을 그대로 두면 **영원히 안 도는 예약**이 되고, 사용자는 왜 알림이 안 오는지
           알 방법이 없다. 안 도는 것보다 매일 도는 쪽이 낫다. */
        User me = fx.user("sch5");
        Workspace ws = fx.workspace("예약 워크스페이스5", me);

        AiSchedule s = scheduleService.create(ws.getId(), me.getEmail(),
                "review", "브리핑", 8, 0, "월요일,화요일", true);

        assertThat(s.getDays()).isEqualTo(AiSchedule.DAILY);
    }

    @Test
    @DisplayName("요일을 고르면 그 요일에만 돈다")
    void runsOnlyOnPickedDays() {
        User me = fx.user("sch6");
        Workspace ws = fx.workspace("예약 워크스페이스6", me);

        AiSchedule s = scheduleService.create(ws.getId(), me.getEmail(),
                "review", "브리핑", 8, 0, "MON,WED", true);

        assertThat(s.runsOn(DayOfWeek.MONDAY)).isTrue();
        assertThat(s.runsOn(DayOfWeek.WEDNESDAY)).isTrue();
        assertThat(s.runsOn(DayOfWeek.TUESDAY)).isFalse();
        assertThat(s.runsOn(DayOfWeek.SUNDAY)).isFalse();
    }

    // ── 실행 ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("예약이 돌면 결과가 알림으로 간다")
    void runSendsNotification() {
        User me = fx.user("run1");
        Workspace ws = fx.workspace("실행 워크스페이스", me);
        fx.todo(ws, me, "보고서 초안");
        stubSearch();

        AiSchedule s = scheduleService.create(ws.getId(), me.getEmail(),
                "review", "오늘 뭐부터 할까?", 8, 0, "DAILY", true);

        runner.runOne(s, LocalDateTime.now());

        verify(notificationService).createNotification(
                eq(me.getEmail()), any(), eq(NotificationType.AI_SCHEDULE.name()),
                any(), any(), any(), eq(ws.getId()));
    }

    @Test
    @DisplayName("알림에 예약 id를 실어 보낸다 — 탭해서 결과를 다시 볼 수 있게")
    void notificationCarriesScheduleId() {
        User me = fx.user("target1");
        Workspace ws = fx.workspace("대상 워크스페이스", me);
        fx.todo(ws, me, "기한 지난 일");
        stubSearch();

        AiSchedule s = scheduleService.create(ws.getId(), me.getEmail(),
                "review", "기한 지난 일 알려줘", 9, 0, "DAILY", true);

        runner.runOne(s, LocalDateTime.now());

        /* targetId 가 null 이면 앱은 갈 곳을 몰라 **빈 AI 화면**만 띄운다. 알림은 왔는데
           무엇이 지났는지 볼 방법이 없던 게 바로 그 결함이었다. */
        verify(notificationService).createNotification(
                eq(me.getEmail()), any(), eq(NotificationType.AI_SCHEDULE.name()),
                any(), any(), eq(s.getId()), eq(ws.getId()));
    }

    @Test
    @DisplayName("같은 예약을 두 번 돌려도 알림은 한 번만 간다")
    void doesNotSendTwice() {
        /* [고정하는 결함] 블루/그린 배포 중에는 두 인스턴스가 잠깐 같이 떠서 **둘 다** 크론을
           돌린다. 조회 후 자바에서 판단하면 둘 다 "아직 안 돌았네" 를 보고 둘 다 보낸다.
           조건을 UPDATE 문 안에 넣어야 DB 가 한쪽만 통과시킨다. */
        User me = fx.user("run2");
        Workspace ws = fx.workspace("실행 워크스페이스2", me);
        fx.todo(ws, me, "보고서 초안");
        stubSearch();

        AiSchedule s = scheduleService.create(ws.getId(), me.getEmail(),
                "review", "오늘 뭐부터 할까?", 8, 0, "DAILY", true);

        LocalDateTime now = LocalDateTime.now();
        runner.runOne(s, now);
        runner.runOne(s, now);   // 다른 인스턴스가 같은 분에 들어온 상황

        verify(notificationService, org.mockito.Mockito.times(1)).createNotification(
                any(), any(), eq(NotificationType.AI_SCHEDULE.name()), any(), any(), any(), any());
    }

    @Test
    @DisplayName("역할이 지워지면 예약을 끄고 그 사실을 알린다")
    void disablesWhenAgentIsGone() {
        /* 계속 켜두면 매일 조용히 실패하고, 사용자는 알림이 왜 안 오는지 모른다.
           멈췄으면 멈췄다고 말해야 한다. */
        User me = fx.user("run3");
        Workspace ws = fx.workspace("실행 워크스페이스3", me);

        var agent = customAgentService.create(ws.getId(), me.getEmail(),
                "브리핑", "🧭", "", "", List.of("search_tasks"), false, false);
        AiSchedule s = scheduleService.create(ws.getId(), me.getEmail(),
                CustomAgentService.customId(agent.getId()), "브리핑", 8, 0, "DAILY", true);

        customAgentService.delete(agent.getId(), ws.getId());
        runner.runOne(s, LocalDateTime.now());

        assertThat(repository.findById(s.getId()).orElseThrow().isEnabled())
                .as("돌 수 없는 예약은 꺼둬야 한다").isFalse();
        verify(notificationService).createNotification(
                any(), any(), any(), eq("예약이 멈췄어요"), any(), any(), any());
        verify(llmRouter, never()).decide(any(), any());
    }

    @Test
    @DisplayName("역할에 변경 도구가 붙으면 예약이 멈춘다")
    void disablesWhenAgentGainsMutatingTool() {
        /* [고정하는 구멍] 만들 때만 검사하면, 조회 전용으로 예약해 두고 나중에 역할에 수정
           도구를 붙이는 것으로 검사를 통과할 수 있다. 실행 시점에 다시 본다. */
        User me = fx.user("run4");
        Workspace ws = fx.workspace("실행 워크스페이스4", me);

        var agent = customAgentService.create(ws.getId(), me.getEmail(),
                "브리핑", "🧭", "", "", List.of("search_tasks"), false, false);
        AiSchedule s = scheduleService.create(ws.getId(), me.getEmail(),
                CustomAgentService.customId(agent.getId()), "브리핑", 8, 0, "DAILY", true);

        // 예약해 둔 뒤 역할에 수정 권한을 붙인다
        customAgentService.update(agent.getId(), ws.getId(), "브리핑", "🧭", "", "",
                List.of("search_tasks", "update_task"), false, false);

        runner.runOne(s, LocalDateTime.now());

        assertThat(repository.findById(s.getId()).orElseThrow().isEnabled()).isFalse();
        verify(llmRouter, never()).decide(any(), any());
    }

    @Test
    @DisplayName("실행이 끝나면 사용자·워크스페이스 흔적을 지운다")
    void clearsImpersonationAfterRun() {
        /* [고정하는 결함] 크론 스레드는 재사용된다. ThreadLocal 을 안 지우면 **다음 예약이
           앞사람의 워크스페이스를 들여다본다** — 남의 할 일이 내 브리핑에 섞여 온다. */
        User me = fx.user("run5");
        Workspace ws = fx.workspace("실행 워크스페이스5", me);
        fx.todo(ws, me, "보고서 초안");
        stubSearch();

        AiSchedule s = scheduleService.create(ws.getId(), me.getEmail(),
                "review", "브리핑", 8, 0, "DAILY", true);
        runner.runOne(s, LocalDateTime.now());

        assertThat(WorkspaceHolder.get()).as("워크스페이스가 남아 있으면 안 된다").isNull();
        assertThat(SecurityContextHolder.getContext().getAuthentication())
                .as("로그인 흔적이 남아 있으면 안 된다").isNull();
    }

    @Test
    @DisplayName("남의 예약은 보이지도, 지워지지도 않는다")
    void schedulesArePrivate() {
        User me = fx.user("priv1");
        User other = fx.user("priv2");
        Workspace ws = fx.workspace("공유 워크스페이스", me);

        AiSchedule mine = scheduleService.create(ws.getId(), me.getEmail(),
                "review", "내 브리핑", 8, 0, "DAILY", true);

        assertThat(scheduleService.list(ws.getId(), other.getEmail()))
                .as("워크스페이스가 같아도 남의 예약은 보이지 않는다").isEmpty();
        assertThatThrownBy(() -> scheduleService.delete(mine.getId(), ws.getId(), other.getEmail()))
                .isInstanceOf(ApiException.class);
    }

    // ── HTTP 계약 ───────────────────────────────────────────────────────────
    // 앱은 여기 적힌 키 이름을 그대로 읽는다. 키가 바뀌면 화면이 조용히 빈 값을 그린다.

    @Test
    @DisplayName("예약을 만들고 목록으로 다시 읽을 수 있다")
    void httpCreateAndList() throws Exception {
        User me = fx.user("http1");
        Workspace ws = fx.workspace("HTTP 워크스페이스", me);

        mvc.perform(post("/api/chat/schedules")
                        .header(HttpHeaders.AUTHORIZATION, fx.bearer(me))
                        .header("X-Workspace-Id", ws.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "agentId", "review",
                                "prompt", "오늘 뭐부터 할까?",
                                "hour", 8,
                                "minute", 30,
                                "days", "MON,WED",
                                "enabled", true))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.agentId").value("review"))
                .andExpect(jsonPath("$.hour").value(8))
                .andExpect(jsonPath("$.minute").value(30))
                .andExpect(jsonPath("$.days").value("MON,WED"))
                .andExpect(jsonPath("$.enabled").value(true));

        mvc.perform(get("/api/chat/schedules")
                        .header(HttpHeaders.AUTHORIZATION, fx.bearer(me))
                        .header("X-Workspace-Id", ws.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].prompt").value("오늘 뭐부터 할까?"));
    }

    @Test
    @DisplayName("바꾸는 역할로 예약하면 이유가 담긴 400 이 온다")
    void httpRejectsMutatingAgent() throws Exception {
        /* 화면이 왜 안 되는지 말해주려면 상태 코드만으로는 부족하다 — 문구가 함께 와야 한다. */
        User me = fx.user("http2");
        Workspace ws = fx.workspace("HTTP 워크스페이스2", me);

        mvc.perform(post("/api/chat/schedules")
                        .header(HttpHeaders.AUTHORIZATION, fx.bearer(me))
                        .header("X-Workspace-Id", ws.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "agentId", "planner", "prompt", "정리해줘", "hour", 8, "minute", 0))))
                .andExpect(status().isBadRequest());
    }
}
