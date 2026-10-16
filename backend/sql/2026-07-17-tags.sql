-- 태그(라벨) 기능 — 할 일을 프로젝트·우선순위와 별개로 가로질러 분류.
-- 멱등(IF NOT EXISTS). prod는 ddl-auto=validate이므로 jar 배포 전에 적용.

CREATE TABLE IF NOT EXISTS todo.tag (
    id           BIGSERIAL PRIMARY KEY,
    name         VARCHAR(40)  NOT NULL,
    color        VARCHAR(16),
    workspace_id BIGINT       NOT NULL REFERENCES todo.workspace(id) ON DELETE CASCADE,
    created_by   BIGINT       REFERENCES todo.users(id) ON DELETE SET NULL,
    created_at   TIMESTAMP    NOT NULL DEFAULT now(),
    CONSTRAINT uk_tag_ws_name UNIQUE (workspace_id, name)
);
CREATE INDEX IF NOT EXISTS idx_tag_workspace ON todo.tag(workspace_id);

CREATE TABLE IF NOT EXISTS todo.todo_tag (
    id      BIGSERIAL PRIMARY KEY,
    todo_id BIGINT NOT NULL REFERENCES todo.todo(id) ON DELETE CASCADE,
    tag_id  BIGINT NOT NULL REFERENCES todo.tag(id)  ON DELETE CASCADE,
    CONSTRAINT uk_todo_tag UNIQUE (todo_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_todo_tag_todo ON todo.todo_tag(todo_id);
CREATE INDEX IF NOT EXISTS idx_todo_tag_tag  ON todo.todo_tag(tag_id);
