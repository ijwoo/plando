-- DM 알림 백필 — DmService가 알림을 만들 때 workspace_id를 null로 넣어 왔다.
-- 알림함/미읽음 수 조회는 workspace_id = ? 조건이라(NotificationService.getMyNotifications)
-- null 행은 어떤 워크스페이스에서도 매칭되지 않아 푸시만 오고 인앱 목록엔 영영 안 떴다.
-- 코드는 고쳤고, 이미 쌓인 행은 target_id(=DM 방 id)로 방의 워크스페이스를 되찾아 채운다.
--
-- 그리고 그룹 DM 멘션은 타입이 MENTION이라 클라이언트가 target_id를 todoId로 오해해
-- 할 일 상세로 라우팅했다. DM_MENTION 타입을 신설했으므로 과거 행도 같이 옮긴다.
-- (댓글 멘션은 CommentService가 항상 workspace_id를 채우므로 workspace_id IS NULL 조건에 걸리지 않는다.
--  추가로 target_id가 실제 DM 방 id인 것만 고르므로 할 일 멘션이 잘못 바뀔 여지가 없다.)
--
-- 멱등: 이미 채워진 행/이미 바뀐 타입은 조건에서 빠진다. 스키마 변경 없음 → jar 배포 전후 아무 때나 안전.

BEGIN;

-- 0) DRY-RUN — 영향 행 수 확인
SELECT n.type, count(*) AS rows_to_fix
FROM todo.todo_notification n
JOIN todo.dm_rooms r ON r.id = n.target_id
WHERE n.workspace_id IS NULL
  AND n.type IN ('DM_RECEIVED', 'MENTION')
GROUP BY n.type;

-- 1) 그룹 DM 멘션 → DM_MENTION 으로 타입 이동 (워크스페이스 채우기 전에 수행)
UPDATE todo.todo_notification n
SET type = 'DM_MENTION',
    workspace_id = r.workspace_id
FROM todo.dm_rooms r
WHERE r.id = n.target_id
  AND n.workspace_id IS NULL
  AND n.type = 'MENTION';

-- 2) 일반 DM 수신 알림의 workspace_id 백필
UPDATE todo.todo_notification n
SET workspace_id = r.workspace_id
FROM todo.dm_rooms r
WHERE r.id = n.target_id
  AND n.workspace_id IS NULL
  AND n.type = 'DM_RECEIVED';

-- 3) 검증 — 남은 null DM 알림이 0이어야 한다 (방이 삭제된 고아 알림은 제외되므로 0이 아닐 수도 있음)
SELECT count(*) AS remaining_null_dm_notifications
FROM todo.todo_notification n
JOIN todo.dm_rooms r ON r.id = n.target_id
WHERE n.workspace_id IS NULL
  AND n.type IN ('DM_RECEIVED', 'MENTION', 'DM_MENTION');

COMMIT;
