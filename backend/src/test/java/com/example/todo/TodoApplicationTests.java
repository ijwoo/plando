package com.example.todo;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

// 프로필 없이 뜨면 실제 PostgreSQL 에 붙으려다 CI(DB 없음)에서 실패한다 — 다른 통합 테스트와 같은 H2 로.
@SpringBootTest
@ActiveProfiles("test")
class TodoApplicationTests {

    @Test
    void contextLoads() {
    }

}
