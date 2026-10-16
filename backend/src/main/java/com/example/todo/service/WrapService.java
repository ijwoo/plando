package com.example.todo.service;

import com.example.todo.dto.WrapResponseDto;
import com.example.llm.prompt.LlmPrompts;
import com.example.todo.entity.Priority;
import com.example.todo.entity.Todo;
import com.example.todo.entity.User;
import com.example.todo.entity.Workspace;
import com.example.todo.entity.WrapCommentCache;
import com.example.todo.entity.WrapSelfMemo;
import com.example.todo.repository.TodoRepository;
import com.example.todo.repository.WrapCommentCacheRepository;
import com.example.todo.repository.WrapSelfMemoRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 주간 회고 카드 집계 서비스.
 * <p>
 * 한국 시간 기준 일요일 ~ 토요일을 한 주로 본다 (KO_DAYS 배열과 일치).
 * archived 무관, isSample=true 제외해서 집계.
 */
@Slf4j
@Service
public class WrapService {

    private final TodoRepository todoRepository;
    private final WorkspaceResolver workspaceResolver;
    private final WrapCommentCacheRepository commentCacheRepository;
    private final WrapSelfMemoRepository selfMemoRepository;
    private final ChatClient chatClient;
    private final ObjectMapper om = new ObjectMapper();

    private static final String[] KO_DAYS = {"일", "월", "화", "수", "목", "금", "토"};

    // 한국어 키워드 추출용 stop words + 끝에 붙은 조사 패턴
    private static final java.util.Set<String> STOP_WORDS = java.util.Set.of(
            "및", "그리고", "또는", "위해", "관련", "내용", "일정", "회의", "준비",
            "with", "and", "or", "the", "for", "of", "to", "in", "on", "at",
            "추가", "수정", "삭제", "확인", "검토"
    );
    private static final java.util.regex.Pattern KO_PARTICLE_TAIL =
            java.util.regex.Pattern.compile("(은|는|이|가|을|를|의|에|와|과|도|만|로|으로|에서|에게|한테|부터|까지|보다|처럼|같이|들|님|씨)$");

    @Autowired
    public WrapService(
            TodoRepository todoRepository,
            WorkspaceResolver workspaceResolver,
            WrapCommentCacheRepository commentCacheRepository,
            WrapSelfMemoRepository selfMemoRepository,
            ChatClient.Builder chatClientBuilder
    ) {
        this.todoRepository = todoRepository;
        this.workspaceResolver = workspaceResolver;
        this.commentCacheRepository = commentCacheRepository;
        this.selfMemoRepository = selfMemoRepository;
        this.chatClient = chatClientBuilder.build();
    }

    public WrapResponseDto getWeekly(String userEmail, Long workspaceId, LocalDate weekStart) {
        return getWeekly(userEmail, workspaceId, weekStart, false, null);
    }

    public WrapResponseDto getWeekly(String userEmail, Long workspaceId, LocalDate weekStart, boolean refresh) {
        return getWeekly(userEmail, workspaceId, weekStart, refresh, null);
    }

