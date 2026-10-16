package com.example.todo.service;

import com.example.todo.dto.LocationTriggerDto;
import com.example.todo.entity.LocationTrigger;
import com.example.todo.entity.NotificationType;
import com.example.todo.entity.Todo;
import com.example.todo.entity.User;
import com.example.todo.repository.LocationTriggerRepository;
import com.example.todo.repository.TodoRepository;
import com.example.todo.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class LocationTriggerService {

    private final LocationTriggerRepository locationTriggerRepository;
    private final TodoRepository todoRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    /** todoId가 해당 워크스페이스의 할 일인지 — 트리거 경로의 유일한 소유권 검사다. */
    private boolean belongsToWorkspace(Long todoId, Long workspaceId) {
        if (todoId == null || workspaceId == null) return false;
        return todoRepository.findById(todoId)
                .map(t -> t.getWorkspace() != null && workspaceId.equals(t.getWorkspace().getId()))
                .orElse(false);
    }

    /**
     * 특정 todo에 걸려있는 모든 사용자의 트리거를 비활성화.
     * 일정 완료(DONE) 시 호출 — 사용자가 그 장소 가도 알림 안 옴.
     * (DONE → TODO 되돌릴 때 자동 재활성화는 안 함 — 사용자가 직접 켜야 함)
     */
    @Transactional
    public void disableAllForTodo(Long todoId) {
        if (todoId == null) return;
        List<LocationTrigger> triggers = locationTriggerRepository.findAllByTodoId(todoId);
        for (LocationTrigger t : triggers) {
            if (Boolean.TRUE.equals(t.getEnabled())) {
                t.setEnabled(false);
            }
        }
        if (!triggers.isEmpty()) {
            locationTriggerRepository.saveAll(triggers);
        }
    }

    /** 현재 워크스페이스의 트리거 조회 → { todoId: { enabled, radius } } (아카이브된 todo 제외) */
    @Transactional(readOnly = true)
    public Map<Long, LocationTriggerDto.TriggerItem> getTriggers(Long userId, Long workspaceId) {
        List<LocationTrigger> triggers = locationTriggerRepository.findAllByUserIdAndWorkspaceId(userId, workspaceId);
        if (triggers.isEmpty()) return Map.of();

        Set<Long> todoIds = triggers.stream().map(LocationTrigger::getTodoId).collect(Collectors.toSet());
        Set<Long> archivedIds = todoRepository.findAllById(todoIds).stream()
                .filter(t -> Boolean.TRUE.equals(t.getArchived()))
                .map(Todo::getId)
                .collect(Collectors.toSet());

        return triggers.stream()
                .filter(t -> !archivedIds.contains(t.getTodoId()))
                .collect(Collectors.toMap(
                        LocationTrigger::getTodoId,
                        t -> new LocationTriggerDto.TriggerItem(t.getEnabled(), t.getRadius())
                ));
    }

    /**
     * 현재 워크스페이스의 트리거 일괄 저장 (upsert).
     *
     * ⚠️ todoId가 이 워크스페이스의 할 일인지 반드시 확인한다. 예전엔 클라이언트가 보낸 todoId를
     * 그대로 저장해서, 남의 워크스페이스 todoId로 트리거를 만든 뒤 /enter 를 호출하면 그 할 일의
     * 제목과 저장된 장소명/주소가 공격자에게 알림으로 전달됐다(todoId를 훑으면 전수 수집 가능).
     */
    @Transactional
    public Map<Long, LocationTriggerDto.TriggerItem> saveTriggers(Long userId, Long workspaceId, Map<Long, LocationTriggerDto.TriggerItem> triggers) {
        for (Map.Entry<Long, LocationTriggerDto.TriggerItem> entry : triggers.entrySet()) {
            Long todoId = entry.getKey();
            LocationTriggerDto.TriggerItem item = entry.getValue();

            if (!belongsToWorkspace(todoId, workspaceId)) {
                throw new com.example.todo.exception.ApiException(403, "다른 워크스페이스의 작업입니다.");
            }

            LocationTrigger trigger = locationTriggerRepository
                    .findByUserIdAndTodoIdAndWorkspaceId(userId, todoId, workspaceId)
                    .orElse(LocationTrigger.builder()
                            .userId(userId)
                            .todoId(todoId)
                            .workspaceId(workspaceId)
                            .build());

            trigger.setEnabled(item.getEnabled() != null ? item.getEnabled() : false);
            trigger.setRadius(item.getRadius() != null ? item.getRadius() : 200);
            locationTriggerRepository.save(trigger);
        }
        return getTriggers(userId, workspaceId);
    }

    /**
     * 장소 진입 감지 시 호출 — 트리거가 활성화된 경우 푸시 알림 발송
     */
    public void onLocationEnter(Long userId, Long todoId, Long workspaceId) {
        // 트리거 활성화 확인
        locationTriggerRepository.findByUserIdAndTodoIdAndWorkspaceId(userId, todoId, workspaceId)
                .filter(t -> Boolean.TRUE.equals(t.getEnabled()))
                .ifPresent(trigger -> {
                    Todo todo = todoRepository.findById(todoId).orElse(null);
                    User user = userRepository.findById(userId).orElse(null);
                    if (todo == null || user == null || Boolean.TRUE.equals(todo.getArchived())) return;
                    // 과거 데이터로 남아 있는 잘못된 트리거 행 방어 — 워크스페이스가 다르면 발송하지 않는다
                    if (!belongsToWorkspace(todoId, workspaceId)) return;

                    String locationLabel = todo.getLocationName() != null
                            ? todo.getLocationName()
                            : (todo.getLocationAddress() != null ? todo.getLocationAddress() : "등록된 장소");

                    notificationService.createNotification(
                            user.getEmail(),
                            user.getEmail(),
                            NotificationType.LOCATION_ENTER.name(),
                            "📍 " + locationLabel + " 근처에 도착했어요",
                            todo.getTitle(),
                            todoId,
                            workspaceId
                    );
                });
    }
}
