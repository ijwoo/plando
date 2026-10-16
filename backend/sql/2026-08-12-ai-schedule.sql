-- 예약 실행 — 역할을 시간에 걸어둔다.
--
-- 지금까지 역할은 "도구"였다. 사용자가 앱을 열고 직접 쳐야 무언가 일어난다. 시간에 걸리면
-- "비서"가 된다 — 아침에 알아서 브리핑이 온다.
--
-- 조회 전용 역할만 걸 수 있다. 사람이 없는 사이 데이터가 바뀌면, 아침에 열었을 때 마감이
-- 옮겨져 있고 누가 한 건지 알 수 없는 상태가 된다. 예약은 알려주기만 하고, 고치는 건
-- 알림을 보고 사람이 정한다. (서버가 생성 시점과 실행 시점 양쪽에서 검사한다 — 역할의
-- 도구 목록은 나중에 바뀔 수 있다.)
--
-- last_run_at 은 기록이 아니라 **잠금**이다. 블루/그린 배포 중에는 두 인스턴스가 잠깐
-- 같이 떠 있고, 둘 다 크론을 돌린다. 조건부 UPDATE 로 한쪽만 집게 해서 알림이 두 번
-- 가는 걸 막는다. 재기동으로 같은 분이 두 번 도는 경우도 같은 장치로 막힌다.
--
-- prod 는 ddl-auto=validate 라 이 스크립트를 먼저 돌려야 부팅된다.

CREATE TABLE IF NOT EXISTS todo.ai_schedule (
    id           BIGSERIAL     PRIMARY KEY,
    workspace_id BIGINT        NOT NULL,
    -- 결과를 받을 사람. 예약은 워크스페이스가 아니라 개인에게 간다 —
    -- 팀 전원에게 매일 아침 푸시가 가면 그건 알림이 아니라 소음이다.
    user_email   VARCHAR(120)  NOT NULL,
    agent_id     VARCHAR(64)   NOT NULL,
    -- 실행할 문장. 역할만으로는 무엇을 물을지 정해지지 않는다("밀린 일" 인지 "오늘 일정" 인지).
    prompt       VARCHAR(300)  NOT NULL,
    -- hour/minute 는 SQL 예약어라 그대로 쓰면 문법 오류가 난다
    run_hour     SMALLINT      NOT NULL,
    run_minute   SMALLINT      NOT NULL,
    -- 요일 필터. 'DAILY' 또는 'MON,TUE,...' — 7개까지라 별도 테이블로 나눌 값어치가 없다.
    days         VARCHAR(32)   NOT NULL DEFAULT 'DAILY',
    enabled      BOOLEAN       NOT NULL DEFAULT TRUE,
    last_run_at  TIMESTAMP,
    created_at   TIMESTAMP     NOT NULL,
    updated_at   TIMESTAMP
);

-- 크론이 매분 도는 질의: "지금 이 시각에 켜져 있는 예약". 이 인덱스가 없으면
-- 1분마다 전체 스캔이 돈다.
CREATE INDEX IF NOT EXISTS idx_ai_schedule_due
    ON todo.ai_schedule (enabled, run_hour, run_minute);

-- 목록 조회는 사람 단위(내 예약만 보인다).
CREATE INDEX IF NOT EXISTS idx_ai_schedule_owner
    ON todo.ai_schedule (workspace_id, user_email);

SELECT count(*) AS ai_schedule_rows FROM todo.ai_schedule;
