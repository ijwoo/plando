package com.example.todo.service;

import com.example.todo.repository.CommentRepository;
import com.example.todo.repository.DmMessageRepository;
import com.example.todo.repository.LocationTriggerRepository;
import com.example.todo.repository.TodoChecklistRepository;
import com.example.todo.repository.TodoRecurrenceRepository;
import com.example.todo.repository.TodoRepository;
import com.example.todo.util.GuestUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 게스트 계정이 생성한 데이터를 매일 새벽 4시에 정리합니다.
 * - isSample=false 인 Todo (생성 후 24시간 초과)
 * - 게스트가 작성한 Comment (24시간 초과)
 * - 게스트가 보낸 DmMessage (24시간 초과)
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class GuestCleanupScheduler {

    private static final List<String> GUEST_EMAILS = GuestUtils.GUEST_EMAILS_LIST;

    private final TodoRepository todoRepository;
    private final CommentRepository commentRepository;
    private final DmMessageRepository dmMessageRepository;
    private final LocationTriggerRepository locationTriggerRepository;
    private final TodoChecklistRepository checklistRepository;
    private final TodoRecurrenceRepository recurrenceRepository;

    @Scheduled(cron = "0 0 4 * * *")
    @Transactional
    public void cleanupGuestData() {
        LocalDateTime threshold = LocalDateTime.now().minusHours(24);

        List<Long> todoIds = todoRepository.findGuestTodoIdsOlderThan(GUEST_EMAILS, threshold);

        if (!todoIds.isEmpty()) {
            // FK 제약이 있는 연관 테이블을 먼저 삭제 (의존 역방향 순서)
            locationTriggerRepository.deleteAllByTodoIdIn(todoIds);
            checklistRepository.deleteByTodoIdIn(todoIds);
            recurrenceRepository.deleteBySourceTodoIdIn(todoIds);
            todoRepository.deleteAssigneesByTodoIds(todoIds);
            todoRepository.deleteGuestTodosByIds(todoIds);
            log.info("[GuestCleanupScheduler] 게스트 Todo {} 건 삭제 완료", todoIds.size());
        }

        commentRepository.deleteGuestCommentsOlderThan(GUEST_EMAILS, threshold);
        dmMessageRepository.deleteGuestMessagesOlderThan(GUEST_EMAILS, threshold);

        log.info("[GuestCleanupScheduler] 게스트 데이터 정리 완료 (기준: {})", threshold);
    }
}