    /**
     * weekStart 가 null 이면 today 기준 "이번 주 일요일" 사용.
     * refresh=true 면 AI 한마디 캐시 무시하고 LLM 재호출.
     * persona: analyst(기본) / cynical / cheer / brutal
     */
    public WrapResponseDto getWeekly(String userEmail, Long workspaceId, LocalDate weekStart, boolean refresh, String persona) {
        Workspace workspace = workspaceResolver.resolve(userEmail, workspaceId);
        User user = workspaceResolver.getUser(userEmail);

        LocalDate today = LocalDate.now();
        // 회고는 "방금 끝난 한 주"를 기본으로 — 새 주 시작 시 진행 중인 주는 회고에 부적절
        LocalDate sun = weekStart != null ? toSunday(weekStart) : toSunday(today).minusDays(7);
        LocalDate sat = sun.plusDays(6);

        LocalDate prevSun = sun.minusDays(7);
        LocalDate prevSat = sun.minusDays(1);

        List<Todo> thisWeek = filterMine(
                todoRepository.findByWorkspaceAndDueDateBetweenIgnoreArchived(workspace, sun, sat),
                user.getEmail()
        );
        List<Todo> lastWeek = filterMine(
                todoRepository.findByWorkspaceAndDueDateBetweenIgnoreArchived(workspace, prevSun, prevSat),
                user.getEmail()
        );

        int totalCount = thisWeek.size();
        int doneCount = (int) thisWeek.stream().filter(t -> t.getDoneAt() != null).count();
        int completionRate = totalCount == 0 ? 0 : Math.round(doneCount * 100f / totalCount);

        // 소화율 — 이미 지난 일정만 분모. 회고에 더 적절.
        List<Todo> pastTodos = thisWeek.stream()
                .filter(t -> t.getDueDate() != null && !t.getDueDate().isAfter(today))
                .toList();
        int pastCount = pastTodos.size();
        int pastDoneCount = (int) pastTodos.stream().filter(t -> t.getDoneAt() != null).count();
        int pastCompletionRate = pastCount == 0 ? 0 : Math.round(pastDoneCount * 100f / pastCount);

        int prevTotal = lastWeek.size();
        int prevDone = (int) lastWeek.stream().filter(t -> t.getDoneAt() != null).count();
        int prevRate = prevTotal == 0 ? 0 : Math.round(prevDone * 100f / prevTotal);

        int[] weekdayCounts = computeWeekdayCounts(thisWeek);
        WrapResponseDto.DayInfo busiestDay = computeBusiestDay(weekdayCounts);

        WrapResponseDto.TimeBuckets timeBuckets = computeTimeBuckets(thisWeek);

        List<WrapResponseDto.PersonInfo> topPeople = computeTopPeople(thisWeek, user.getEmail(), 5);
        WrapResponseDto.PersonInfo topPerson = topPeople.isEmpty() ? null : topPeople.get(0);

        WrapResponseDto.PlaceInfo topPlace = computeTopPlace(thisWeek);

        int meetingMinutes = computeMeetingMinutes(thisWeek);

        List<WrapResponseDto.MilestoneInfo> milestones = computeMilestones(
                completionRate, topPeople, totalCount, prevTotal
        );

        int[][] heatmap = computeHeatmap(thisWeek);
        WrapResponseDto.QuickStats quickStats = computeQuickStats(thisWeek, totalCount);
        List<WrapResponseDto.TodoBrief> weekTodos = toBriefs(thisWeek);

        // 신규: 다음 주 미리보기 + 키워드 + 셀프 메모
        WrapResponseDto.NextWeekPreview nextWeekPreview = computeNextWeekPreview(workspace, user.getEmail(), sun.plusDays(7));
        List<WrapResponseDto.KeywordInfo> keywords = computeKeywords(thisWeek);
        String selfMemo = selfMemoRepository.findByUserAndWeekStart(user, sun)
                .map(WrapSelfMemo::getContent).orElse(null);

        WrapResponseDto.StatusBreakdown statusBreakdown = computeStatusBreakdown(thisWeek);
        WrapResponseDto.PriorityBreakdown priorityBreakdown = computePriorityBreakdown(thisWeek);
        List<WrapResponseDto.PlaceInfo> topPlacesList = computeTopPlaces(thisWeek, 5);
        WrapResponseDto.NotableTodos notableTodos = computeNotableTodos(thisWeek);
        WrapResponseDto.RatioInfo collabRatio = computeCollabRatio(thisWeek);
        WrapResponseDto.RatioInfo timedRatio = computeTimedRatio(thisWeek);
        double averageTodoMinutes = computeAverageTodoMinutes(thisWeek);

        String resolvedPersona = normalizePersona(persona);
        String aiComment = getOrGenerateComment(
                user, sun, refresh, resolvedPersona,
                busiestDay, completionRate, prevRate, totalCount, doneCount, prevTotal,
                topPeople, topPlace, meetingMinutes, averageTodoMinutes,
                timeBuckets, statusBreakdown, priorityBreakdown,
                collabRatio, timedRatio
        );

        return WrapResponseDto.builder()
                .year(sun.getYear())
                .month(sun.getMonthValue())
                .weekIndex(weekOfMonth(sun))
                .rangeLabel(formatRangeLabel(sun, sat))
                .userName(displayName(user))
                .totalCount(totalCount)
                .doneCount(doneCount)
                .completionRate(completionRate)
                .pastCount(pastCount)
                .pastDoneCount(pastDoneCount)
                .pastCompletionRate(pastCompletionRate)
                .prevWeekTotalCount(prevTotal)
                .prevWeekCompletionRate(prevRate)
                .weekdayCounts(weekdayCounts)
                .busiestDay(busiestDay)
                .timeBuckets(timeBuckets)
                .topPeople(topPeople)
                .topPerson(topPerson)
                .topPlace(topPlace)
                .meetingMinutes(meetingMinutes)
                .milestones(milestones)
                .activityHeatmap(heatmap)
                .quickStats(quickStats)
                .weekTodos(weekTodos)
                .statusBreakdown(statusBreakdown)
                .priorityBreakdown(priorityBreakdown)
                .topPlaces(topPlacesList)
                .notableTodos(notableTodos)
                .collabRatio(collabRatio)
                .timedRatio(timedRatio)
                .averageTodoMinutes(averageTodoMinutes)
                .nextWeekPreview(nextWeekPreview)
                .keywords(keywords)
                .selfMemo(selfMemo)
                .aiComment(aiComment)
                .aiPersona(resolvedPersona)
                .build();
    }

    private static final java.util.Set<String> VALID_PERSONAS = java.util.Set.of("analyst", "cynical", "cheer", "brutal");
    private String normalizePersona(String p) {
        if (p != null && VALID_PERSONAS.contains(p)) return p;
        return "analyst";
    }

    /**
     * 최근 N주차 회고 히스토리 (LLM 호출 없이 가벼운 집계만).
     * 이번 주 포함 weeks 개수만큼 거꾸로 조회.
     */
    public List<com.example.todo.dto.WrapHistoryItemDto> getHistory(String userEmail, Long workspaceId, int weeks) {
        if (weeks <= 0) weeks = 8;
        if (weeks > 24) weeks = 24;

        Workspace workspace = workspaceResolver.resolve(userEmail, workspaceId);
        User user = workspaceResolver.getUser(userEmail);
        LocalDate today = LocalDate.now();
        LocalDate currentSun = toSunday(today);

        List<com.example.todo.dto.WrapHistoryItemDto> out = new ArrayList<>();
        for (int i = 0; i < weeks; i++) {
            LocalDate sun = currentSun.minusDays(7L * i);
            LocalDate sat = sun.plusDays(6);
            List<Todo> wkTodos = filterMine(
                    todoRepository.findByWorkspaceAndDueDateBetweenIgnoreArchived(workspace, sun, sat),
                    user.getEmail()
            );
            int totalCount = wkTodos.size();
            List<Todo> pastList = wkTodos.stream()
                    .filter(t -> t.getDueDate() != null && !t.getDueDate().isAfter(today))
                    .toList();
            int pastCount = pastList.size();
            int pastDone = (int) pastList.stream().filter(t -> t.getDoneAt() != null).count();
            int pastRate = pastCount == 0 ? 0 : Math.round(pastDone * 100f / pastCount);

            out.add(com.example.todo.dto.WrapHistoryItemDto.builder()
                    .weekStart(sun)
                    .year(sun.getYear())
                    .month(sun.getMonthValue())
                    .weekIndex(weekOfMonth(sun))
                    .rangeLabel(formatRangeLabel(sun, sat))
                    .totalCount(totalCount)
                    .pastCount(pastCount)
                    .pastDoneCount(pastDone)
                    .pastCompletionRate(pastRate)
                    .current(i == 0)
                    .build());
        }
        return out;
    }

