-- ============================================================
-- Plando — Prod Schema Migration
-- Date: 2026-06-15
-- DB: PostgreSQL, schema=todo
-- Branch: feature/project-grouping → master
--
-- 직전 운영 배포(2026-05-28, 백엔드 c2b2363) 이후 추가된 스키마 전체.
-- prod 는 ddl-auto=validate 이므로 백엔드 부팅 *전에* 반드시 적용해야 한다.
--
-- 포함 내용 (커밋 기준):
--   1. project 테이블 + todo.project_id            (5fa6b34 프로젝트 도메인)
--   2. todo_template.default_project_id            (40677b1 템플릿 기본 프로젝트)
--   3. user_settings 4개 컬럼                      (40677b1 설정 확장 / 0ce0944 자동 보관)
--      - due_reminder_lead_days / default_due / week_start_day / auto_archive_days
--   4. wrap_self_memo, wrap_comment_cache 테이블    (64a3b41 주간 회고)
--   5. dm_messages.reply_to_id                     (2c09a5d DM 답장)
--   6. dm_room_read 테이블                          (b8830b8 DM 그룹 per-user 읽음)
--
-- 스키마 변경 없음(참고): CSV 내보내기(2db2a03), DM 공지 고정·링크 미리보기(a408a18)
--   — 컨트롤러/서비스만, 영속 컬럼 없음(링크 프리뷰는 on-demand fetch).
--
-- 실행:
--   psql -h <host> -U <user> -d <db> -f 2026-06-15-prod-migration.sql
--
-- 배포 순서:
--   1) prod DB 백업 (pg_dump)
--   2) 이 파일 적용 (끝의 검증 SELECT 가 모두 ok=true 인지 확인)
--   3) ./scripts/deploy.sh 로 백엔드/프론트 배포
--   4) 백엔드 부팅 로그에 schema validation 에러 없는지 확인
--
-- 안전 장치:
--   - 전체 BEGIN/COMMIT 트랜잭션 — 중간 실패 시 자동 ROLLBACK
--   - ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS / FK 는 가드 DO 블록
--     → 부분 적용된 상태에서 재실행해도 안전 (idempotent)
-- ============================================================

BEGIN;

-- ============================================================
-- 1. project 테이블 (워크스페이스 내 할 일 그룹화 단위)
--    Project.java 매핑. created_by/created_at nullable.
-- ============================================================

CREATE TABLE IF NOT EXISTS todo.project (
    id            BIGSERIAL PRIMARY KEY,
    name          VARCHAR(255) NOT NULL,
    color         VARCHAR(255),
    icon          VARCHAR(255),
    workspace_id  BIGINT       NOT NULL,
    created_by    BIGINT,
    created_at    TIMESTAMP,
    CONSTRAINT fk_project_workspace FOREIGN KEY (workspace_id) REFERENCES todo.workspace(id),
    CONSTRAINT fk_project_created_by FOREIGN KEY (created_by)  REFERENCES todo.users(id)
);

CREATE INDEX IF NOT EXISTS idx_project_workspace
    ON todo.project (workspace_id);


-- ============================================================
-- 2. todo.project_id — 할 일의 소속 프로젝트 (null = 인박스)
--    삭제 시 ProjectController 가 todoRepository.clearProject 로 먼저
--    null 처리하므로 FK 는 기본(NO ACTION).
-- ============================================================

ALTER TABLE todo.todo
ADD COLUMN IF NOT EXISTS project_id BIGINT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_todo_project'
    ) THEN
        ALTER TABLE todo.todo
        ADD CONSTRAINT fk_todo_project
        FOREIGN KEY (project_id) REFERENCES todo.project(id);
    END IF;
END $$;


-- ============================================================
-- 3. todo_template.default_project_id — 템플릿 기본 소속 프로젝트
--    (TodoTemplate.defaultProjectId, FK 없음 — 엔티티가 plain Long)
-- ============================================================

ALTER TABLE todo.todo_template
ADD COLUMN IF NOT EXISTS default_project_id BIGINT;


-- ============================================================
-- 4. user_settings 확장 컬럼 (설정 확장 + 완료 자동 보관)
--    엔티티 기본값과 동일하게 DEFAULT 부여 (기존 행도 채워짐).
-- ============================================================

ALTER TABLE todo.user_settings
ADD COLUMN IF NOT EXISTS due_reminder_lead_days INTEGER DEFAULT 1;

ALTER TABLE todo.user_settings
ADD COLUMN IF NOT EXISTS default_due VARCHAR(255) DEFAULT 'none';

