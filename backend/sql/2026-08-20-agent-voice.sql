-- 역할 말투 — 답변 문장을 역할 지침대로 다시 쓸지.
--
-- 왜 필요한가: 이 앱의 답변은 서버가 조립한 고정 문구다. 그래서 역할에 지침을 아무리 써도
-- 말투가 하나도 안 바뀌었다("지침으로는 말투를 못 바꾼다"고 문서에 적어 둘 정도였다).
-- 이 스위치를 켠 역할만 답변을 LLM 이 다시 쓴다.
--
-- summarize 와 따로 두는 이유: 하는 일이 다르다. summarize 는 조회 결과에 "무엇부터 할지"
-- 한 줄을 덧붙이고, voice 는 답변 문장 자체를 바꾼다. 다만 둘 다 켜면 LLM 을 두 번 부르므로
-- 서버가 voice 를 우선하고 summarize 는 건너뛴다(비용이 두 배가 되지 않게).
--
-- 기본값 false — 켜면 대화마다 LLM 호출이 한 번 더 든다. 기존 역할의 비용은 그대로 둔다.
--
-- prod 는 ddl-auto=validate 라 이 스크립트를 먼저 돌려야 부팅된다.

ALTER TABLE todo.custom_agent
    ADD COLUMN IF NOT EXISTS voice BOOLEAN NOT NULL DEFAULT FALSE;

SELECT count(*) AS custom_agent_rows, count(*) FILTER (WHERE voice) AS voice_on
FROM todo.custom_agent;