    /** 셀프 메모 저장 (upsert). content 가 빈 문자열이면 삭제. */
    @org.springframework.transaction.annotation.Transactional
    public void saveSelfMemo(String userEmail, LocalDate weekStart, String content) {
        User user = workspaceResolver.getUser(userEmail);
        LocalDate sun = weekStart != null ? toSunday(weekStart) : toSunday(LocalDate.now());
        Optional<WrapSelfMemo> existing = selfMemoRepository.findByUserAndWeekStart(user, sun);

        if (content == null || content.isBlank()) {
            existing.ifPresent(selfMemoRepository::delete);
            return;
        }
        String trimmed = content.trim();
        if (trimmed.length() > 2000) trimmed = trimmed.substring(0, 2000);
        if (existing.isPresent()) {
            WrapSelfMemo memo = existing.get();
            memo.setContent(trimmed);
            selfMemoRepository.save(memo);
        } else {
            selfMemoRepository.save(WrapSelfMemo.builder()
                    .user(user)
                    .weekStart(sun)
                    .content(trimmed)
                    .build());
        }
    }

    // ── 다음 주 미리보기 ─────────────────────────────────

    private WrapResponseDto.NextWeekPreview computeNextWeekPreview(Workspace workspace, String userEmail, LocalDate nextSun) {
        LocalDate nextSat = nextSun.plusDays(6);
        List<Todo> nextWeek = filterMine(
                todoRepository.findByWorkspaceAndDueDateBetweenIgnoreArchived(workspace, nextSun, nextSat),
                userEmail
        );
        int total = nextWeek.size();
        if (total == 0) {
            return WrapResponseDto.NextWeekPreview.builder()
                    .rangeLabel(formatRangeLabel(nextSun, nextSat))
                    .totalCount(0)
                    .build();
        }
        int[] weekdayCounts = computeWeekdayCounts(nextWeek);
        WrapResponseDto.DayInfo busiest = computeBusiestDay(weekdayCounts);
        if (busiest.getCount() == 0) busiest = null;
        WrapResponseDto.PlaceInfo place = computeTopPlace(nextWeek);

        return WrapResponseDto.NextWeekPreview.builder()
                .rangeLabel(formatRangeLabel(nextSun, nextSat))
                .totalCount(total)
                .busiestDay(busiest)
                .topPlace(place)
                .build();
    }

    // ── 키워드 추출 ─────────────────────────────────

    /**
     * 일정 제목들에서 단순 단어 빈도 기반 키워드 추출.
     * 한국어 형태소 분석 없이도 어느 정도 의미 있는 키워드 잡힘.
     */
    private List<WrapResponseDto.KeywordInfo> computeKeywords(List<Todo> todos) {
        Map<String, Integer> counts = new HashMap<>();
        for (Todo t : todos) {
            String title = t.getTitle();
            if (title == null) continue;
            // 공백/특수문자/숫자 단독 split
            String[] tokens = title.split("[\\s\\p{Punct}]+");
            for (String tk : tokens) {
                String clean = tk.trim();
                if (clean.isEmpty()) continue;
                // 끝 조사 떼기 (한국어만)
                java.util.regex.Matcher m = KO_PARTICLE_TAIL.matcher(clean);
                if (m.find() && clean.length() > 2) {
                    clean = clean.substring(0, m.start());
                }
                if (clean.length() < 2) continue;
                if (STOP_WORDS.contains(clean)) continue;
                // 영어/숫자만으로 짧은 토큰 제외 (예: "AI"는 길이 2라 OK / "1", "2" 같은 단독 숫자는 길이 1)
                if (clean.matches("[0-9]+")) continue;
                counts.merge(clean, 1, Integer::sum);
            }
        }
        return counts.entrySet().stream()
                .filter(e -> e.getValue() >= 2)  // 2회 이상 등장한 것만
                .sorted((a, b) -> Integer.compare(b.getValue(), a.getValue()))
                .limit(6)
                .map(e -> WrapResponseDto.KeywordInfo.builder()
                        .word(e.getKey())
                        .count(e.getValue())
                        .build())
                .toList();
    }

