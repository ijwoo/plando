package com.example.llm.tool;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * AI 도구 목록의 **유일한 출처**.
 *
 * 프롬프트에 넣을 설명도, 서버가 허용할 action 목록도 전부 여기서 나온다.
 * 도구를 추가하려면 TOOLS 에 한 줄 넣으면 되고, 프롬프트와 검증이 자동으로 따라간다.
 *
 * 왜 이렇게 바꿨나: 예전에는 같은 목록이 LlmRouter 의 Set.of 와 프롬프트 문자열에 각각 있었다.
 * 한쪽만 고치면 LLM 은 새 도구를 아는데 서버가 거부하거나, 서버는 받는데 LLM 이 몰랐다.
 * 둘 다 조용히 "chat" 으로 떨어져서, 사용자에겐 **기능이 없는 것처럼** 보였다.
 */
public final class ToolRegistry {

    private ToolRegistry() {}

    private static final List<ToolSpec> TOOLS = List.of(
            ToolSpec.readOnly("search_tasks", "일정/할 일 조회", """
                    {
                      "query"     : string?,                   // 키워드 검색
                      "status"    : "TODO|IN_PROGRESS|DONE"?,
                      "priority"  : "HIGH|MEDIUM|LOW"?,
                      "assigneeId": string?,
                      "dueFrom"   : "YYYY-MM-DD"?,             // 기간 시작(이번주/다음주/이번달 등)
                      "dueTo"     : "YYYY-MM-DD"?,             // 기간 끝 — dueFrom 과 함께 쓴다
                      "overdue"   : boolean?,                  // 기한 지난 일정: true
                      "limit"     : number?,                   // 기본 10, "전부/다/모두/전체" → 50
                      "dueDate"   : string?                    // 특정 날짜 조회: YYYY-MM-DD
                    }"""),

            ToolSpec.mutating("create_task", "일정/할 일 생성", """
                    {
                      "title"        : string,
                      "description"  : string?,
                      "priority"     : "HIGH|MEDIUM|LOW"?,
                      "assigneeId"   : string?,
                      "dueDate"      : string?,                // 마감일: YYYY-MM-DD
                      "startDate"    : string?,                // 시작일: YYYY-MM-DD
                      "startTime"    : string?,                // 시작 시간: "HH:mm" (24h)
                      "endTime"      : string?,                // 종료 시간: "HH:mm" (24h)
                      "locationName" : string?,                // 장소명: "강남역", "스타벅스 역삼점" 등
                      "projectName"  : string?,                // 워크스페이스 데이터의 프로젝트 목록에 있는 이름 그대로
                      "tagNames"     : string[]?,              // 워크스페이스 데이터의 태그 목록에 있는 이름만
                      "assigneeName" : string?,                // 워크스페이스 데이터의 멤버 이름 또는 이메일
                      "statusKey"    : string?,                // 워크스페이스 데이터의 상태 key값 (기본은 생략=할 일)
                      "tasks"        : array?                  // 여러 일정 생성 시에만 — 위 필드 구조의 객체 배열(최대 14개)
                    }"""),

            ToolSpec.mutating("update_task", "일정/할 일 수정", """
                    {
                      "taskId"       : string,
                      "title"        : string?,
                      "description"  : string?,
                      "status"       : "TODO|IN_PROGRESS|DONE"?,
                      "priority"     : "HIGH|MEDIUM|LOW"?,
                      "assigneeId"   : string?,
                      "dueDate"      : string?,                // 마감일 변경: YYYY-MM-DD
                      "startDate"    : string?,                // 시작일 변경: YYYY-MM-DD
                      "startTime"    : string?,                // 시작 시간 변경: "HH:mm"
                      "endTime"      : string?,                // 종료 시간 변경: "HH:mm"
                      "clearDueDate" : boolean?                // 마감일 삭제: true
                    }"""),

            ToolSpec.mutating("delete_task", "일정/할 일 삭제",
                    "{ \"taskId\": string }"),

            ToolSpec.control("need_more_info", "정보가 부족할 때"),
            ToolSpec.control("chat", "위에 해당 없을 때")
    );

    private static final Map<String, ToolSpec> BY_NAME = TOOLS.stream()
            .collect(Collectors.toMap(ToolSpec::name, t -> t, (a, b) -> a, LinkedHashMap::new));

    public static List<ToolSpec> all() {
        return TOOLS;
    }

    public static Set<String> names() {
        return BY_NAME.keySet();
    }

    public static boolean isAllowed(String action) {
        return action != null && BY_NAME.containsKey(action);
    }

    public static ToolSpec find(String action) {
        return BY_NAME.get(action);
    }

    /** 데이터를 바꾸는 도구인가. 모르는 이름이면 안전한 쪽(false)으로 답한다. */
    public static boolean isMutating(String action) {
        ToolSpec spec = BY_NAME.get(action);
        return spec != null && spec.mutating();
    }

    /** 프롬프트의 "## 가능한 action" 블록. 이름 폭을 맞춰 읽기 쉽게 정렬한다. */
    public static String promptActionList() {
        int width = TOOLS.stream().mapToInt(t -> t.name().length()).max().orElse(0);
        return TOOLS.stream()
                .map(t -> String.format("- \"%s\"%s: %s",
                        t.name(),
                        " ".repeat(width - t.name().length()),
                        t.summary()))
                .collect(Collectors.joining("\n"));
    }

    /** 프롬프트의 "## {name} args" 블록들. 인자가 없는 제어용 도구는 건너뛴다. */
    public static String promptArgSpecs() {
        return TOOLS.stream()
                .filter(t -> t.argsSpec() != null)
                .map(t -> "## " + t.name() + " args\n" + t.argsSpec())
                .collect(Collectors.joining("\n\n"));
    }
}
