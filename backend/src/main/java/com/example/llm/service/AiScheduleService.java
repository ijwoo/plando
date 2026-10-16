package com.example.llm.service;

import com.example.llm.agent.AgentResolver;
import com.example.llm.agent.AgentSpec;
import com.example.todo.entity.AiSchedule;
import com.example.todo.exception.ApiException;
import com.example.todo.repository.AiScheduleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * 예약 실행 관리 — 만들고 고치고 지운다.
 *
 * 검사는 **만들 때와 돌 때 양쪽**에서 한다. 역할의 도구 목록은 나중에 바뀔 수 있어서,
 * 만들 때 조회 전용이었다는 사실이 실행 시점까지 유효하다는 보장이 없다.
 */
@Service
@RequiredArgsConstructor
public class AiScheduleService {

    /**
     * 한 사람이 한 워크스페이스에서 걸 수 있는 최대 개수.
     * 예약 하나가 매일 하루 사용량(60회)을 한두 번씩 먹는다. 상한이 없으면 예약만으로
     * 하루치를 다 쓰고 정작 직접 물어볼 때 막힌다.
     */
    private static final int MAX_PER_USER = 5;

    private static final int MAX_PROMPT = 300;

    private final AiScheduleRepository repository;
    private final AgentResolver agentResolver;

    @Transactional(readOnly = true)
    public List<AiSchedule> list(Long workspaceId, String userEmail) {
        return repository.findByWorkspaceIdAndUserEmailOrderByRunHourAscRunMinuteAsc(workspaceId, userEmail);
    }

    @Transactional
    public AiSchedule create(Long workspaceId, String userEmail,
                             String agentId, String prompt, int hour, int minute,
                             String days, boolean enabled) {
        if (repository.countByWorkspaceIdAndUserEmail(workspaceId, userEmail) >= MAX_PER_USER) {
            throw new ApiException(400, "예약은 " + MAX_PER_USER + "개까지 만들 수 있어요.");
        }
        AiSchedule s = new AiSchedule(workspaceId, userEmail);
        s.apply(requireReadOnlyAgent(workspaceId, agentId), validPrompt(prompt),
                validHour(hour), validMinute(minute), validDays(days), enabled);
        return repository.save(s);
    }

    @Transactional
    public AiSchedule update(Long id, Long workspaceId, String userEmail,
                             String agentId, String prompt, int hour, int minute,
                             String days, boolean enabled) {
        AiSchedule s = repository.findByIdAndWorkspaceIdAndUserEmail(id, workspaceId, userEmail)
                .orElseThrow(() -> new ApiException(404, "예약을 찾을 수 없어요."));
        s.apply(requireReadOnlyAgent(workspaceId, agentId), validPrompt(prompt),
                validHour(hour), validMinute(minute), validDays(days), enabled);
        return s;
    }

    @Transactional
    public void delete(Long id, Long workspaceId, String userEmail) {
        AiSchedule s = repository.findByIdAndWorkspaceIdAndUserEmail(id, workspaceId, userEmail)
                .orElseThrow(() -> new ApiException(404, "예약을 찾을 수 없어요."));
        repository.delete(s);
    }

    /**
     * 예약에 걸 수 있는 역할인가.
     *
     * 조회 전용만 허용한다. 사람이 없는 사이 데이터가 바뀌면, 아침에 열었을 때 마감이
     * 옮겨져 있고 누가 한 건지 알 수 없다. 예약은 알려주기만 한다.
     *
     * 도구 제한이 없는 역할(기본)도 막는다 — readOnly() 는 "제한이 있고 그 안에 변경
     * 도구가 없을 때" 만 참이다. 제한 없는 역할은 무엇이든 할 수 있으므로 예약 대상이 아니다.
     */
    private String requireReadOnlyAgent(Long workspaceId, String agentId) {
        AgentSpec spec = findAgent(workspaceId, agentId);
        if (spec == null) {
            throw new ApiException(400, "역할을 찾을 수 없어요.");
        }
        if (!spec.readOnly()) {
            /* 이름 뒤에 조사를 붙이지 않는다. 역할 이름은 사용자가 짓는 자유 문자열이라
               받침을 알 수 없고, "'정리 도우미' 은(는)" 처럼 괄호를 내보내면 기계가 쓴 글로
               읽힌다. 뒤에 고정된 명사("역할은")를 두면 조사 문제 자체가 없어진다. */
            throw new ApiException(400,
                    "예약에는 조회만 하는 역할만 걸 수 있어요. '" + spec.name() + "' 역할은 데이터를 바꿀 수 있어요.");
        }
        return spec.id();
    }

    /** 워크스페이스 목록에서 찾는다 — ThreadLocal(WorkspaceHolder)에 기대지 않는다(크론에서도 부른다). */
    public AgentSpec findAgent(Long workspaceId, String agentId) {
        if (agentId == null || agentId.isBlank()) return null;
        return agentResolver.listFor(workspaceId).stream()
                .filter(a -> a.id().equals(agentId))
                .findFirst()
                .orElse(null);
    }

    private static String validPrompt(String prompt) {
        String p = prompt == null ? "" : prompt.trim();
        if (p.isEmpty()) throw new ApiException(400, "무엇을 물어볼지 적어주세요.");
        return p.length() > MAX_PROMPT ? p.substring(0, MAX_PROMPT) : p;
    }

    private static int validHour(int hour) {
        if (hour < 0 || hour > 23) throw new ApiException(400, "시각이 올바르지 않아요.");
        return hour;
    }

    private static int validMinute(int minute) {
        if (minute < 0 || minute > 59) throw new ApiException(400, "시각이 올바르지 않아요.");
        return minute;
    }

    /**
     * 요일 목록 정리.
     * 모르는 값은 버린다 — 남겨두면 영원히 안 도는 예약이 되고, 사용자는 왜 안 오는지 모른다.
     * 남는 게 없으면 매일로 본다.
     */
    private static String validDays(String days) {
        if (days == null || days.isBlank() || AiSchedule.DAILY.equalsIgnoreCase(days.trim())) {
            return AiSchedule.DAILY;
        }
        Set<String> valid = new LinkedHashSet<>();
        for (DayOfWeek d : DayOfWeek.values()) valid.add(d.name().substring(0, 3));

        Set<String> picked = new LinkedHashSet<>();
        for (String part : days.split(",")) {
            String token = part.trim().toUpperCase(Locale.ROOT);
            if (valid.contains(token)) picked.add(token);
        }
        if (picked.isEmpty() || picked.size() == 7) return AiSchedule.DAILY;
        // 저장 순서를 요일 순으로 고정한다 — 화면이 정렬을 따로 하지 않아도 되게
        return valid.stream().filter(picked::contains).reduce((a, b) -> a + "," + b).orElse(AiSchedule.DAILY);
    }
}