    /**
     * Brief list — 각 섹션 자세히보기에서 클라이언트가 필터링.
     * 요일 → 시간 순으로 정렬.
     */
    private List<WrapResponseDto.TodoBrief> toBriefs(List<Todo> todos) {
        return todos.stream()
                .map(this::toBrief)
                .filter(b -> b != null)
                .sorted((a, b) -> {
                    int cmp = Integer.compare(a.getDayIndex(), b.getDayIndex());
                    if (cmp != 0) return cmp;
                    if (a.getStartTime() == null && b.getStartTime() == null) return 0;
                    if (a.getStartTime() == null) return -1;
                    if (b.getStartTime() == null) return 1;
                    return a.getStartTime().compareTo(b.getStartTime());
                })
                .toList();
    }

    private WrapResponseDto.TodoBrief toBrief(Todo t) {
        if (t.getDueDate() == null) return null;
        int day = dayIndexSunBased(t.getDueDate());
        LocalTime st = t.getStartTime();
        LocalTime et = t.getEndTime();
        String bucket = null;
        if (st != null) {
            int h = st.getHour();
            if (h < 6) bucket = "dawn";
            else if (h < 12) bucket = "morning";
            else if (h < 18) bucket = "afternoon";
            else bucket = "evening";
        }
        List<String> names = new ArrayList<>();
        if (t.getAssignees() != null) {
            for (User u : t.getAssignees()) {
                names.add(displayName(u));
            }
        }
        return WrapResponseDto.TodoBrief.builder()
                .id(t.getId())
                .title(t.getTitle())
                .dayIndex(day)
                .dayLabel(KO_DAYS[day])
                .dateLabel(String.format("%d/%d", t.getDueDate().getMonthValue(), t.getDueDate().getDayOfMonth()))
                .startTime(st != null ? String.format("%02d:%02d", st.getHour(), st.getMinute()) : null)
                .endTime(et != null ? String.format("%02d:%02d", et.getHour(), et.getMinute()) : null)
                .bucket(bucket)
                .status(t.getStatus())
                .priority(t.getPriority() != null ? t.getPriority().name() : null)
                .locationName(t.getLocationName())
                .locationLat(t.getLocationLat())
                .locationLng(t.getLocationLng())
                .assigneeNames(names)
                .build();
    }

    // ── 풀 리포트 집계 ─────────────────────────────

    private WrapResponseDto.StatusBreakdown computeStatusBreakdown(List<Todo> todos) {
        int todo = 0, inProgress = 0, done = 0;
        for (Todo t : todos) {
            // 완료는 doneAt(카테고리 안전), 진행중/할일은 기본 상태 key 기준(커스텀 카테고리 세분은 Phase 2)
            if (t.getDoneAt() != null) done++;
            else if ("IN_PROGRESS".equals(t.getStatus())) inProgress++;
            else todo++;
        }
        return WrapResponseDto.StatusBreakdown.builder()
                .todo(todo).inProgress(inProgress).done(done)
                .build();
    }

    private WrapResponseDto.PriorityBreakdown computePriorityBreakdown(List<Todo> todos) {
        int high = 0, medium = 0, low = 0;
        for (Todo t : todos) {
            Priority p = t.getPriority();
            if (p == Priority.HIGH) high++;
            else if (p == Priority.LOW) low++;
            else medium++; // MEDIUM 또는 null
        }
        return WrapResponseDto.PriorityBreakdown.builder()
                .high(high).medium(medium).low(low)
                .build();
    }

    private WrapResponseDto.RatioInfo computeCollabRatio(List<Todo> todos) {
        int collab = 0, solo = 0;
        for (Todo t : todos) {
            int n = t.getAssignees() == null ? 0 : t.getAssignees().size();
            if (n >= 2) collab++;
            else solo++;
        }
        return WrapResponseDto.RatioInfo.builder()
                .primary(collab)
                .secondary(solo)
                .primaryLabel("협업")
                .secondaryLabel("단독")
                .build();
    }

    private WrapResponseDto.RatioInfo computeTimedRatio(List<Todo> todos) {
        int timed = 0, allDay = 0;
        for (Todo t : todos) {
            if (t.getStartTime() != null && t.getEndTime() != null) timed++;
            else allDay++;
        }
        return WrapResponseDto.RatioInfo.builder()
                .primary(timed)
                .secondary(allDay)
                .primaryLabel("시간 정한 일정")
                .secondaryLabel("종일/시간 미정")
                .build();
    }

    private double computeAverageTodoMinutes(List<Todo> todos) {
        int sum = 0, count = 0;
        for (Todo t : todos) {
            LocalTime s = t.getStartTime();
            LocalTime e = t.getEndTime();
            if (s == null || e == null) continue;
            int mins = (int) java.time.Duration.between(s, e).toMinutes();
            if (mins > 0) { sum += mins; count++; }
        }
        if (count == 0) return 0.0;
        return Math.round((sum * 1.0 / count) * 10) / 10.0;
    }

    private WrapResponseDto.NotableTodos computeNotableTodos(List<Todo> todos) {
        Todo first = null, last = null, longest = null;
        int longestMin = 0;

        for (Todo t : todos) {
            if (t.getDueDate() == null) continue;
            // first = 가장 이른 (요일 + 시간)
            if (first == null || isEarlier(t, first)) first = t;
            // last = 가장 늦은 (요일 + 시간)
            if (last == null || isLater(t, last)) last = t;
            // longest
            LocalTime s = t.getStartTime();
            LocalTime e = t.getEndTime();
            if (s != null && e != null) {
                int mins = (int) java.time.Duration.between(s, e).toMinutes();
                if (mins > longestMin) { longestMin = mins; longest = t; }
            }
        }

        return WrapResponseDto.NotableTodos.builder()
                .firstOfWeek(toNotable(first, 0))
                .lastOfWeek(toNotable(last, 0))
                .longest(toNotable(longest, longestMin))
                .build();
    }

