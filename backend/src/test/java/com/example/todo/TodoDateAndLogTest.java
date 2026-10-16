package com.example.todo;

import com.example.todo.entity.Todo;
import com.example.todo.entity.User;
import com.example.todo.entity.Workspace;
import com.example.todo.exception.ApiException;
import com.example.todo.repository.LogRepository;
import com.example.todo.service.TodoService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThatCode;

/**
 * 날짜 순서 검증과 변경 이력.
 *
 * [고정하는 결함 1] 시작일이 마감일보다 뒤인 채로 저장되면 **캘린더에서 통째로 사라진다**
 * (끝이 시작보다 앞이라 어느 칸에도 안 그려진다). 목록에는 남아 있어서 사용자는 왜 안
 * 보이는지 알 수 없다. 화면에서 막더라도 클라이언트가 여럿(웹·앱·AI)이라 서버가 마지막 문이다.
 *
 * [고정하는 결함 2] 생성 기록이 이력에 없었다. 맨 처음이 비어 있으면 이력을 언제부터
 * 믿어야 할지 알 수 없다.
 */
class TodoDateAndLogTest extends IntegrationTestBase {

    @Autowired TestFixtures fx;
    @Autowired TodoService todoService;
    @Autowired LogRepository logRepository;

    @Test
    @DisplayName("시작일을 마감일보다 뒤로 바꾸면 거절한다")
    void rejectsStartAfterDue() {
        User me = fx.user("date1");
        Workspace ws = fx.workspace("날짜 워크스페이스", me);
        Todo t = fx.todo(ws, me, "일정");

        todoService.updateField(t.getId(), "dueDate", "2026-08-07", me.getEmail(), ws.getId());

        assertThatThrownBy(() -> todoService.updateField(t.getId(), "startAt", "2026-08-10", me.getEmail(), ws.getId()))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("시작일이 마감일보다");
    }

    @Test
    @DisplayName("마감일을 시작일보다 앞으로 바꾸는 것도 거절한다")
    void rejectsDueBeforeStart() {
        // 반대 방향도 막아야 한다 — 한쪽만 막으면 순서만 바꿔서 그대로 뒤집을 수 있다
        User me = fx.user("date2");
        Workspace ws = fx.workspace("날짜 워크스페이스2", me);
        Todo t = fx.todo(ws, me, "일정");

        todoService.updateField(t.getId(), "startAt", "2026-08-10", me.getEmail(), ws.getId());

        assertThatThrownBy(() -> todoService.updateField(t.getId(), "dueDate", "2026-08-07", me.getEmail(), ws.getId()))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("시작일이 마감일보다");
    }

    @Test
    @DisplayName("같은 날은 허용한다")
    void sameDayIsFine() {
        // 하루짜리 일정은 흔하다 — 등호까지 막으면 정상 사용을 막는 셈이다
        User me = fx.user("date3");
        Workspace ws = fx.workspace("날짜 워크스페이스3", me);
        Todo t = fx.todo(ws, me, "일정");

        todoService.updateField(t.getId(), "dueDate", "2026-08-07", me.getEmail(), ws.getId());
        assertThatCode(() -> todoService.updateField(t.getId(), "startAt", "2026-08-07", me.getEmail(), ws.getId()))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("한쪽만 비어 있으면 막지 않는다")
    void openEndedIsFine() {
        User me = fx.user("date4");
        Workspace ws = fx.workspace("날짜 워크스페이스4", me);
        Todo t = fx.todo(ws, me, "일정");

        // 마감 없이 시작만, 시작 없이 마감만 — 둘 다 정상적인 상태다
        assertThatCode(() -> todoService.updateField(t.getId(), "startAt", "2026-08-10", me.getEmail(), ws.getId()))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("필드를 바꾸면 이력이 남는다")
    void fieldChangeIsLogged() {
        User me = fx.user("log1");
        Workspace ws = fx.workspace("이력 워크스페이스", me);
        Todo t = fx.todo(ws, me, "일정");

        todoService.updateField(t.getId(), "priority", "HIGH", me.getEmail(), ws.getId());

        assertThat(logRepository.findAll())
                .filteredOn(l -> l.getTodoId().equals(t.getId()) && "priority".equals(l.getField()))
                .isNotEmpty();
    }
}
