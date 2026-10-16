package com.example.todo.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

/**
 * 주간 회고 카드 응답 DTO.
 * 프론트 WeeklyWrapMobile 의 MOCK_WRAP 구조와 1:1 매칭.
 * <p>
 * 한 endpoint 응답에 모든 집계 정보를 담는다 (API 호출 1회로 카드 완성).
 * AI 한마디는 캐시 권장 — 동일 주차 재요청 시 재호출 안 하도록 서비스 단에서 처리.
 */
@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class WrapResponseDto {

    // 기간 메타
    private int year;
    private int month;
    private int weekIndex;      // 해당 월에서 몇 번째 주(첫 번째 일요일 기준)
    private String rangeLabel;  // "5월 25일 — 5월 31일"
    private String userName;    // 화면에 표시할 닉네임/이름

    // 핵심 수치
    private int totalCount;
    private int doneCount;
    private int completionRate;         // 0~100, 전체 분모 — 참고용
    // "소화율" — 이미 지난 일정만 분모로. 캘린더 일정에 더 적절한 지표.
    private int pastCount;              // dueDate <= today 인 일정 수
    private int pastDoneCount;          // 그 중 DONE
    private int pastCompletionRate;     // 0~100, 지난 일정 분모

    // 지난주 비교
    private int prevWeekTotalCount;
    private int prevWeekCompletionRate;

    // 요일 분포 (일~토 7개)
    private int[] weekdayCounts;
    private DayInfo busiestDay;

    // 시간대 분포
    private TimeBuckets timeBuckets;

    // 함께한 사람 TOP 3 + 호환용 단일 필드
    private List<PersonInfo> topPeople;
    private PersonInfo topPerson;

    // 자주 간 곳
    private PlaceInfo topPlace;

    // 총 회의(시간 있는 일정) 시간 — 분
    private int meetingMinutes;

    // 마일스톤
    private List<MilestoneInfo> milestones;

    // 활동 히트맵 — 3 (오전/오후/저녁) x 7 (일~토)
    private int[][] activityHeatmap;

    // 빠른 통계 4종
    private QuickStats quickStats;

    // 이번 주 일정 brief — 각 섹션 "자세히보기"에서 클라이언트 필터링 용
    private List<TodoBrief> weekTodos;

    // ── 풀 리포트 신규 필드들 ──
    private StatusBreakdown statusBreakdown;
    private PriorityBreakdown priorityBreakdown;
    private List<PlaceInfo> topPlaces;        // TOP 5
    private NotableTodos notableTodos;
    private RatioInfo collabRatio;            // 협업 vs 단독
    private RatioInfo timedRatio;             // 시간 정한 vs 종일
    private double averageTodoMinutes;        // 평균 일정 길이 (시간 정한 일정 기준)

    // ── 신규 ──
    private NextWeekPreview nextWeekPreview;
    private List<KeywordInfo> keywords;
    private String selfMemo;                  // 사용자 한 줄 회고 — null 가능

    // AI 한마디
    private String aiComment;
    private String aiPersona;   // analyst / cynical / cheer / brutal

    @Getter @Setter @Builder @AllArgsConstructor @NoArgsConstructor
    public static class DayInfo {
        private String label;   // "목요일"
        private int count;
        private int dayIndex;   // 0=일 ~ 6=토 (KO_DAYS 배열 기준)
    }

    @Getter @Setter @Builder @AllArgsConstructor @NoArgsConstructor
    public static class TimeBuckets {
        private int dawn;       // 00–06시
        private int morning;    // 06–12시
        private int afternoon;  // 12–18시
        private int evening;    // 18–24시
    }

    @Getter @Setter @Builder @AllArgsConstructor @NoArgsConstructor
    public static class PersonInfo {
        private String name;
        private int count;
        private String profileImageUrl;
    }

    @Getter @Setter @Builder @AllArgsConstructor @NoArgsConstructor
    public static class PlaceInfo {
        private String name;
        private int count;
    }

    @Getter @Setter @Builder @AllArgsConstructor @NoArgsConstructor
    public static class MilestoneInfo {
        private String id;
        private String emoji;
        private String label;
    }

    @Getter @Setter @Builder @AllArgsConstructor @NoArgsConstructor
    public static class QuickStats {
        private double dailyAverage;          // 2.43 (소숫점 둘째자리)
        private DayTimeInfo earliestStart;    // 가장 일찍 시작 — null 가능
        private DayTimeInfo latestEnd;        // 가장 늦게 끝남 — null 가능
        private LongestInfo longestTodo;      // 가장 긴 일정 — null 가능
    }

    @Getter @Setter @Builder @AllArgsConstructor @NoArgsConstructor
    public static class DayTimeInfo {
        private String dayLabel;   // "월"
        private String timeLabel;  // "09:00"
    }

    @Getter @Setter @Builder @AllArgsConstructor @NoArgsConstructor
    public static class LongestInfo {
        private String title;      // 최대 24자 자름
        private int minutes;       // 480
    }

    @Getter @Setter @Builder @AllArgsConstructor @NoArgsConstructor
    public static class TodoBrief {
        private Long id;
        private String title;
        private int dayIndex;           // 0=일 ~ 6=토
        private String dayLabel;        // "목"
        private String dateLabel;       // "5/28"
        private String startTime;       // "14:00" or null
        private String endTime;         // "16:00" or null
        private String bucket;          // "dawn"/"morning"/"afternoon"/"evening" or null
        private String status;          // TODO/IN_PROGRESS/DONE
        private String priority;        // HIGH/MEDIUM/LOW
        private String locationName;    // or null
        private Double locationLat;     // or null
        private Double locationLng;     // or null
        private List<String> assigneeNames;
    }

    @Getter @Setter @Builder @AllArgsConstructor @NoArgsConstructor
    public static class StatusBreakdown {
        private int todo;
        private int inProgress;
        private int done;
    }

    @Getter @Setter @Builder @AllArgsConstructor @NoArgsConstructor
    public static class PriorityBreakdown {
        private int high;
        private int medium;
        private int low;
    }

    /**
     * 두 그룹 비율 (예: 협업/단독, 종일/시간정한).
     * primary 가 강조 항목, secondary 가 기준 항목.
     */
    @Getter @Setter @Builder @AllArgsConstructor @NoArgsConstructor
    public static class RatioInfo {
        private int primary;
        private int secondary;
        private String primaryLabel;
        private String secondaryLabel;
    }

    @Getter @Setter @Builder @AllArgsConstructor @NoArgsConstructor
    public static class NotableTodos {
        private NotableTodo firstOfWeek;     // 이번 주 첫 일정
        private NotableTodo lastOfWeek;      // 이번 주 마지막
        private NotableTodo longest;         // 가장 긴 일정
    }

    @Getter @Setter @Builder @AllArgsConstructor @NoArgsConstructor
    public static class NotableTodo {
        private Long id;
        private String title;
        private String dayLabel;     // "월"
        private String dateLabel;    // "5/25"
        private String timeLabel;    // "09:00 ~ 10:00" or "종일"
        private int minutes;         // 시간 정한 일정만
    }

    @Getter @Setter @Builder @AllArgsConstructor @NoArgsConstructor
    public static class NextWeekPreview {
        private String rangeLabel;       // "6월 1일 — 7일"
        private int totalCount;
        private DayInfo busiestDay;      // 없으면 null
        private PlaceInfo topPlace;      // 없으면 null
    }

    @Getter @Setter @Builder @AllArgsConstructor @NoArgsConstructor
    public static class KeywordInfo {
        private String word;
        private int count;
    }
}