    private boolean isEarlier(Todo a, Todo b) {
        int cmp = a.getDueDate().compareTo(b.getDueDate());
        if (cmp != 0) return cmp < 0;
        LocalTime ta = a.getStartTime();
        LocalTime tb = b.getStartTime();
        if (ta == null && tb == null) return false;
        if (ta == null) return true; // 종일 일정이 더 일찍으로
        if (tb == null) return false;
        return ta.isBefore(tb);
    }

    private boolean isLater(Todo a, Todo b) {
        int cmp = a.getDueDate().compareTo(b.getDueDate());
        if (cmp != 0) return cmp > 0;
        LocalTime ta = a.getEndTime() != null ? a.getEndTime() : a.getStartTime();
        LocalTime tb = b.getEndTime() != null ? b.getEndTime() : b.getStartTime();
        if (ta == null && tb == null) return false;
        if (ta == null) return false;
        if (tb == null) return true;
        return ta.isAfter(tb);
    }

    private WrapResponseDto.NotableTodo toNotable(Todo t, int minutes) {
        if (t == null || t.getDueDate() == null) return null;
        int day = dayIndexSunBased(t.getDueDate());
        String dateLabel = String.format("%d/%d", t.getDueDate().getMonthValue(), t.getDueDate().getDayOfMonth());
        String timeLabel;
        LocalTime s = t.getStartTime();
        LocalTime e = t.getEndTime();
        if (s != null && e != null) {
            timeLabel = String.format("%02d:%02d ~ %02d:%02d", s.getHour(), s.getMinute(), e.getHour(), e.getMinute());
        } else if (s != null) {
            timeLabel = String.format("%02d:%02d", s.getHour(), s.getMinute());
        } else {
            timeLabel = "종일";
        }
        String title = t.getTitle() == null ? "" : t.getTitle();
        if (title.length() > 28) title = title.substring(0, 28) + "…";
        return WrapResponseDto.NotableTodo.builder()
                .id(t.getId())
                .title(title)
                .dayLabel(KO_DAYS[day])
                .dateLabel(dateLabel)
                .timeLabel(timeLabel)
                .minutes(minutes)
                .build();
    }

    /**
     * 활동 히트맵 — 4 (새벽/오전/오후/저녁) × 7 (일~토).
     * dueDate 기준 요일 + startTime 기준 시간대. startTime 없는(종일) 일정은 카운트 안 함.
     */
    private int[][] computeHeatmap(List<Todo> todos) {
        int[][] grid = new int[4][7];
        for (Todo t : todos) {
            LocalDate d = t.getDueDate();
            LocalTime st = t.getStartTime();
            if (d == null || st == null) continue;
            int day = dayIndexSunBased(d);
            int h = st.getHour();
            int bucket;
            if (h < 6) bucket = 0;
            else if (h < 12) bucket = 1;
            else if (h < 18) bucket = 2;
            else bucket = 3;
            grid[bucket][day] += 1;
        }
        return grid;
    }

    private WrapResponseDto.QuickStats computeQuickStats(List<Todo> todos, int totalCount) {
        double dailyAverage = totalCount > 0 ? Math.round(totalCount * 100.0 / 7) / 100.0 : 0.0;

        Todo earliest = null;
        Todo latest = null;
        Todo longest = null;
        int longestMinutes = 0;

        for (Todo t : todos) {
            LocalTime st = t.getStartTime();
            LocalTime et = t.getEndTime();
            if (st != null) {
                if (earliest == null || compareDayTime(t, earliest, true) < 0) earliest = t;
            }
            if (et != null) {
                if (latest == null || compareDayTime(t, latest, false) > 0) latest = t;
            }
            if (st != null && et != null) {
                int mins = (int) java.time.Duration.between(st, et).toMinutes();
                if (mins > longestMinutes) {
                    longestMinutes = mins;
                    longest = t;
                }
            }
        }

        return WrapResponseDto.QuickStats.builder()
                .dailyAverage(dailyAverage)
                .earliestStart(toDayTime(earliest, true))
                .latestEnd(toDayTime(latest, false))
                .longestTodo(toLongest(longest, longestMinutes))
                .build();
    }

    /**
     * 일정 a, b 비교. useStart=true 면 startTime, false 면 endTime 기준.
     * 같은 시간대일 경우 dueDate 빠른 쪽 우선(early start), 늦은 쪽 우선(late end).
     */
    private int compareDayTime(Todo a, Todo b, boolean useStart) {
        LocalTime ta = useStart ? a.getStartTime() : a.getEndTime();
        LocalTime tb = useStart ? b.getStartTime() : b.getEndTime();
        int cmp = ta.compareTo(tb);
        if (cmp != 0) return cmp;
        // 같은 시간대일 때 요일 비교
        LocalDate da = a.getDueDate();
        LocalDate db = b.getDueDate();
        if (da == null || db == null) return 0;
        return da.compareTo(db);
    }

    private WrapResponseDto.DayTimeInfo toDayTime(Todo t, boolean useStart) {
        if (t == null) return null;
        LocalTime time = useStart ? t.getStartTime() : t.getEndTime();
        if (time == null || t.getDueDate() == null) return null;
        int day = dayIndexSunBased(t.getDueDate());
        return WrapResponseDto.DayTimeInfo.builder()
                .dayLabel(KO_DAYS[day])
                .timeLabel(String.format("%02d:%02d", time.getHour(), time.getMinute()))
                .build();
    }

