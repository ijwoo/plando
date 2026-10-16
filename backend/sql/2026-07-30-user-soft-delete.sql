-- 회원 탈퇴를 소프트 삭제로 전환.
--
-- 왜 필요한가:
--   지금 deleteAccount 는 users 행을 정말로 DELETE 한다. 그런데 users 를 참조하는
--   외래키가 15개인데 정리하는 건 4개뿐이고, 나머지 11개가 전부 ON DELETE NO ACTION 이라
--   DB가 삭제를 거부한다. 실측: 전체 44명 중 dm_room_members 14명 / dm_messages 11명 /
--   wrap_comment_cache 9명이 이 상태다. 즉 DM 대화방을 한 번 열었거나 주간 회고를 본
--   사람은 탈퇴 자체가 불가능했다.
--   더 나쁜 건 iPhone 앱이 try/finally 로 실패를 삼키고 무조건 로그아웃해서,
--   사용자는 탈퇴된 줄 알지만 계정이 그대로 남아 있었다는 점이다.
--
-- 왜 하드 삭제가 아니라 소프트 삭제인가:
--   dm_messages 는 **상대방의 대화 기록**이다. 내가 탈퇴했다고 상대 대화창에서 내 메시지가
--   통째로 사라지면 상대 입장에서 대화가 찢어진다. 그래서 행은 남기고,
--   식별정보만 지운다(익명화). Apple 심사 지침 5.1.1(v)의 "계정 삭제" 요건도
--   개인정보가 제거되고 로그인이 불가하면 충족된다.
--
-- 익명화 규칙(애플리케이션이 수행):
--   email             → deleted-{id}@deleted.invalid   (UNIQUE 유지 + 수신 불가 도메인)
--   name              → '탈퇴한 사용자'
--   password          → 재사용 불가한 임의값
--   apple_id          → NULL   (같은 Apple 계정으로 재가입 가능해야 하고,
--                              탈퇴 계정에 다시 연결돼선 안 된다)
--   provider_id       → NULL   (소셜 재로그인이 이 행을 되살리지 못하게)
--   kakao_* 토큰      → NULL
--   profile_image_url → NULL
--
-- 멱등: 이미 있으면 아무것도 하지 않는다.
-- prod 는 ddl-auto=validate 라 **반드시 jar 배포 전에** 적용해야 한다.

BEGIN;

ALTER TABLE todo.users
    ADD COLUMN IF NOT EXISTS deleted_at timestamp;

-- 탈퇴자는 조회에서 대부분 제외된다(로그인·멤버 목록 등).
-- 활성 사용자만 빠르게 걸러내기 위한 부분 인덱스.
CREATE INDEX IF NOT EXISTS idx_users_active
    ON todo.users (id) WHERE deleted_at IS NULL;

-- provider CHECK 제약에 APPLE 이 없다(LOCAL/GOOGLE/KAKAO 만 허용).
-- 이번 변경에서 provider 값을 새로 쓰지는 않으므로 건드리지 않는다 — 기록만 남긴다.

-- 검증
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'todo' AND table_name = 'users' AND column_name = 'deleted_at';

SELECT indexname FROM pg_indexes
WHERE schemaname = 'todo' AND tablename = 'users' AND indexname = 'idx_users_active';

-- 적용 후 탈퇴자 수(처음엔 0이어야 한다)
SELECT count(*) AS 탈퇴자수 FROM todo.users WHERE deleted_at IS NOT NULL;

COMMIT;
