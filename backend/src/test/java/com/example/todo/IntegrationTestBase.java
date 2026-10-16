package com.example.todo;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * 통합 테스트 공통 베이스.
 *
 * 왜 통합 테스트인가: 오늘 실서비스에서 나온 결함은 거의 전부 **경계에서** 났다 —
 * 컨트롤러↔서비스 권한 불일치, JPA 의 insert/delete 순서, 페이징 오프셋, DTO 직렬화 키.
 * 단위 테스트로는 하나도 못 잡는 것들이라, 실제 요청을 태워서 확인한다.
 *
 * DB: Docker 가 없어 Testcontainers 대신 H2 를 PostgreSQL 호환 모드로 쓴다.
 * 리포지토리에 `todo.` 스키마가 박힌 네이티브 쿼리가 있어 스키마를 미리 만든다
 * (application-test.properties 의 INIT 참고).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public abstract class IntegrationTestBase {

    @Autowired protected MockMvc mvc;
    @Autowired protected ObjectMapper json;

    @BeforeEach
    void ensureContext() {
        // 컨텍스트 로딩 자체가 회귀 감지 지점이다 — 빈 순환·설정 누락이 여기서 먼저 터진다.
    }
}
