-- RBAC: WorkspaceRole 2역할(OWNER/MEMBER) → 4역할(OWNER/ADMIN/MEMBER/VIEWER) 확장.
-- @Enumerated(STRING) 컬럼은 Hibernate가 CHECK 제약을 자동 생성했을 수 있는데,
-- 그 제약이 옛 값(OWNER/MEMBER)만 허용하면 ADMIN/VIEWER INSERT/UPDATE가 실패한다.
-- 따라서 배포 전(jar 교체 전)에 반드시 이 SQL을 적용해 제약을 4역할로 갱신한다.
-- 멱등: DROP IF EXISTS 후 재생성. 데이터 변경 없음(기존 OWNER/MEMBER 문자열 그대로 유효).
--
-- 확인:
--   SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conrelid='todo.workspace_member'::regclass AND contype='c';

ALTER TABLE todo.workspace_member
    DROP CONSTRAINT IF EXISTS workspace_member_role_check;

ALTER TABLE todo.workspace_member
    ADD CONSTRAINT workspace_member_role_check
    CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER'));
