package com.example.llm.tool;

/**
 * AI 가 쓸 수 있는 도구 하나의 정의.
 *
 * 예전에는 도구 목록이 두 곳에 흩어져 있었다 — LlmRouter 의 ALLOWED_ACTIONS(Set.of) 와
 * LlmPrompts 의 413줄짜리 프롬프트 문자열. 도구를 하나 추가하려면 두 곳을 손대야 했고,
 * 한쪽만 고치면 **LLM 은 아는데 서버가 거부하거나(그 반대) 조용히 chat 으로 떨어졌다.**
 *
 * 이제 정의는 여기 하나뿐이고, 프롬프트와 허용 목록은 둘 다 여기서 생성된다.
 *
 * @param name      LLM 이 출력할 action 이름. 바꾸면 프롬프트·검증이 함께 따라간다.
 * @param summary   "## 가능한 action" 목록에 들어갈 한 줄 설명
 * @param argsSpec  "## {name} args" 블록. 인자가 없으면 null
 * @param mutating  데이터를 바꾸는 도구인가. 확인 절차·감사 로그의 기준이 된다
 *                  (조회는 실패해도 되돌릴 게 없지만 생성·수정·삭제는 다르다)
 */
public record ToolSpec(
        String name,
        String summary,
        String argsSpec,
        boolean mutating
) {
    public static ToolSpec readOnly(String name, String summary, String argsSpec) {
        return new ToolSpec(name, summary, argsSpec, false);
    }

    public static ToolSpec mutating(String name, String summary, String argsSpec) {
        return new ToolSpec(name, summary, argsSpec, true);
    }

    /** 인자 없이 제어 흐름만 담당하는 것(need_more_info, chat 등). */
    public static ToolSpec control(String name, String summary) {
        return new ToolSpec(name, summary, null, false);
    }
}
