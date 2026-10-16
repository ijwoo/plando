-- 담당자 조인 테이블 중복 방지 — todo_assignees에 유니크 제약이 없어 같은 (todo, user) 행이
-- 중복 삽입될 수 있었다(동시 업데이트 레이스). 기존 중복 정리 후 유니크 제약 추가. 멱등.

-- 1) 기존 중복 제거 (한 행만 남김)
DELETE FROM todo.todo_assignees a
USING todo.todo_assignees b
WHERE a.ctid < b.ctid
  AND a.todo_id = b.todo_id
  AND a.user_id = b.user_id;

-- 2) 유니크 제약 (이미 있으면 skip)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uk_todo_assignees'
    ) THEN
        ALTER TABLE todo.todo_assignees
            ADD CONSTRAINT uk_todo_assignees UNIQUE (todo_id, user_id);
    END IF;
END $$;