    private WrapResponseDto.LongestInfo toLongest(Todo t, int minutes) {
        if (t == null || minutes <= 0) return null;
        String title = t.getTitle() == null ? "" : t.getTitle();
        if (title.length() > 24) title = title.substring(0, 24) + "…";
        return WrapResponseDto.LongestInfo.builder()
                .title(title)
                .minutes(minutes)
                .build();
    }

    // ─────────────── helpers ───────────────

    /** isSample 제거 + 본인이 직접 만들었거나 배정받은 일정만 카운트한다. */
    private List<Todo> filterMine(List<Todo> todos, String email) {
        List<Todo> out = new ArrayList<>();
        for (Todo t : todos) {
            if (Boolean.TRUE.equals(t.getIsSample())) continue;
            boolean isMine = false;
            if (t.getCreatedBy() != null && email.equalsIgnoreCase(t.getCreatedBy().getEmail())) {
                isMine = true;
            }
            if (!isMine && t.getAssignees() != null) {
                for (User a : t.getAssignees()) {
                    if (email.equalsIgnoreCase(a.getEmail())) { isMine = true; break; }
                }
            }
            if (isMine) out.add(t);
        }
        return out;
    }

    private LocalDate toSunday(LocalDate date) {
        // 자바 DayOfWeek: MONDAY=1 ... SUNDAY=7. KO_DAYS 는 일=0.
        // 일요일이면 그대로, 월요일이면 어제, ... 토요일이면 6일 전.
        int dow = date.getDayOfWeek().getValue() % 7;  // SUN=0, MON=1, ..., SAT=6
        return date.minusDays(dow);
    }

    private int dayIndexSunBased(LocalDate date) {
        return date.getDayOfWeek().getValue() % 7;
    }

    private int[] computeWeekdayCounts(List<Todo> todos) {
        int[] arr = new int[7];
        for (Todo t : todos) {
            LocalDate d = t.getDueDate();
            if (d == null) continue;
            arr[dayIndexSunBased(d)] += 1;
        }
        return arr;
    }

    private WrapResponseDto.DayInfo computeBusiestDay(int[] counts) {
        int peak = 0;
        for (int i = 1; i < counts.length; i++) {
            if (counts[i] > counts[peak]) peak = i;
        }
        return WrapResponseDto.DayInfo.builder()
                .label(KO_DAYS[peak] + "요일")
                .count(counts[peak])
                .dayIndex(peak)
                .build();
    }

    private WrapResponseDto.TimeBuckets computeTimeBuckets(List<Todo> todos) {
        int dawn = 0, morning = 0, afternoon = 0, evening = 0;
        for (Todo t : todos) {
            LocalTime st = t.getStartTime();
            if (st == null) continue;
            int h = st.getHour();
            if (h < 6) dawn++;
            else if (h < 12) morning++;
            else if (h < 18) afternoon++;
            else evening++;
        }
        return WrapResponseDto.TimeBuckets.builder()
                .dawn(dawn).morning(morning).afternoon(afternoon).evening(evening)
                .build();
    }

    private List<WrapResponseDto.PersonInfo> computeTopPeople(List<Todo> todos, String myEmail, int limit) {
        Map<String, int[]> counts = new HashMap<>();  // email -> {count}
        Map<String, User> users = new HashMap<>();
        for (Todo t : todos) {
            if (t.getAssignees() == null) continue;
            for (User u : t.getAssignees()) {
                if (u.getEmail() == null) continue;
                if (u.getEmail().equalsIgnoreCase(myEmail)) continue;  // 본인 제외
                counts.computeIfAbsent(u.getEmail(), k -> new int[]{0})[0]++;
                users.putIfAbsent(u.getEmail(), u);
            }
        }
        return counts.entrySet().stream()
                .sorted((a, b) -> Integer.compare(b.getValue()[0], a.getValue()[0]))
                .limit(limit)
                .map(e -> {
                    User u = users.get(e.getKey());
                    return WrapResponseDto.PersonInfo.builder()
                            .name(displayName(u))
                            .count(e.getValue()[0])
                            .profileImageUrl(u.getProfileImageUrl())
                            .build();
                })
                .toList();
    }

    private WrapResponseDto.PlaceInfo computeTopPlace(List<Todo> todos) {
        List<WrapResponseDto.PlaceInfo> list = computeTopPlaces(todos, 1);
        return list.isEmpty() ? null : list.get(0);
    }

    private List<WrapResponseDto.PlaceInfo> computeTopPlaces(List<Todo> todos, int limit) {
        Map<String, Integer> counts = new HashMap<>();
        for (Todo t : todos) {
            String name = t.getLocationName();
            if (name == null || name.isBlank()) continue;
            counts.merge(name, 1, Integer::sum);
        }
        return counts.entrySet().stream()
                .sorted((a, b) -> Integer.compare(b.getValue(), a.getValue()))
                .limit(limit)
                .map(e -> WrapResponseDto.PlaceInfo.builder()
                        .name(e.getKey())
                        .count(e.getValue())
                        .build())
                .toList();
    }

    /** TOP 5 함께한 사람 — 기존 computeTopPeople 위임만 변경하지 않고 호출 측에서 limit 5로 변경. */

