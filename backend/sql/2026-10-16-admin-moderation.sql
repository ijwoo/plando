-- 신고·차단·운영자 조치(백오피스) 스키마.
--
-- 왜 필요한가:
--   모집글·Q&A·프로필은 모르는 사람에게도 보이는 사용자 콘텐츠인데, 지금은 신고도 차단도
--   운영자가 조치할 수단도 없다. 문제가 생기면 서버에 붙어 SQL 로 직접 지우는 수밖에 없었다.
--   App Store 심사 지침 1.2(사용자 생성 콘텐츠)도 신고·차단·운영자 조치를 요구한다.
--
-- 들어가는 것:
--   users                 system_role(USER/ADMIN), 계정 정지, 관리자 2단계 인증(TOTP)
--   recruitment.hidden_at 운영자가 숨긴 모집글 (Q&A 는 기존 is_hidden 을 그대로 쓴다)
--   content_reports       신고. 같은 사람이 같은 대상을 두 번 신고할 수 없다
--   user_blocks           차단. 차단한 사람의 콘텐츠를 내 화면에서 뺀다
--   admin_audit_logs      운영자가 한 모든 조치. 지우지 않는다
--
-- 관리자 지정은 API 로 열지 않는다 — 이 스크립트 아래 주석처럼 psql 로 직접 한다.
--
-- 멱등: 여러 번 돌려도 같다.
-- prod 는 ddl-auto=validate 라 **반드시 jar 배포 전에** 적용해야 한다.

ALTER TABLE todo.users ADD COLUMN IF NOT EXISTS system_role VARCHAR(20) NOT NULL DEFAULT 'USER';
ALTER TABLE todo.users ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP;
ALTER TABLE todo.users ADD COLUMN IF NOT EXISTS suspended_reason VARCHAR(500);
ALTER TABLE todo.users ADD COLUMN IF NOT EXISTS admin_totp_secret VARCHAR(64);
ALTER TABLE todo.users ADD COLUMN IF NOT EXISTS admin_totp_enabled_at TIMESTAMP;
ALTER TABLE todo.users ADD COLUMN IF NOT EXISTS admin_totp_last_step BIGINT;

ALTER TABLE todo.recruitment ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMP;

CREATE TABLE IF NOT EXISTS todo.content_reports (
    id              BIGSERIAL PRIMARY KEY,
    reporter_id     BIGINT       NOT NULL REFERENCES todo.users(id),
    target_type     VARCHAR(20)  NOT NULL,
    target_id       BIGINT       NOT NULL,
    target_user_id  BIGINT       REFERENCES todo.users(id),
    reason          VARCHAR(20)  NOT NULL,
    detail          VARCHAR(500),
    status          VARCHAR(20)  NOT NULL DEFAULT 'OPEN',
    created_at      TIMESTAMP    NOT NULL,
    handled_by      BIGINT       REFERENCES todo.users(id),
    handled_at      TIMESTAMP,
    resolution      VARCHAR(20),
    resolution_note VARCHAR(500),
    CONSTRAINT uk_report_reporter_target UNIQUE (reporter_id, target_type, target_id)
);
CREATE INDEX IF NOT EXISTS idx_report_status_created ON todo.content_reports (status, created_at);
CREATE INDEX IF NOT EXISTS idx_report_target ON todo.content_reports (target_type, target_id);

CREATE TABLE IF NOT EXISTS todo.user_blocks (
    id          BIGSERIAL PRIMARY KEY,
    blocker_id  BIGINT    NOT NULL REFERENCES todo.users(id),
    blocked_id  BIGINT    NOT NULL REFERENCES todo.users(id),
    created_at  TIMESTAMP NOT NULL,
    CONSTRAINT uk_block_pair UNIQUE (blocker_id, blocked_id)
);

CREATE TABLE IF NOT EXISTS todo.admin_audit_logs (
    id           BIGSERIAL PRIMARY KEY,
    admin_id     BIGINT       NOT NULL REFERENCES todo.users(id),
    action       VARCHAR(40)  NOT NULL,
    target_type  VARCHAR(20),
    target_id    BIGINT,
    reason       VARCHAR(500),
    ip           VARCHAR(64),
    created_at   TIMESTAMP    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON todo.admin_audit_logs (created_at);

-- 관리자 지정 (한 번만, 직접):
--   UPDATE todo.users SET system_role = 'ADMIN' WHERE email = '<내 이메일>';
-- 그 뒤 웹 /#/admin 에서 OTP 앱 등록을 마쳐야 관리자 API 가 열린다.

SELECT count(*) AS reports FROM todo.content_reports;
SELECT count(*) AS admins FROM todo.users WHERE system_role = 'ADMIN';
