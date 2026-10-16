package com.example.todo.config;

import com.example.todo.entity.Todo;
import com.example.todo.entity.TodoFocus;
import com.example.todo.entity.User;
import com.example.todo.repository.TodoFocusRepository;
import com.example.todo.repository.TodoRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 부팅 시 1회 실행. legacy 워크스페이스-공유 {@code Todo.focused=true} 데이터를
 * per-user {@link TodoFocus} 로 이관한다.
 *
 * 정책 (사용자 결정): focused=true 인 todo의 작성자(createdBy)에게만 포커스가 남는다.
 * 처리 후 해당 todo의 legacy boolean을 false로 reset하므로 idempotent — 다음 부팅 때는 즉시 종료.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class FocusMigrationRunner implements ApplicationRunner {

    private final TodoRepository todoRepository;
    private final TodoFocusRepository todoFocusRepository;

    @Override
    @Transactional
    @SuppressWarnings("deprecation")
    public void run(ApplicationArguments args) {
        List<Todo> legacyFocused = todoRepository.findByFocusedTrue();
        if (legacyFocused.isEmpty()) {
            return;
        }

        int migrated = 0;
        int skippedNoOwner = 0;
        int skippedAlreadyExists = 0;
        for (Todo t : legacyFocused) {
            User owner = t.getCreatedBy();
            if (owner == null) {
                skippedNoOwner++;
            } else if (todoFocusRepository.existsByUserIdAndTodoId(owner.getId(), t.getId())) {
                skippedAlreadyExists++;
            } else {
                todoFocusRepository.save(TodoFocus.builder()
                        .userId(owner.getId())
                        .todoId(t.getId())
                        .build());
                migrated++;
            }
            // 마이그레이션 마커 reset — 다음 부팅 때 다시 처리하지 않도록
            t.setFocused(false);
        }
        todoRepository.saveAll(legacyFocused);

        log.info("[FocusMigration] processed={} migrated={} skippedNoOwner={} skippedAlreadyExists={}",
                legacyFocused.size(), migrated, skippedNoOwner, skippedAlreadyExists);
    }
}
