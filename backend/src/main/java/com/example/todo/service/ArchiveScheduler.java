package com.example.todo.service;

import com.example.todo.entity.Todo;
import com.example.todo.entity.User;
import com.example.todo.repository.LocationTriggerRepository;
import com.example.todo.repository.TodoRepository;
import com.example.todo.repository.UserSettingsRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 완료된 할일을 매일 새벽 3시에 자동 아카이브.
 *
 * 아카이브 기간은 "할 일 생성자(createdBy)"의 설정(autoArchiveDays)을 따른다.
 * 공유 워크스페이스의 할 일은 한 사람의 개인 설정으로 모두의 보기 상태가 바뀌므로,
 * 생성자 기준을 단일 정책으로 삼는다. (0 = 안 함, 미설정 = 기본 30일)
 * 즉시 정리하려면 수동 아카이브(`POST /api/todos/archive-done`) 사용.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ArchiveScheduler {

    private static final int DEFAULT_ARCHIVE_DAYS = 30;
    // 후보 조회 하한 — 활성화 가능한 가장 짧은 기간(7일). 이보다 최근 완료건은 누구도 보관 안 함.
    private static final int MIN_ENABLED_DAYS = 7;

    private final TodoRepository todoRepository;
    private final LocationTriggerRepository locationTriggerRepository;
    private final UserSettingsRepository userSettingsRepository;

    @Scheduled(cron = "0 0 3 * * *")
    @Transactional
    public void autoArchiveDoneTodos() {
        LocalDateTime now = LocalDateTime.now();
        // 가장 짧은 활성 기간(7일)보다 오래된 완료건만 후보로 (그보다 최근 건은 어떤 설정으로도 보관 안 됨)
        List<Todo> candidates = todoRepository
                .findByArchivedFalseAndDoneAtBefore(now.minusDays(MIN_ENABLED_DAYS));

        if (candidates.isEmpty()) return;

        int archived = 0;
        for (Todo t : candidates) {
            try {
                if (t.getDoneAt() == null) continue;

                int days = resolveArchiveDays(t.getCreatedBy());
                if (days <= 0) continue; // 안 함
                if (t.getDoneAt().isAfter(now.minusDays(days))) continue; // 아직 기간 미도달

                t.setArchived(true);
                todoRepository.save(t);
                locationTriggerRepository.deleteAllByTodoId(t.getId());
                archived++;
            } catch (Exception e) {
                log.warn("[ArchiveScheduler] todoId={} 아카이브 실패: {}", t.getId(), e.getMessage());
            }
        }
        log.info("[ArchiveScheduler] {}/{} 건 자동 아카이브 완료", archived, candidates.size());
    }

    /** 생성자의 자동 보관 기간(일). 생성자/설정 없으면 기본 30일. */
    private int resolveArchiveDays(User creator) {
        if (creator == null) return DEFAULT_ARCHIVE_DAYS;
        return userSettingsRepository.findByUserId(creator.getId())
                .map(s -> s.getAutoArchiveDays() != null ? s.getAutoArchiveDays() : DEFAULT_ARCHIVE_DAYS)
                .orElse(DEFAULT_ARCHIVE_DAYS);
    }
}
