-- ============================================================
-- Plando — Prod Schema Migration
-- Date: 2026-07-12
-- DB: PostgreSQL, schema=todo
-- Branch: feat/subtasks → master
--
-- Todo 서브태스크(1단계 깊이) 지원:
--   todo.parent_id BIGINT NULL — 자기참조 FK (todo.id).
--   부모 삭제 시 자식은 애플리케이션에서 parent_id = NULL 로 승격
--   (TodoRepository.promoteSubtasksOf) 하므로 FK 는 기본(NO ACTION).
--
-- 실행:
--   psql -h <host> -U <user> -d <db> -f 2026-07-12-subtasks.sql
--
-- 안전 장치:
--   - 전체 BEGIN/COMMIT 트랜잭션 — 중간 실패 시 자동 ROLLBACK
--   - ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS / FK 는 가드 DO 블록
--     → 부분 적용된 상태에서 재실행해도 안전 (idempotent)
-- ============================================================

BEGIN;

-- ============================================================
-- 1. todo.parent_id — 서브태스크의 부모 할 일 (null = 최상위)
--    깊이 1단계 제한은 애플리케이션(TodoService.validateParentAssignment)에서 강제.
-- ============================================================

ALTER TABLE todo.todo
ADD COLUMN IF NOT EXISTS parent_id BIGINT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_todo_parent'
    ) THEN
        ALTER TABLE todo.todo
        ADD CONSTRAINT fk_todo_parent
        FOREIGN KEY (parent_id) REFERENCES todo.todo(id);
    END IF;
END $$;

-- 서브태스크 목록/카운트 집계용 인덱스
CREATE INDEX IF NOT EXISTS idx_todo_parent_id
ON todo.todo (parent_id);


-- ============================================================
-- 검증
-- ============================================================

SELECT 'todo.parent_id' AS check, EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='todo' AND table_name='todo' AND column_name='parent_id'
) AS ok;

SELECT 'fk_todo_parent' AS check, EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_todo_parent'
) AS ok;

SELECT 'idx_todo_parent_id' AS check, EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='todo' AND tablename='todo' AND indexname='idx_todo_parent_id'
) AS ok;

\echo '=== Migration 완료 ==='

-- 검증 결과 OK이면 COMMIT, 의심되면 아래 한 줄을 ROLLBACK으로 바꿔 재실행 후 확인
COMMIT;
-- ROLLBACK;