    private int computeMeetingMinutes(List<Todo> todos) {
        int sum = 0;
        for (Todo t : todos) {
            LocalTime s = t.getStartTime();
            LocalTime e = t.getEndTime();
            if (s == null || e == null) continue;
            int mins = (int) java.time.Duration.between(s, e).toMinutes();
            if (mins > 0) sum += mins;
        }
        return sum;
    }

    /**
     * 마일스톤은 룰 기반으로 부여.
     * - 완료율 80% 돌파
     * - 협업 챔피언: top1 사람과 3회 이상 함께
     * - 일정 증가: 지난주 대비 +5개 이상
     */
    private List<WrapResponseDto.MilestoneInfo> computeMilestones(
            int rate, List<WrapResponseDto.PersonInfo> top, int total, int prevTotal
    ) {
        List<WrapResponseDto.MilestoneInfo> out = new ArrayList<>();
        if (rate >= 80) {
            out.add(WrapResponseDto.MilestoneInfo.builder()
                    .id("complete80").emoji("🎯").label("완료율 80% 돌파").build());
        }
        if (!top.isEmpty() && top.get(0).getCount() >= 3) {
            out.add(WrapResponseDto.MilestoneInfo.builder()
                    .id("collab").emoji("🤝").label("협업 챔피언").build());
        }
        if (total - prevTotal >= 5) {
            out.add(WrapResponseDto.MilestoneInfo.builder()
                    .id("grow").emoji("📈").label("지난주보다 일정 +" + (total - prevTotal)).build());
        }
        return out;
    }

    /**
     * AI 한마디 생성. 같은 사용자 + 같은 주차는 캐시 사용 (LLM 1회만).
     * LLM 실패 시 룰 기반 폴백 (단, 폴백은 캐시 저장 X — 다음 호출에 LLM 재시도).
     */
    private String getOrGenerateComment(
            User user, java.time.LocalDate weekStart, boolean refresh, String persona,
            WrapResponseDto.DayInfo busiestDay, int rate, int prevRate, int total, int doneCount, int prevTotal,
            List<WrapResponseDto.PersonInfo> topPeople,
            WrapResponseDto.PlaceInfo topPlace,
            int meetingMinutes, double averageTodoMinutes,
            WrapResponseDto.TimeBuckets buckets,
            WrapResponseDto.StatusBreakdown status,
            WrapResponseDto.PriorityBreakdown priority,
            WrapResponseDto.RatioInfo collabRatio,
            WrapResponseDto.RatioInfo timedRatio
    ) {
        // 1) 캐시 조회 (refresh=true 면 건너뜀 + 기존 캐시 삭제)
        try {
            Optional<WrapCommentCache> cached = commentCacheRepository.findByUserAndWeekStartAndPersona(user, weekStart, persona);
            if (refresh && cached.isPresent()) {
                commentCacheRepository.delete(cached.get());
                log.info("[Wrap] comment cache evicted (refresh=true) user={} week={} persona={}", user.getEmail(), weekStart, persona);
            } else if (cached.isPresent()) {
                log.info("[Wrap] comment cache hit user={} week={} persona={}", user.getEmail(), weekStart, persona);
                return cached.get().getComment();
            }
        } catch (Exception e) {
            log.warn("[Wrap] cache lookup failed (continuing)", e);
        }

        // 2) 통계 JSON 빌드 (LLM 프롬프트로 전달)
        Map<String, Object> stats = new java.util.LinkedHashMap<>();
        stats.put("totalCount", total);
        stats.put("doneCount", doneCount);
        stats.put("completionRate", rate);
        stats.put("prevTotalCount", prevTotal);
        stats.put("prevCompletionRate", prevRate);
        stats.put("completionRateDelta", rate - prevRate);
        stats.put("totalDelta", total - prevTotal);
        if (busiestDay != null && busiestDay.getCount() > 0) {
            stats.put("busiestDay", busiestDay.getLabel() + " " + busiestDay.getCount() + "개");
        }
        if (!topPeople.isEmpty()) {
            stats.put("topPerson", topPeople.get(0).getName() + " " + topPeople.get(0).getCount() + "회");
            stats.put("topPeopleCount", topPeople.size());
        }
        if (topPlace != null) {
            stats.put("topPlace", topPlace.getName() + " " + topPlace.getCount() + "번");
        }
        if (meetingMinutes > 0) {
            stats.put("scheduledMinutes", meetingMinutes);
            stats.put("scheduledHours", Math.round(meetingMinutes / 60.0 * 10) / 10.0);
        }
        if (averageTodoMinutes > 0) {
            stats.put("averageTodoMinutes", averageTodoMinutes);
        }
        if (buckets != null) {
            Map<String, Integer> tb = new java.util.LinkedHashMap<>();
            if (buckets.getDawn() > 0) tb.put("새벽(0-6시)", buckets.getDawn());
            if (buckets.getMorning() > 0) tb.put("오전(6-12시)", buckets.getMorning());
            if (buckets.getAfternoon() > 0) tb.put("오후(12-18시)", buckets.getAfternoon());
            if (buckets.getEvening() > 0) tb.put("저녁(18-24시)", buckets.getEvening());
            if (!tb.isEmpty()) stats.put("timeBuckets", tb);
        }
        if (status != null) stats.put("status", Map.of(
                "예정", status.getTodo(),
                "진행중", status.getInProgress(),
                "완료", status.getDone()
        ));
        if (priority != null) stats.put("priority", Map.of(
                "높음", priority.getHigh(),
                "보통", priority.getMedium(),
                "낮음", priority.getLow()
        ));
        if (collabRatio != null && (collabRatio.getPrimary() + collabRatio.getSecondary() > 0)) {
            int total2 = collabRatio.getPrimary() + collabRatio.getSecondary();
            stats.put("협업비율", Math.round(collabRatio.getPrimary() * 100.0 / total2) + "%");
            stats.put("협업일정수", collabRatio.getPrimary());
            stats.put("단독일정수", collabRatio.getSecondary());
        }
        if (timedRatio != null && (timedRatio.getPrimary() + timedRatio.getSecondary() > 0)) {
            int total3 = timedRatio.getPrimary() + timedRatio.getSecondary();
            stats.put("시간정한비율", Math.round(timedRatio.getPrimary() * 100.0 / total3) + "%");
        }

        String statsJson;
        try { statsJson = om.writeValueAsString(stats); } catch (Exception e) { statsJson = "{}"; }
        log.info("[Wrap] LLM prompt stats={}", statsJson);

        // 3) LLM 호출 (외부 API — 트랜잭션 밖)
        String llmComment = callLlmForComment(statsJson, persona);

        // 4) 성공 시 캐시 저장, 실패 시 룰 기반 폴백
        if (llmComment != null && !llmComment.isBlank()) {
            try {
                WrapCommentCache cache = WrapCommentCache.builder()
                        .user(user)
                        .weekStart(weekStart)
                        .persona(persona)
                        .comment(llmComment)
                        .build();
                commentCacheRepository.save(cache);
                log.info("[Wrap] comment generated + cached user={} week={} persona={}", user.getEmail(), weekStart, persona);
            } catch (Exception e) {
                log.warn("[Wrap] cache save failed (returning anyway)", e);
            }
            return llmComment;
        }

        log.warn("[Wrap] LLM failed → rule-based fallback (not cached) user={}", user.getEmail());
        return buildSimpleComment(busiestDay, rate, total, prevTotal);
    }

