package com.example.llm.service;

import com.example.todo.entity.AiUsageDaily;
import com.example.todo.entity.User;
import com.example.todo.repository.AiUsageDailyRepository;
import com.example.todo.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;

/**
 * 사용자별 하루 AI 사용량 제한.
 *
 * **왜 필요한가:** 이 서비스는 무료이고 AI 비용은 전부 운영자 주머니에서 나간다. 게다가
 * 다단계 루프가 생겨 요청 하나가 LLM 을 최대 5번 부른다. 상한이 없으면 잘 될수록 손해가 커진다.
 *
 * **왜 남은 횟수를 알려주는가:** 상한에 걸렸는데 그냥 안 되면 사용자는 고장으로 받아들인다.
 * 얼마나 썼는지 미리 보이면 아껴 쓰고, 걸렸을 때도 이유를 안다.
 */
@Service
@RequiredArgsConstructor
public class AiUsageLimiter {

    private static final Logger log = LoggerFactory.getLogger(AiUsageLimiter.class);
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private final AiUsageDailyRepository usageRepository;
    private final UserRepository userRepository;

    /** 0 이하면 제한 없음 — 개발 환경이나 임시 해제용. */
    @Value("${ai.daily-limit:60}")
    private int dailyLimit;

    public int dailyLimit() {
        return dailyLimit;
    }

    public record Usage(int used, int limit, boolean exceeded) {
        public int remaining() {
            return limit <= 0 ? Integer.MAX_VALUE : Math.max(0, limit - used);
        }
    }

    /** 지금까지 쓴 양. 화면에 "N/M" 을 그리는 데 쓴다. */
    @Transactional(readOnly = true)
    public Usage peek(String userEmail) {
        Long userId = userIdOf(userEmail);
        if (userId == null || dailyLimit <= 0) return new Usage(0, dailyLimit, false);
        int used = usageRepository.findByUserIdAndUsageDate(userId, today())
                .map(AiUsageDaily::getLlmCalls).orElse(0);
        return new Usage(used, dailyLimit, used >= dailyLimit);
    }

    /**
     * LLM 을 한 번 부를 자격이 있는지 확인하고, 있으면 사용량을 올린다.
     *
     * 별도 트랜잭션으로 커밋한다 — 뒤이어 대화 처리가 실패해 롤백되더라도 **호출은 이미 나갔고
     * 돈도 나갔다.** 사용량만 되돌아가면 상한을 우회하는 구멍이 된다.
     *
     * @return 허용되면 true
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean tryConsume(String userEmail) {
        if (dailyLimit <= 0) return true;
        Long userId = userIdOf(userEmail);
        if (userId == null) return true;   // 사용자를 못 찾으면 막지 않는다(데모 등)

        AiUsageDaily row = usageRepository.findByUserIdAndUsageDate(userId, today())
                .orElseGet(() -> new AiUsageDaily(userId, today()));

        if (row.getLlmCalls() >= dailyLimit) {
            log.info("[AI] 일일 상한 초과 user={} used={} limit={}", userEmail, row.getLlmCalls(), dailyLimit);
            return false;
        }
        row.increment();
        usageRepository.save(row);
        return true;
    }

    private LocalDate today() {
        return LocalDate.now(KST);
    }

    private Long userIdOf(String email) {
        if (email == null || email.isBlank()) return null;
        return userRepository.findByEmail(email).map(User::getId).orElse(null);
    }
}
