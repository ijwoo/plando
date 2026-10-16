-- 진행 방식(meet_type) 어휘 정규화.
--
-- 운영 5건이 전부 비정규 값이었다("OFFLINE" 3건, "hybrid" 2건). buildProcessTags 의 switch 는
-- online/offline/mixed 만 받으므로 상세의 "진행 방식" 태그가 한 건도 나가지 않고 있었다.
--
-- 앞으로 들어오는 값은 Recruitment.normalizeMeetType 이 저장 시점에 맞추고, 읽기 경로에서도
-- 한 번 더 통과시키므로 이 스크립트를 돌리지 않아도 화면은 정상이다. 여기서는 저장된 값 자체를
-- 정리해 DB 를 직접 들여다볼 때 헷갈리지 않게 한다.
UPDATE todo.recruitment SET meet_type = 'offline' WHERE lower(meet_type) = 'offline' AND meet_type <> 'offline';
UPDATE todo.recruitment SET meet_type = 'online'  WHERE lower(meet_type) = 'online'  AND meet_type <> 'online';
UPDATE todo.recruitment SET meet_type = 'mixed'   WHERE lower(meet_type) IN ('mixed', 'hybrid') AND meet_type <> 'mixed';

SELECT coalesce(meet_type, '(null)') AS v, count(*) FROM todo.recruitment GROUP BY 1 ORDER BY 2 DESC;
