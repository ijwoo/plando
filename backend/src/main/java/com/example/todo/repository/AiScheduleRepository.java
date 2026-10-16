package com.example.todo.repository;

import com.example.todo.entity.AiSchedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface AiScheduleRepository extends JpaRepository<AiSchedule, Long> {

    List<AiSchedule> findByWorkspaceIdAndUserEmailOrderByRunHourAscRunMinuteAsc(Long workspaceId, String userEmail);

    Optional<AiSchedule> findByIdAndWorkspaceIdAndUserEmail(Long id, Long workspaceId, String userEmail);

    int countByWorkspaceIdAndUserEmail(Long workspaceId, String userEmail);

    /** 지금 이 시각에 켜져 있는 예약. 요일 필터는 엔티티(runsOn)가 판단한다. */
    List<AiSchedule> findByEnabledTrueAndRunHourAndRunMinute(short runHour, short runMinute);

    /**
     * 실행 권리를 집는다 — **이 쿼리가 잠금이다.**
     *
     * 블루/그린 배포 중에는 두 인스턴스가 잠깐 같이 떠서 둘 다 크론을 돌린다. 조회 후
     * 자바에서 판단하면 둘 다 "아직 안 돌았네" 를 보고 둘 다 보낸다. 조건을 UPDATE 문
     * 안에 넣어야 DB 가 한쪽만 통과시킨다.
     *
     * @param notRunSince 이 시각 이후에 이미 돌았으면 집지 않는다(같은 분 중복 방지)
     * @return 1 이면 내가 집었다. 0 이면 다른 쪽이 이미 가져갔다 — 조용히 넘어가면 된다.
     */
    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update AiSchedule s set s.lastRunAt = :now
             where s.id = :id
               and (s.lastRunAt is null or s.lastRunAt < :notRunSince)
            """)
    int claim(@Param("id") Long id,
              @Param("now") LocalDateTime now,
              @Param("notRunSince") LocalDateTime notRunSince);
}
