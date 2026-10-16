-- 사용자 마지막 활동 시각 — DM 헤더의 "N일 전 활동" 등 프레즌스 표시용.
--
-- 왜 필요한가:
--   지금은 그 문구를 "파트너가 DM을 마지막으로 보낸 시각"으로 계산한다(DmService.getPartnerProfile).
--   그래서 상대가 앱을 쓰면서 할 일을 만들고 내 메시지를 읽고 있어도, DM만 안 보내면
--   계속 "N일 전 활동"으로 보인다 — 라벨은 '활동'인데 실제로는 'DM 발신'만 재고 있었다.
--   PresenceService는 실제 접속을 알지만 **메모리 기반**이라 재기동하면 사라진다.
--   그래서 영속 컬럼이 필요하다.
--
-- 채우는 주체: 인증된 API 요청이 올 때 서버가 갱신(과도한 UPDATE를 막기 위해 분 단위로 스로틀).
-- 초기값은 NULL — "활동 기록 없음"으로 취급하고, 클라이언트는 문구를 숨긴다.
--
-- 멱등: 컬럼이 이미 있으면 아무것도 하지 않는다. prod는 ddl-auto=validate라
--       반드시 jar 배포 **전에** 적용해야 한다.

BEGIN;

ALTER TABLE todo.users
    ADD COLUMN IF NOT EXISTS last_active_at timestamp;

-- 조회는 "이 사용자의 값" 단건이라 인덱스는 불필요(PK로 찾는다).
-- 대시보드에서 워크스페이스 멤버를 훑을 때도 멤버 수가 적어 순차 스캔으로 충분하다.

-- 검증
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'todo' AND table_name = 'users' AND column_name = 'last_active_at';

COMMIT;
