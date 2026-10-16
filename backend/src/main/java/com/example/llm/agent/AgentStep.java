package com.example.llm.agent;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 에이전트가 실행한 한 단계의 기록.
 *
 * 왜 남기는가: 예전에는 AI 가 무엇을 했는지 사용자가 알 방법이 결과 문장 하나뿐이었다.
 * "3건을 찾았어요" 는 어떤 조건으로 찾았는지, 왜 그 3건인지 말해주지 않는다. 뭔가 어긋나도
 * 사용자는 **AI 를 못 믿게 될 뿐 고칠 단서를 못 얻는다.**
 *
 * 단계를 남겨 화면에 보여주면 (1) 무엇을 했는지 확인할 수 있고 (2) 실패했을 때 어디서
 * 멈췄는지 보이고 (3) 잘못된 인자로 실행됐을 때 사용자가 바로 알아챈다.
 *
 * 인자·결과는 **요약해서** 담는다. 원문을 그대로 실으면 응답이 커지고, 남의 데이터가
 * 섞여 나갈 위험도 생긴다.
 */
public class AgentStep {

    /** 실행한 도구 이름 (ToolRegistry 의 name). */
    private String tool;

    /** 사람이 읽을 한 줄 요약. 예: "마감 지난 할 일 조회 (최대 10건)" */
    private String summary;

    /** 화면에 보여줄 인자 요약. 민감하거나 긴 값은 넣지 않는다. */
    private Map<String, Object> args = new LinkedHashMap<>();

    /** 결과 요약. 예: {"count": 3} */
    private Map<String, Object> result = new LinkedHashMap<>();

    /**
     * 다음 판단에 넘길 결과. **화면에는 보내지 않는다**(@JsonIgnore).
     *
     * result 는 사람이 볼 요약이라 {"count": 4} 뿐인데, 다음 단계가 "그 중 무엇을" 고치려면
     * 실제 id 가 있어야 한다. 이게 비어 있으면 모델은 고칠 대상을 알 길이 없어 프롬프트
     * 예시의 가짜 id(T-1)를 그대로 베낀다 — 실제로 그렇게 실패했다.
     */
    @com.fasterxml.jackson.annotation.JsonIgnore
    private Map<String, Object> contextResult = new LinkedHashMap<>();

    /** 데이터를 바꾸는 단계였는가. 화면에서 다르게 표시하고, 되돌리기 안내의 근거가 된다. */
    private boolean mutating;

    private boolean ok = true;

    /** 실패 시 사람이 읽을 사유. 성공이면 null. 내부 스택·URL 은 담지 않는다. */
    private String error;

    private long durationMs;

    public static AgentStep of(String tool, String summary, boolean mutating) {
        AgentStep s = new AgentStep();
        s.tool = tool;
        s.summary = summary;
        s.mutating = mutating;
        return s;
    }

    public AgentStep withContext(Map<String, Object> ctx) {
        if (ctx != null) this.contextResult = new LinkedHashMap<>(ctx);
        return this;
    }

    @com.fasterxml.jackson.annotation.JsonIgnore
    public Map<String, Object> getContextResult() {
        return contextResult.isEmpty() ? result : contextResult;
    }

    public AgentStep withArgs(Map<String, Object> args) {
        if (args != null) this.args = new LinkedHashMap<>(args);
        return this;
    }

    public AgentStep succeeded(Map<String, Object> result, long durationMs) {
        this.ok = true;
        this.durationMs = durationMs;
        if (result != null) this.result = new LinkedHashMap<>(result);
        return this;
    }

    public AgentStep failed(String error, long durationMs) {
        this.ok = false;
        this.error = error;
        this.durationMs = durationMs;
        return this;
    }

    public String getTool() { return tool; }
    public String getSummary() { return summary; }
    public Map<String, Object> getArgs() { return args; }
    public Map<String, Object> getResult() { return result; }
    public boolean isMutating() { return mutating; }
    public boolean isOk() { return ok; }
    public String getError() { return error; }
    public long getDurationMs() { return durationMs; }
}
