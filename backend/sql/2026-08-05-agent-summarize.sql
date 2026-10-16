-- 역할별 "조회 결과 한 줄 요약" 스위치.
--
-- 켜면 조회할 때마다 LLM 을 한 번 더 부른다 — 하루 사용량이 그만큼 더 든다.
-- 그래서 전역 설정이 아니라 **역할마다** 둔다. 브리핑용 역할에서만 켜고 나머지는 끈 채로
-- 쓰면 평소 비용은 그대로다.
--
-- prod 는 ddl-auto=validate 라 이 스크립트를 먼저 돌려야 부팅된다.

ALTER TABLE todo.custom_agent
    ADD COLUMN IF NOT EXISTS summarize BOOLEAN NOT NULL DEFAULT FALSE;

SELECT count(*) AS agents, count(*) FILTER (WHERE summarize) AS summarize_on
FROM todo.custom_agent;
