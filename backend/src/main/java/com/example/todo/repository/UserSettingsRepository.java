package com.example.todo.repository;

import com.example.todo.entity.UserSettings;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserSettingsRepository extends JpaRepository<UserSettings, Long> {
    Optional<UserSettings> findByUserId(Long userId);

    /**
     * 게스트 정리: 대시보드 개인화(메모/북마크/레이아웃)를 **기본 시드로 되돌린다.**
     *
     * 예전엔 null 로 비웠다. 이전 게스트의 메모가 다음 사람에게 보이지 않게 하려는 의도는 맞지만,
     * 그러면 둘러보기 첫 화면이 기본 배치에 빈 카드만 남아 "써볼 게 없는 화면"이 됐다.
     * 값은 {@link com.example.todo.util.GuestDashboardSeed} 한 곳에서 관리한다.
     */
    @Modifying
    @Query("UPDATE UserSettings s SET s.dashboardLayout = :layout, s.dashboardBookmarks = :bookmarks, " +
           "s.dashboardStickies = :stickies, s.dashboardTutorialSeen = true " +
           "WHERE s.userId IN (SELECT u.id FROM User u WHERE u.email IN :emails)")
    void resetDashboardForGuestEmails(@Param("emails") List<String> emails,
                                      @Param("layout") String layout,
                                      @Param("bookmarks") String bookmarks,
                                      @Param("stickies") String stickies);
}