    private String callLlmForComment(String statsJson, String persona) {
        try {
            String raw = chatClient.prompt()
                    .system(LlmPrompts.getWrapCommentSystem(persona))
                    .user(statsJson)
                    .call()
                    .content();
            return cleanComment(raw);
        } catch (Exception e) {
            log.error("[Wrap] LLM call failed", e);
            return null;
        }
    }

    private String cleanComment(String raw) {
        if (raw == null) return null;
        String s = raw.trim();
        // 코드블록 제거
        if (s.startsWith("```")) {
            s = s.replaceFirst("^```[a-zA-Z]*\\s*", "");
            s = s.replaceFirst("\\s*```$", "");
        }
        // 양끝 따옴표 제거
        if ((s.startsWith("\"") && s.endsWith("\"")) || (s.startsWith("'") && s.endsWith("'"))) {
            s = s.substring(1, s.length() - 1);
        }
        // 줄바꿈을 공백으로
        s = s.replaceAll("\\s+", " ").trim();
        // 200자 제한 (DB 컬럼이 500자라 여유 있음, 화면 가독성 위해 200)
        if (s.length() > 200) s = s.substring(0, 200);
        return s;
    }

    /** LLM 실패 시 폴백용 룰 기반 코멘트. */
    private String buildSimpleComment(WrapResponseDto.DayInfo busiestDay, int rate, int total, int prevTotal) {
        if (total == 0) return "이번 주는 등록된 일정이 없었어요.";
        if (rate >= 90) return busiestDay.getLabel() + "이 바빴는데 완료율 " + rate + "%, 멋져요.";
        if (rate >= 70) return busiestDay.getLabel() + " 일정 폭격, 이번 주 정말 고생하셨어요.";
        if (total - prevTotal >= 5) return "지난주보다 일정이 늘었어요. 페이스 조절도 챙겨봐요.";
        return "이번 주도 한 걸음 더 나아갔어요.";
    }

    private String displayName(User u) {
        if (u == null) return "";
        if (u.getName() != null && !u.getName().isBlank()) return u.getName();
        if (u.getEmail() == null) return "";
        int at = u.getEmail().indexOf('@');
        return at > 0 ? u.getEmail().substring(0, at) : u.getEmail();
    }

    /** 5월 1번째 주: 1~7일(첫 주) 식으로, 해당 주 일요일이 속한 달의 N번째 주. */
    private int weekOfMonth(LocalDate sun) {
        // 해당 월 1일의 요일 기반으로 주차 산정
        LocalDate firstOfMonth = sun.withDayOfMonth(1);
        int firstSunOffset = (7 - firstOfMonth.getDayOfWeek().getValue() % 7) % 7;
        LocalDate firstSun = firstOfMonth.plusDays(firstSunOffset);
        // sun 이 해당 월보다 이전 일요일이면 1주차
        if (sun.isBefore(firstSun)) return 1;
        return (int) (java.time.temporal.ChronoUnit.DAYS.between(firstSun, sun) / 7) + 1;
    }

    private String formatRangeLabel(LocalDate sun, LocalDate sat) {
        boolean sameMonth = sun.getMonthValue() == sat.getMonthValue();
        if (sameMonth) {
            return String.format("%d월 %d일 — %d일", sun.getMonthValue(), sun.getDayOfMonth(), sat.getDayOfMonth());
        }
        return String.format("%d월 %d일 — %d월 %d일",
                sun.getMonthValue(), sun.getDayOfMonth(),
                sat.getMonthValue(), sat.getDayOfMonth());
    }
}
