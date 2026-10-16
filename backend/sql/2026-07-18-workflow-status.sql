-- 커스텀 상태(워크플로우) — 워크스페이스별 상태 집합 정의.
-- 기존 Todo.status(varchar)는 그대로. 기본 3상태 key를 기존 값과 동일하게 시드 → 기존 할일 무마이그레이션.
-- 멱등. prod는 ddl-auto=validate이므로 jar 배포 전에 적용.

CREATE TABLE IF NOT EXISTS todo.workflow_status (
    id           BIGSERIAL PRIMARY KEY,
    workspace_id BIGINT       NOT NULL REFERENCES todo.workspace(id) ON DELETE CASCADE,
    status_key   VARCHAR(64)  NOT NULL,
    label        VARCHAR(64)  NOT NULL,
    color        VARCHAR(16),
    category     VARCHAR(16)  NOT NULL,
    sort_order   INT          NOT NULL DEFAULT 0,
    is_default   BOOLEAN      NOT NULL DEFAULT false,
    created_at   TIMESTAMP    NOT NULL DEFAULT now(),
    CONSTRAINT uk_wfstatus_ws_key UNIQUE (workspace_id, status_key),
    CONSTRAINT ck_wfstatus_category CHECK (category IN ('TODO', 'IN_PROGRESS', 'DONE'))
);
CREATE INDEX IF NOT EXISTS idx_wfstatus_ws ON todo.workflow_status(workspace_id, sort_order);

-- Todo.status가 enum→varchar(커스텀 key) 되면서, Hibernate가 만든 status CHECK 제약(TODO/IN_PROGRESS/DONE만 허용)이
-- 커스텀 상태 key(st_xxx) 저장을 막는다 → 제거. (기존 값은 그대로 유효)
ALTER TABLE todo.todo DROP CONSTRAINT IF EXISTS todo_status_check;

-- 모든 기존 워크스페이스에 기본 3상태 시드 (이미 있으면 skip)
INSERT INTO todo.workflow_status (workspace_id, status_key, label, color, category, sort_order, is_default)
SELECT w.id, v.k, v.l, v.c, v.cat, v.o, v.d
FROM todo.workspace w
CROSS JOIN (VALUES
    ('TODO',        '할 일',   '#94A3B8', 'TODO',        0, true),
    ('IN_PROGRESS', '진행 중', '#3070EB', 'IN_PROGRESS', 1, false),
    ('DONE',        '완료',    '#22B8A6', 'DONE',        2, false)
) AS v(k, l, c, cat, o, d)
ON CONFLICT (workspace_id, status_key) DO NOTHING;
