package com.example.todo;

import com.example.todo.service.QuickCaptureService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.LocalDate;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 한 문장 → 할 일 (시리·단축어 경로).
 *
 * [고정하는 결함] 시리는 문장 하나만 넘겨준다. 그걸 제목에 통째로 넣으면 **말로 넣은 할 일만
 * 마감이 비는** 상태가 된다. 날짜를 뽑고, 그 말을 제목에서 걷어내는 것까지가 한 벌이다.
 *
 * 파싱을 클라이언트(Swift)에 두지 않은 이유도 여기 있다 — 앱(parseKoreanTask.ts)과 두 벌이
 * 되면 같은 문장이 경로마다 다르게 해석된다. 사용자는 무엇이 맞는지 알 수 없다.
 */
class QuickCaptureTest extends IntegrationTestBase {

    @Autowired QuickCaptureService service;

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private String today()    { return LocalDate.now(KST).toString(); }
    private String tomorrow() { return LocalDate.now(KST).plusDays(1).toString(); }

    @Test
    @DisplayName("날짜 말을 제목에서 걷어낸다")
    void stripsDateFromTitle() {
        var d = service.parse("내일 킥오프 미팅");
        assertThat(d.dueDate()).isEqualTo(tomorrow());
        assertThat(d.title()).isEqualTo("킥오프 미팅");
        assertThat(d.title()).as("마감을 따로 갖고 있는데 제목에도 남으면 목록에 날짜가 두 번 나온다")
                .doesNotContain("내일");
    }

    @Test
    @DisplayName("시간을 말하면 시작 시간이 잡힌다")
    void picksUpTime() {
        var d = service.parse("내일 오후 3시 킥오프 미팅");
        assertThat(d.dueDate()).isEqualTo(tomorrow());
        assertThat(d.startTime()).isEqualTo("15:00");
        assertThat(d.title()).isEqualTo("킥오프 미팅");
    }

    @Test
    @DisplayName("시간을 말하지 않으면 시작 시간을 넣지 않는다")
    void noTimeWhenNotSaid() {
        /* 날짜 파서는 시간이 없으면 09:00 을 채운다. 그걸 그대로 쓰면 **말한 적 없는 9시**가
           일정에 박혀서, 하루 종일 할 일이 아침 일정으로 둔갑한다. */
        var d = service.parse("내일 보고서 정리");
        assertThat(d.dueDate()).isEqualTo(tomorrow());
        assertThat(d.startTime()).isNull();
    }

    @Test
    @DisplayName("급하다고 하면 우선순위가 올라가고 그 말도 걷어낸다")
    void picksUpPriority() {
        var d = service.parse("계약서 검토 급하게");
        assertThat(d.priority()).isEqualTo("HIGH");
        assertThat(d.title()).isEqualTo("계약서 검토");
    }

    @Test
    @DisplayName("날짜 말이 없으면 마감을 비운다")
    void noDateStaysEmpty() {
        var d = service.parse("장보기");
        assertThat(d.dueDate()).isNull();
        assertThat(d.title()).isEqualTo("장보기");
        assertThat(d.priority()).isEqualTo("MEDIUM");
    }

    @Test
    @DisplayName("날짜만 말하면 원문을 제목으로 남긴다")
    void keepsRawWhenNothingLeft() {
        /* 다 걷어내면 제목이 빈다. 제목 없는 할 일은 목록에서 정체를 알 수 없으므로
           날짜가 겹쳐 보이더라도 원문을 남기는 쪽이 낫다. */
        var d = service.parse("내일까지");
        assertThat(d.title()).isNotBlank();
        assertThat(d.dueDate()).isEqualTo(tomorrow());
    }

    @Test
    @DisplayName("오늘도 알아듣는다")
    void today_() {
        var d = service.parse("오늘 우편물 부치기");
        assertThat(d.dueDate()).isEqualTo(today());
        assertThat(d.title()).isEqualTo("우편물 부치기");
    }

    @Test
    @DisplayName("빈 문장은 빈 초안")
    void empty() {
        var d = service.parse("   ");
        assertThat(d.title()).isEmpty();
        assertThat(d.dueDate()).isNull();
    }
}
