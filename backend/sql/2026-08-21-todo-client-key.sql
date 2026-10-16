-- 오프라인에서 적은 할 일의 중복 방지 열쇠.
--
-- 왜 필요한가: 네트워크가 없을 때 적은 것을 앱이 들고 있다가 복구되면 다시 보낸다.
-- 그런데 **보냈는데 응답만 못 받은 경우**가 있다 — 서버는 이미 만들었고 앱은 실패로 안다.
-- 그대로 재전송하면 같은 할 일이 두 개 생긴다.
--
-- 앱이 만들 때 열쇠를 하나 붙여 보내고, 서버는 같은 열쇠가 이미 있으면 새로 만들지 않고
-- 있던 것을 돌려준다. 재전송이 몇 번을 와도 결과가 같다.
--
-- 워크스페이스 단위 유니크 — 열쇠는 앱이 만드는 값이라 전역 유일을 보장할 수 없고,
-- 보장할 필요도 없다(남의 워크스페이스와 겹쳐도 서로 무관하다).
-- NULL 은 여러 개 허용된다(기존 데이터·열쇠 없이 만든 것) — PostgreSQL 의 유니크는 NULL 을 세지 않는다.
--
-- prod 는 ddl-auto=validate 라 이 스크립트를 먼저 돌려야 부팅된다.

ALTER TABLE todo.todo
    ADD COLUMN IF NOT EXISTS client_key VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS uq_todo_workspace_client_key
    ON todo.todo (workspace_id, client_key)
    WHERE client_key IS NOT NULL;

SELECT count(*) AS todos, count(client_key) AS with_key FROM todo.todo;
