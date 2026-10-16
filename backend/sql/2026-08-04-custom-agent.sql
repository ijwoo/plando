-- 사용자 정의 AI 역할.
--
-- 워크스페이스 단위로 공유한다 — 팀이 같은 방식으로 AI 를 쓰게 하는 게 이 기능의 값어치다.
-- 개인용이면 그냥 프롬프트를 매번 치는 것과 다르지 않다.
--
-- allowed_tools 는 쉼표 구분 문자열. 별도 테이블로 나눌 만큼 복잡하지 않고, 도구 이름은
-- 서버(ToolRegistry)가 검증하므로 자유 입력이 아니다.
--
-- prod 는 ddl-auto=validate 라 이 스크립트를 먼저 돌려야 부팅된다.

CREATE TABLE IF NOT EXISTS todo.custom_agent (
    id            BIGSERIAL PRIMARY KEY,
    workspace_id  BIGINT       NOT NULL,
    name          VARCHAR(40)  NOT NULL,
    emoji         VARCHAR(8),
    description   VARCHAR(120),
    instructions  TEXT,
    allowed_tools VARCHAR(300),
    created_by    VARCHAR(120),
    created_at    TIMESTAMP    NOT NULL,
    updated_at    TIMESTAMP
);

-- 조회는 항상 워크스페이스 단위다(남의 역할이 섞이면 안 된다).
CREATE INDEX IF NOT EXISTS idx_custom_agent_workspace ON todo.custom_agent (workspace_id);

SELECT count(*) AS custom_agent_rows FROM todo.custom_agent;
