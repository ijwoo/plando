package com.example.todo.service;

import com.example.todo.entity.Todo;
import com.example.todo.entity.TodoChecklist;
import com.example.todo.entity.TodoRecurrence;
import com.example.todo.repository.TodoChecklistRepository;
import com.example.todo.repository.TodoRecurrenceRepository;
import com.example.todo.repository.TodoRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class TodoRecurrenceScheduler {

    private final TodoRecurrenceRepository recurrenceRepository;
    private final TodoRepository todoRepository;
    private final TodoChecklistRepository checklistRepository;

    @Scheduled(cron = "0 0 0 * * *")  // 매일 자정
    @Transactional
    public void generateRecurringTodos() {
        LocalDate today = LocalDate.now();
        List<TodoRecurrence> activeRules = recurrenceRepository.findActiveForDate(today);
        int generated = 0;
        for (TodoRecurrence r : activeRules) {
            try {
                if (r.getLastGeneratedDate() == null) {
                    log.warn("반복 규칙 id={} lastGeneratedDate가 null — 건너뜀", r.getId());
                    continue;
                }
                boolean shouldGenerate = switch (r.getRecurrenceType()) {
                    case DAILY -> true;
                    case WEEKLY -> !r.getLastGeneratedDate().plusWeeks(1).isAfter(today);
                    case MONTHLY -> !r.getLastGeneratedDate().plusMonths(1).isAfter(today);
                };

                if (!shouldGenerate) continue;

                todoRepository.findById(r.getSourceTodoId()).ifPresent(source -> {
                // 날짜 계산: 오늘 기준으로 원본의 기간 오프셋을 유지
                LocalDate newStartAt = null;
                LocalDate newDueDate = null;
                if (source.getStartAt() != null && source.getDueDate() != null) {
                    long duration = ChronoUnit.DAYS.between(source.getStartAt(), source.getDueDate());
                    newStartAt = today;
                    newDueDate = today.plusDays(duration);
                } else if (source.getDueDate() != null) {
                    newDueDate = today;
                } else if (source.getStartAt() != null) {
                    newStartAt = today;
                }

                Todo newTodo = Todo.builder()
                        .title(source.getTitle())
                        .content(source.getContent())
                        .priority(source.getPriority())
                        .status("TODO")
                        .workspace(source.getWorkspace())
                        .createdBy(source.getCreatedBy())
                        .assignees(new ArrayList<>(source.getAssignees()))
                        .startAt(newStartAt)
                        .dueDate(newDueDate)
                        .startTime(source.getStartTime())
                        .endTime(source.getEndTime())
                        .isSample(Boolean.TRUE.equals(source.getIsSample()))
                        .recurrenceSourceId(r.getId())
                        .build();

                Todo saved = todoRepository.save(newTodo);

                // 서브태스크(체크리스트) 복사 — checked는 초기화
                List<TodoChecklist> sourceChecklists =
                        checklistRepository.findByTodoIdOrderByOrderIndex(source.getId());
                if (!sourceChecklists.isEmpty()) {
                    List<TodoChecklist> newChecklists = sourceChecklists.stream()
                            .map(item -> TodoChecklist.builder()
                                    .todoId(saved.getId())
                                    .content(item.getContent())
                                    .checked(false)
                                    .orderIndex(item.getOrderIndex())
                                    .build())
                            .toList();
                    checklistRepository.saveAll(newChecklists);
                }

                r.setLastGeneratedDate(today);
                recurrenceRepository.save(r);
                log.info("반복 할 일 생성: sourceId={}, type={}, newId={}, assignees={}, checklists={}",
                        r.getSourceTodoId(), r.getRecurrenceType(), saved.getId(),
                        source.getAssignees().size(), sourceChecklists.size());
            });
                generated++;
            } catch (Exception e) {
                log.warn("반복 규칙 id={} 처리 실패: {}", r.getId(), e.getMessage());
            }
        }
        log.info("[RecurrenceScheduler] {}/{} 건 반복 할 일 생성 완료", generated, activeRules.size());
    }
}
