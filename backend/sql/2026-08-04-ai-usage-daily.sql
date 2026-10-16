-- AI 일일 사용량 테이블.
--
-- 왜 DB 인가: 메모리에 세면 배포할 때마다 0 으로 돌아간다. 이 프로젝트는 하루에도 여러 번
-- 배포하므로 메모리 카운터는 사실상 제한이 아니다. 제한이 있는 척하면서 실제로는 안 막는 게
-- 제일 나쁘다.
--
-- 왜 요청이 아니라 LLM 호출을 세는가: 다단계 루프가 생겨 요청 하나가 LLM 을 최대 5번 부른다.
-- 요청 수로 세면 실제 비용과 5배까지 어긋난다. 돈이 나가는 단위로 센다.
--
-- prod 는 ddl-auto=validate 라 이 스크립트를 먼저 돌려야 부팅된다.

CREATE TABLE IF NOT EXISTS todo.ai_usage_daily (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT  NOT NULL,
    usage_date  DATE    NOT NULL,
    llm_calls   INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT uk_ai_usage_user_date UNIQUE (user_id, usage_date)
);

-- 사용자별 오늘 사용량 조회가 유일한 읽기 패턴이라 유니크 제약이 곧 인덱스가 된다.
-- 오래된 행 정리는 나중에 필요해지면 추가한다(하루 한 행이라 한동안 문제없다).

SELECT count(*) AS ai_usage_rows FROM todo.ai_usage_daily;
