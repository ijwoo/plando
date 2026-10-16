package com.example.todo.service;

import com.example.todo.dto.TodoRealtimeEvent;
import com.example.todo.dto.TodoResponseDto;
import com.example.todo.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * 할 일 변경을 워크스페이스 구독자에게 브로드캐스트한다.
 *
 * 왜 필요한가: 지금 할 일 변경은 각 클라이언트의 **자기 탭 안에서만** 전파된다(window 이벤트).
 * 그래서 팀원이 카드를 옮겨도 내 보드는 그대로고, 모르고 다시 옮기면 남의 작업을 덮어쓴다.
 *
 * ── 발행 지점을 여기 한 곳으로 모으는 이유 ──
 * 할 일을 바꾸는 코드가 여러 파일에 흩어져 있다(컨트롤러·AI·스케줄러). 각자 브로드캐스트를
 * 만들면 형식이 갈리고 누락이 생긴다. 이 클래스만 거치게 한다.
 *
 * ── 스케줄러는 발행하지 않는다 ──
 * 반복 인스턴스 생성·자동 보관·게스트 정리는 사용자가 화면을 보고 있는 중에 일어나는 일이
 * 아니다. 다음 조회 때 반영되면 충분하고, 새벽에 수백 건이 브로드캐스트되면 소음이다.
 * 그래서 사용자 행동 경로(컨트롤러·AI)에만 심는다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TodoEventPublisher {

    private final SimpMessagingTemplate messagingTemplate;

    private static String topic(Long workspaceId) {
        return "/topic/workspace/" + workspaceId + "/todos";
    }

    public void added(Long workspaceId, TodoResponseDto todo, User actor) {
        if (workspaceId == null || todo == null) return;
        send(TodoRealtimeEvent.builder()
                .type(TodoRealtimeEvent.Type.ADDED)
                .todoId(todo.getId())
                .workspaceId(workspaceId)
                .todo(todo)
                .actorId(actor == null ? null : actor.getId())
                .actorEmail(actor == null ? null : actor.getEmail())
                .actorName(actor == null ? null : actor.getName())
                .at(LocalDateTime.now())
                .build());
    }

    public void updated(Long workspaceId, Long todoId, Map<String, Object> patch, User actor) {
        if (workspaceId == null || todoId == null || patch == null || patch.isEmpty()) return;
        send(TodoRealtimeEvent.builder()
                .type(TodoRealtimeEvent.Type.UPDATED)
                .todoId(todoId)
                .workspaceId(workspaceId)
                .patch(patch)
                .actorId(actor == null ? null : actor.getId())
                .actorEmail(actor == null ? null : actor.getEmail())
                .actorName(actor == null ? null : actor.getName())
                .at(LocalDateTime.now())
                .build());
    }

    public void deleted(Long workspaceId, Long todoId, User actor) {
        if (workspaceId == null || todoId == null) return;
        send(TodoRealtimeEvent.builder()
                .type(TodoRealtimeEvent.Type.DELETED)
                .todoId(todoId)
                .workspaceId(workspaceId)
                .actorId(actor == null ? null : actor.getId())
                .actorEmail(actor == null ? null : actor.getEmail())
                .actorName(actor == null ? null : actor.getName())
                .at(LocalDateTime.now())
                .build());
    }

    /**
     * 커밋 이후에만 내보낸다. 커밋 전에 보내면 롤백된 변경이 남의 화면에 남는다.
     * 트랜잭션 밖에서 호출되면 즉시 발행한다.
     */
    private void send(TodoRealtimeEvent event) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() { doSend(event); }
            });
        } else {
            doSend(event);
        }
    }

    /** 브로드캐스트 실패가 본 작업을 실패시키면 안 된다 — PresenceService와 같은 방침. */
    private void doSend(TodoRealtimeEvent event) {
        try {
            messagingTemplate.convertAndSend(topic(event.getWorkspaceId()), event);
        } catch (Exception e) {
            log.warn("[todo-rt] 브로드캐스트 실패 ws={} todo={} err={}",
                    event.getWorkspaceId(), event.getTodoId(), e.getMessage());
        }
    }
}
