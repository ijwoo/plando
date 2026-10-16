package com.example.todo;

import com.example.todo.entity.Todo;
import com.example.todo.entity.User;
import com.example.todo.entity.Workspace;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * GET /api/search 의 할 일 페이징 (commit 3d7b77d).
 */
class SearchPagingIntegrationTest extends IntegrationTestBase {

    /** SearchService.TASK_PAGE_SIZE */
    private static final int PAGE_SIZE = 30;

    @Autowired TestFixtures fx;

    private List<Long> taskIds(String body) throws Exception {
        JsonNode tasks = json.readTree(body).get("tasks");
        List<Long> ids = new ArrayList<>();
        tasks.forEach(t -> ids.add(t.get("id").asLong()));
        return ids;
    }

    @Test
    @DisplayName("두 페이지에 걸친 검색 결과가 누락·중복 없이 전부 나온다")
    void searchPagesCoverEveryMatchWithoutGapsOrDuplicates() throws Exception {
        /* [고정하는 결함] SearchService 가 "다음 페이지 있나?"를 알아내려고 한 건 더
           요청하면서 PageRequest.of(page, SIZE + 1) 을 썼다. PageRequest 는 offset 을
           page * size 로만 계산하므로 offset 이 page * 31 이 되는데, 응답은 30건으로
           잘랐다. 결과적으로 **페이지를 넘길 때마다 정확히 1건이 영구히 사라졌다**
           (31번째 결과는 0페이지에도 1페이지에도 없었다). 오류도 안 나서 아무도 몰랐다.
           지금은 offset(page*30)과 limit(31)을 따로 지정한다.
           경계를 넘겨야 재현되므로 30건을 초과하는 35건을 시딩한다. */
        User owner = fx.user("owner");
        Workspace ws = fx.workspace("팀", owner);

        int total = PAGE_SIZE + 5;
        Set<Long> seeded = new LinkedHashSet<>();
        for (int i = 0; i < total; i++) {
            Todo t = fx.todo(ws, owner, "페이징검증 대상 " + i);
            seeded.add(t.getId());
        }

        String page0 = mvc.perform(get("/api/search")
                        .param("q", "페이징검증")
                        .param("page", "0")
                        .header(HttpHeaders.AUTHORIZATION, fx.bearer(owner))
                        .header("X-Workspace-Id", ws.getId()))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        String page1 = mvc.perform(get("/api/search")
                        .param("q", "페이징검증")
                        .param("page", "1")
                        .header(HttpHeaders.AUTHORIZATION, fx.bearer(owner))
                        .header("X-Workspace-Id", ws.getId()))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        List<Long> first = taskIds(page0);
        List<Long> second = taskIds(page1);

        assertThat(first).hasSize(PAGE_SIZE);
        assertThat(json.readTree(page0).get("hasMoreTasks").asBoolean()).isTrue();
        assertThat(second).hasSize(total - PAGE_SIZE);

        List<Long> merged = new ArrayList<>(first);
        merged.addAll(second);
        // 중복 없음
        assertThat(merged).doesNotHaveDuplicates();
        // 누락 없음 — 시딩한 35건이 두 페이지 합집합에 전부 있어야 한다
        assertThat(merged).containsExactlyInAnyOrderElementsOf(seeded);
    }
}