ALTER TABLE todo.user_settings
ADD COLUMN IF NOT EXISTS week_start_day VARCHAR(255) DEFAULT 'sun';

ALTER TABLE todo.user_settings
ADD COLUMN IF NOT EXISTS auto_archive_days INTEGER DEFAULT 30;


-- ============================================================
-- 5. 주간 회고 — wrap_self_memo (사용자 직접 메모, user+week 유니크)
-- ============================================================

CREATE TABLE IF NOT EXISTS todo.wrap_self_memo (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT        NOT NULL,
    week_start  DATE          NOT NULL,
    content     VARCHAR(2000) NOT NULL,
    created_at  TIMESTAMP     NOT NULL,
    updated_at  TIMESTAMP     NOT NULL,
    CONSTRAINT fk_wrap_self_memo_user FOREIGN KEY (user_id) REFERENCES todo.users(id),
    CONSTRAINT uk_wrap_self_memo_user_week UNIQUE (user_id, week_start)
);


-- ============================================================
-- 6. 주간 회고 — wrap_comment_cache (AI 한마디 캐시, user+week+persona 유니크)
-- ============================================================

CREATE TABLE IF NOT EXISTS todo.wrap_comment_cache (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT       NOT NULL,
    week_start  DATE         NOT NULL,
    persona     VARCHAR(32)  NOT NULL DEFAULT 'analyst',
    comment     VARCHAR(500) NOT NULL,
    created_at  TIMESTAMP    NOT NULL,
    CONSTRAINT fk_wrap_comment_user FOREIGN KEY (user_id) REFERENCES todo.users(id),
    CONSTRAINT uk_wrap_comment_user_week_persona UNIQUE (user_id, week_start, persona)
);


-- ============================================================
-- 7. dm_messages.reply_to_id — 답장 대상 메시지 id (nullable, FK 없음)
-- ============================================================

ALTER TABLE todo.dm_messages
ADD COLUMN IF NOT EXISTS reply_to_id BIGINT;


-- ============================================================
-- 8. dm_room_read — DM 방 참여자별 마지막 읽은 시각 (per-user 읽음)
--    엔티티가 plain Long(room_id/user_id) — FK 없음, (room_id,user_id) 유니크.
-- ============================================================

CREATE TABLE IF NOT EXISTS todo.dm_room_read (
    id            BIGSERIAL PRIMARY KEY,
    room_id       BIGINT    NOT NULL,
    user_id       BIGINT    NOT NULL,
    last_read_at  TIMESTAMP NOT NULL,
    CONSTRAINT uk_dm_room_read UNIQUE (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_dm_room_read_room
    ON todo.dm_room_read (room_id);


-- ============================================================
-- 9. 적용 결과 검증
-- ============================================================

\echo '=== 신규 테이블 확인 ==='

SELECT 'project 테이블' AS check, EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='todo' AND table_name='project'
) AS ok;

SELECT 'wrap_self_memo 테이블' AS check, EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='todo' AND table_name='wrap_self_memo'
) AS ok;

SELECT 'wrap_comment_cache 테이블' AS check, EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='todo' AND table_name='wrap_comment_cache'
) AS ok;

SELECT 'dm_room_read 테이블' AS check, EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='todo' AND table_name='dm_room_read'
) AS ok;

\echo '=== 신규 컬럼 확인 ==='

SELECT 'todo.project_id' AS check, EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='todo' AND table_name='todo' AND column_name='project_id'
) AS ok;

SELECT 'todo_template.default_project_id' AS check, EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='todo' AND table_name='todo_template' AND column_name='default_project_id'
) AS ok;

SELECT 'user_settings.due_reminder_lead_days' AS check, EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='todo' AND table_name='user_settings' AND column_name='due_reminder_lead_days'
) AS ok;

SELECT 'user_settings.default_due' AS check, EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='todo' AND table_name='user_settings' AND column_name='default_due'
) AS ok;

SELECT 'user_settings.week_start_day' AS check, EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='todo' AND table_name='user_settings' AND column_name='week_start_day'
) AS ok;

SELECT 'user_settings.auto_archive_days' AS check, EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='todo' AND table_name='user_settings' AND column_name='auto_archive_days'
) AS ok;

SELECT 'dm_messages.reply_to_id' AS check, EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='todo' AND table_name='dm_messages' AND column_name='reply_to_id'
) AS ok;

\echo '=== Migration 완료 ==='

-- 검증 결과 OK이면 COMMIT, 의심되면 한 줄을 ROLLBACK으로 바꿔 재실행 후 확인
COMMIT;
-- ROLLBACK;
