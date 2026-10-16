-- 엔티티와 운영 스키마의 어긋남(드리프트) 정리.
--
-- 왜 필요했나: ddl-auto=validate 는 nullability 와 길이를 검사하지 않는다. 그래서 엔티티가
-- @Column(nullable=false) 라고 선언해도 운영 컬럼이 nullable 이면 아무도 모른 채 통과했다.
-- 실제로 10개 컬럼이 어긋나 있었고, 그중 3개는 **반대 방향**(엔티티는 null 허용인데 운영은
-- NOT NULL)이라 "테스트는 통과하는데 운영에서만 500" 이 나는 조합이었다.
--
-- 이 파일은 운영을 조이는 쪽 4건만 담는다. 나머지 6건은 엔티티를 운영에 맞춰 해결했다
-- (코드 변경이라 마이그레이션 불필요).
--
-- 적용 완료: 2026-08-01. 백필 8건 후 실행, 적용 뒤 생성·조회 정상 확인.
-- 재실행 안전: 이미 NOT NULL 이면 PostgreSQL 이 아무 일도 하지 않는다.

-- priority 는 실제로 null 이 8건 있었다. 코드에도 기본값(MEDIUM)을 넣어 더는 늘지 않는다.
UPDATE todo.todo SET priority = 'MEDIUM' WHERE priority IS NULL;

ALTER TABLE todo.todo ALTER COLUMN priority  SET NOT NULL;
ALTER TABLE todo.todo ALTER COLUMN status    SET NOT NULL;
ALTER TABLE todo.todo ALTER COLUMN title     SET NOT NULL;
ALTER TABLE todo.todo ALTER COLUMN is_sample SET NOT NULL;
