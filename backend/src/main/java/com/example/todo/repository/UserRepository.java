package com.example.todo.repository;

import com.example.todo.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.Query;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);

    List<User> findByEmailIn(List<String> emails);

    Optional<User> findByProviderId(String providerId);
    Optional<User> findByAppleId(String appleId);

    /**
     * 탈퇴하지 않은 계정만. 인증 경로는 반드시 이걸 쓴다.
     *
     * findByEmail 은 탈퇴 계정도 돌려준다. 탈퇴 시 비밀번호를 임의값으로 바꾸긴 하지만
     * null 이 아니어서 "비밀번호 없음" 분기에 걸리지 않고, 익명화된 이메일
     * (deleted-{id}@deleted.invalid)은 쉽게 추측 가능하다. 그래서 별도 조회가 필요하다.
     */
    @Query("SELECT u FROM User u WHERE u.email = :email AND u.deletedAt IS NULL")
    Optional<User> findActiveByEmail(@org.springframework.data.repository.query.Param("email") String email);

    /**
     * 요청마다 호출되는 존재 확인 — 엔티티를 만들지 않고 인덱스만 타도록 count 로 끝낸다.
     * (JWT 필터에서 매 요청 쓰이므로 가장 싼 형태를 골랐다.)
     */
    // 정지된 계정도 여기서 함께 걸러진다 — HTTP·WebSocket 두 인증 경로가 모두 이걸 쓴다.
    @Query("SELECT COUNT(u) > 0 FROM User u WHERE u.email = :email AND u.deletedAt IS NULL AND u.suspendedAt IS NULL")
    boolean existsActiveByEmail(@org.springframework.data.repository.query.Param("email") String email);

    /** 위가 false 일 때만 부른다 — 정지라면 401 대신 이유가 담긴 403 을 돌려주려고. */
    @Query("SELECT COUNT(u) > 0 FROM User u WHERE u.email = :email AND u.deletedAt IS NULL AND u.suspendedAt IS NOT NULL")
    boolean existsSuspendedByEmail(@org.springframework.data.repository.query.Param("email") String email);

    /**
     * 백오피스 사용자 검색 — 이메일·이름 부분 일치. 탈퇴 계정은 뺀다.
     * q 는 빈 문자열로 넘긴다(전체). null 을 넘기면 PostgreSQL 이 파라미터 타입을 못 정한다.
     */
    @Query("SELECT u FROM User u WHERE u.deletedAt IS NULL AND (" +
           "LOWER(u.email) LIKE LOWER(CONCAT('%', :q, '%')) OR LOWER(COALESCE(u.name, '')) LIKE LOWER(CONCAT('%', :q, '%'))) " +
           "ORDER BY u.id DESC")
    org.springframework.data.domain.Page<User> searchForAdmin(
            @org.springframework.data.repository.query.Param("q") String q,
            org.springframework.data.domain.Pageable pageable);

    /** 대시보드 — 게스트·탈퇴 제외 회원 수. */
    @Query("SELECT COUNT(u) FROM User u WHERE u.guestLoginCount = 0 AND u.deletedAt IS NULL")
    long countMembers();

    @Query("SELECT COUNT(u) FROM User u WHERE u.guestLoginCount = 0 AND u.deletedAt IS NULL AND u.lastActiveAt >= :since")
    long countActiveSince(@org.springframework.data.repository.query.Param("since") java.time.LocalDateTime since);

    long countBySuspendedAtIsNotNullAndDeletedAtIsNull();

    /** 게스트·탈퇴자 제외한 일반 사용자 — 푸시 발송 대상. */
    @Query("SELECT u FROM User u WHERE u.guestLoginCount = 0 AND u.deletedAt IS NULL")
    List<User> findActiveNonGuestUsers();

    /** 마지막 활동 시각 갱신 — 표시용이라 엔티티 로딩 없이 단건 UPDATE로 끝낸다. */
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("update User u set u.lastActiveAt = :at where u.email = :email")
    int touchLastActive(@org.springframework.data.repository.query.Param("email") String email,
                        @org.springframework.data.repository.query.Param("at") java.time.LocalDateTime at);
}
