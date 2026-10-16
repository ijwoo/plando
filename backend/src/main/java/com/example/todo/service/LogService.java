package com.example.todo.service;

import com.example.todo.dto.TodoLogResponseDto;
import com.example.todo.dto.UserDto;
import com.example.todo.entity.Project;
import com.example.todo.entity.TodoLog;
import com.example.todo.entity.User;
import com.example.todo.repository.LogRepository;
import com.example.todo.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class LogService {

    private final LogRepository logRepository;
    private final UserRepository userRepository;

    public void saveLog(Long todoId, String field, String beforeValue, String afterValue, String modifier) {
        if (beforeValue == null) beforeValue = "";
        if (afterValue == null) afterValue = "";
        if (beforeValue.equals(afterValue)) return;

        TodoLog log = TodoLog.builder()
                .todoId(todoId)
                .field(field)
                .beforeValue(beforeValue)
                .afterValue(afterValue)
                .modifier(modifier)
                .modifiedAt(LocalDateTime.now())
                .build();

        logRepository.save(log);
    }

    /**
     * Todo의 활동 로그를 사용자 표시 이름/프로필 이미지와 함께 반환.
     * modifier(email)만 들고 있던 응답을 프론트가 별도 lookup 없이 렌더 가능한 형태로 enrich.
     * 사용자 조회는 distinct email 한 번의 findByEmailIn 호출로 N+1 방지.
     */
    public List<TodoLogResponseDto> getLogsForTodo(Long todoId) {
        return enrich(logRepository.findByTodoIdOrderByModifiedAtDesc(todoId));
    }

    /**
     * 프로젝트 소속 할 일들의 최근 활동 로그 (개요 활동 피드).
     * 할 일별 로그를 프로젝트 단위로 모아 표시 이름/프로필과 함께 반환.
     */
    public List<TodoLogResponseDto> getRecentForProject(Project project, int limit) {
        return enrich(logRepository.findRecentByProject(project, PageRequest.of(0, limit)));
    }

    /** TodoLog 목록을 표시 이름/프로필 이미지로 enrich (사용자 조회 1회로 N+1 방지). */
    private List<TodoLogResponseDto> enrich(List<TodoLog> logs) {
        if (logs.isEmpty()) return List.of();

        List<String> emails = logs.stream()
                .map(TodoLog::getModifier)
                .filter(e -> e != null && !e.isBlank())
                .distinct()
                .toList();

        Map<String, UserDto> userByEmail = emails.isEmpty() ? Map.of() :
                userRepository.findByEmailIn(emails).stream()
                        .collect(Collectors.toMap(
                                User::getEmail,
                                u -> new UserDto(u.getEmail(), u.getName(), u.getProfileImageUrl()),
                                (a, b) -> a
                        ));

        return logs.stream()
                .map(log -> TodoLogResponseDto.from(log, userByEmail.get(log.getModifier())))
                .toList();
    }
}
