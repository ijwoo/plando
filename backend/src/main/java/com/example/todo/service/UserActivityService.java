package com.example.todo.service;

import com.example.todo.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 사용자 마지막 활동 시각(users.last_active_at) 갱신.
 *
 * 왜 필요한가: DM 헤더의 "N일 전 활동"이 예전엔 파트너가 **DM을 마지막으로 보낸 시각**이었다.
 * 그래서 상대가 앱을 쓰며 할 일을 만들고 내 메시지를 읽고 있어도, DM만 안 보내면 계속
 * 오래된 값이 떴다. PresenceService는 실제 접속을 알지만 메모리 기반이라 재기동 시 사라진다.
 *
 * 스로틀: 요청마다 UPDATE를 날리면 모든 API 호출이 쓰기 트랜잭션을 하나씩 더 갖게 된다.
 * 같은 사용자는 THROTTLE 간격 안에서 한 번만 기록한다(정밀도는 분 단위면 충분하다 —
 * 이 값의 소비처가 "N분/시간/일 전" 표시라 초 단위 정확도가 필요 없다).
 *
 * 메모리 맵은 인스턴스 로컬이다. 다중 인스턴스가 되면 각자 스로틀하므로 쓰기가 인스턴스 수만큼
 * 늘지만, 정확성 문제는 없다(마지막 값이 이긴다).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserActivityService {

    private static final Duration THROTTLE = Duration.ofMinutes(3);

    private final UserRepository userRepository;

    /** email → 마지막으로 DB에 기록한 시각 */
    private final Map<String, Instant> lastWritten = new ConcurrentHashMap<>();

    /**
     * 활동 기록. 실패해도 본 요청에 영향을 주지 않는다 —
     * 표시용 값 하나 때문에 API가 실패하면 안 된다.
     *
     * REQUIRES_NEW: 호출자(조회 요청)의 트랜잭션에 쓰기를 끼워 넣지 않는다.
     * 읽기 전용 트랜잭션 안에서 호출될 수 있고, 이 갱신이 실패해도 본 작업은 커밋돼야 한다.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void touch(String email) {
        if (email == null || email.isBlank()) return;
        Instant now = Instant.now();
        Instant prev = lastWritten.get(email);
        if (prev != null && Duration.between(prev, now).compareTo(THROTTLE) < 0) return;

        // 먼저 표시해 두어 동시 요청이 중복 UPDATE 하지 않게 한다
        lastWritten.put(email, now);
        try {
            userRepository.touchLastActive(email, java.time.LocalDateTime.now());
        } catch (Exception e) {
            lastWritten.remove(email); // 실패했으면 다음 요청에서 다시 시도
            log.debug("[activity] last_active_at 갱신 실패 email={} err={}", email, e.getMessage());
        }
    }
}
