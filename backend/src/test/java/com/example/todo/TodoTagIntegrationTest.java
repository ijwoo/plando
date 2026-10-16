package com.example.todo;

import com.example.todo.entity.Tag;
import com.example.todo.entity.Todo;
import com.example.todo.entity.TodoTag;
import com.example.todo.entity.User;
import com.example.todo.entity.Workspace;
import com.example.todo.repository.TodoTagRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * PUT /api/todos/{id}/tags — 태그 전체 교체.
 * 여기가 오늘 찾은 결함 중 사용자가 가장 자주 부딪히던 곳이다(commit 9fe3f04).
 */
class TodoTagIntegrationTest extends IntegrationTestBase {

    @Autowired TestFixtures fx;
    @Autowired TodoTagRepository todoTagRepository;

    private List<Long> tagIdsOf(Todo todo) {
        return todoTagRepository.findByTodoId(todo.getId()).stream()
                .map(TodoTag::getTagId).sorted().toList();
    }

    @Test
    @DisplayName("이미 태그 A 가 붙은 할 일에 [A,B] 를 저장하면 성공하고 {A,B} 가 된다")
    void addingSecondTagToTodoThatAlreadyHasOne() throws Exception {
        /* [고정하는 결함] 예전 구현은 "이 할 일의 태그행 전부 delete → 요청받은 태그 전부
           insert" 였다. 그런데 Hibernate 는 같은 트랜잭션의 쓰기를 **insert 먼저, delete
           나중**으로 flush 한다. 그래서 이미 붙어 있던 태그가 요청에 그대로 포함되면
           (= '태그 하나 더 붙이기', 가장 흔한 태그 동작) 아직 지워지지 않은 기존 행과
           부딪혀 uk_todo_tag 유니크 제약 위반으로 **매번** 통째로 실패했다.
           화면에는 DB 오류 원문이 뜨고, 새로고침하면 반영돼 있어 더 헷갈렸다.
           지금은 지울 것/더할 것만 계산해 건드린다(안 바뀐 행은 손대지 않음). */
        User owner = fx.user("owner");
        Workspace ws = fx.workspace("팀", owner);
        Todo todo = fx.todo(ws, owner, "태그 붙일 할 일");
        Tag a = fx.tag(ws, "긴급", owner);
        Tag b = fx.tag(ws, "버그", owner);
        fx.attachTag(todo, a);   // 이미 A 가 붙어 있는 상태에서 시작해야 결함이 재현된다

        mvc.perform(put("/api/todos/" + todo.getId() + "/tags")
                        .header(HttpHeaders.AUTHORIZATION, fx.bearer(owner))
                        .header("X-Workspace-Id", ws.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("tagIds", List.of(a.getId(), b.getId())))))
                .andExpect(status().isOk());

        assertThat(tagIdsOf(todo))
                .containsExactlyInAnyOrder(a.getId(), b.getId());
    }

    @Test
    @DisplayName("같은 태그 id 가 중복으로 들어와도 성공하고 한 번만 붙는다")
    void duplicateTagIdsInRequestAreCollapsed() throws Exception {
        /* [고정하는 결함] 클라이언트가 같은 태그를 두 번 담아 보내는 일이 실제로 있었다 —
           태그 생성은 같은 이름이 있으면 기존 태그를 재사용해 돌려주는데, 화면은 그걸
           새 태그처럼 목록에 덧붙였기 때문이다. 서버는 그대로 두 행을 insert 하려다
           uk_todo_tag 위반으로 요청 전체가 실패했다.
           전체 교체 API 에서 중복은 의미가 없으므로 서버가 접어서 처리한다. */
        User owner = fx.user("owner");
        Workspace ws = fx.workspace("팀", owner);
        Todo todo = fx.todo(ws, owner, "태그 붙일 할 일");
        Tag a = fx.tag(ws, "회의", owner);

        mvc.perform(put("/api/todos/" + todo.getId() + "/tags")
                        .header(HttpHeaders.AUTHORIZATION, fx.bearer(owner))
                        .header("X-Workspace-Id", ws.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("tagIds", List.of(a.getId(), a.getId())))))
                .andExpect(status().isOk());

        assertThat(tagIdsOf(todo)).containsExactly(a.getId());
    }
}
