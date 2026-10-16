-- 이메일 인증 도입.
--
-- 정책(제품 결정):
--   · 인증 전에도 **로그인은 된다**. 가입 직후 아무것도 못 하면 이탈이 크다.
--     대신 클라이언트가 상단 배너로 인증을 유도한다.
--   · 대신 **남의 팀에 들어가거나 초대 코드를 다루는 것**은 막는다.
--     확인되지 않은 주소로 타인의 워크스페이스에 진입하는 걸 방지하는 게 이 기능의 실익이다.
--   · 소셜 로그인(카카오·구글·Apple)은 제공자가 이미 이메일을 검증했으므로 **면제**한다
--     (계정 생성 시점에 곧바로 인증 완료로 기록).
--
-- 기존 사용자 처리:
--   현재 44명은 **전원 인증 완료로 둔다**. 이미 쓰고 있는 사람을 갑자기 잠그면 안 된다.
--   그래서 컬럼 추가 직후 기존 행을 모두 채운다(신규 가입자만 NULL 로 시작).
--
-- 토큰을 user_id 로 묶는 이유:
--   password_reset_token 은 email 문자열로 묶여 있어서, 탈퇴로 이메일이 해방되면
--   그 주소로 새로 가입한 **다른 사람**에게 옛 토큰이 적용될 수 있었다(실제 취약점).
--   같은 실수를 반복하지 않도록 이 테이블은 user_id FK 로 묶는다.
--
-- 멱등: 이미 있으면 아무것도 하지 않는다.
-- prod 는 ddl-auto=validate 라 **반드시 jar 배포 전에** 적용해야 한다.

BEGIN;

ALTER TABLE todo.users
    ADD COLUMN IF NOT EXISTS email_verified_at timestamp;

-- 기존 사용자 전원 인증 완료 처리.
-- 컬럼이 방금 추가됐다면 전부 NULL 이므로 이 UPDATE 가 곧 "기존 사용자"를 뜻한다.
-- 두 번 실행해도 이미 채워진 값은 건드리지 않는다(멱등).
UPDATE todo.users
SET email_verified_at = now()
WHERE email_verified_at IS NULL;

CREATE TABLE IF NOT EXISTS todo.email_verification_token (
    id          bigserial PRIMARY KEY,
    user_id     bigint      NOT NULL REFERENCES todo.users (id),
    token       varchar(255) NOT NULL UNIQUE,
    expires_at  timestamp   NOT NULL,
    used        boolean     NOT NULL DEFAULT false,
    created_at  timestamp   NOT NULL DEFAULT now()
);

-- 토큰 조회는 token 단건(UNIQUE 인덱스로 처리됨).
-- 재발송 시 그 사용자의 기존 토큰을 지우므로 user_id 인덱스가 필요하다.
CREATE INDEX IF NOT EXISTS idx_email_verification_user
    ON todo.email_verification_token (user_id);

-- 검증
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'todo' AND table_name = 'users' AND column_name = 'email_verified_at';

SELECT count(*) AS 미인증자수 FROM todo.users WHERE email_verified_at IS NULL;   -- 0 이어야 한다

SELECT table_name FROM information_schema.tables
WHERE table_schema = 'todo' AND table_name = 'email_verification_token';

COMMIT;
