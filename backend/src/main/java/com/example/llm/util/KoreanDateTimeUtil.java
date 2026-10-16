package com.example.llm.util;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.TemporalAdjusters;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class KoreanDateTimeUtil {

    // 절대 날짜
    private static final Pattern P_YMD_DASH  = Pattern.compile("(\\d{4})-(\\d{1,2})-(\\d{1,2})");
    private static final Pattern P_MD_KO     = Pattern.compile("(\\d{1,2})\\s*월\\s*(\\d{1,2})\\s*일");
    private static final Pattern P_MD_SLASH  = Pattern.compile("(\\d{1,2})/(\\d{1,2})");

    // 이번주/다음주 + 요일
    private static final Pattern P_THIS_WEEK_DAY = Pattern.compile("이번\\s*주\\s*([월화수목금토일])요일?");
    private static final Pattern P_NEXT_WEEK_DAY = Pattern.compile("다음\\s*주\\s*([월화수목금토일])요일?");

    // 요일 단독 (컨텍스트 없이): "금요일", "목요일까지"
    private static final Pattern P_DAY_ONLY  = Pattern.compile("([월화수목금토일])요일");

    // N일/N주 후·뒤
    private static final Pattern P_N_DAYS    = Pattern.compile("(\\d+)\\s*일\\s*(후|뒤)");
    private static final Pattern P_N_WEEKS   = Pattern.compile("(\\d+)\\s*주\\s*(후|뒤)");

    // 상대 키워드 (lenient — 문자열 어디에 있어도 매칭)
    private static final Pattern P_TODAY     = Pattern.compile("오늘");
    private static final Pattern P_TOMORROW  = Pattern.compile("내일");
    private static final Pattern P_DAYAFTER  = Pattern.compile("모레");
    private static final Pattern P_3DAYS     = Pattern.compile("글피");
    private static final Pattern P_WEEKEND   = Pattern.compile("주말");
    private static final Pattern P_THIS_WEEK = Pattern.compile("이번\\s*주");
    private static final Pattern P_NEXT_WEEK = Pattern.compile("다음\\s*주");

    // 시간
    private static final Pattern TIME_KO     = Pattern.compile("(오전|오후)?\\s*(\\d{1,2})\\s*시\\s*(\\d{1,2})?\\s*분?");
    private static final Pattern TIME_COLON  = Pattern.compile("(\\d{1,2}):(\\d{2})");

    /**
     * 텍스트에서 날짜/시간을 파싱해 LocalDateTime 반환.
     * 날짜 단서가 없으면 null.
     */
    public static LocalDateTime resolveDueDateFromText(String text, ZoneId zoneId) {
        if (text == null) return null;
        String t = normalize(text);

        LocalDate today = LocalDate.now(zoneId);
        LocalTime time  = parseTime(t);
        if (time == null) time = LocalTime.of(9, 0);

        // 1. yyyy-MM-dd
        Matcher ymd = P_YMD_DASH.matcher(t);
        if (ymd.find()) {
            try {
                LocalDate d = LocalDate.of(safeInt(ymd.group(1), -1),
                        safeInt(ymd.group(2), -1), safeInt(ymd.group(3), -1));
                return LocalDateTime.of(d, time);
            } catch (Exception ignored) {}
        }

        // 2. M월 d일
        Matcher mdKo = P_MD_KO.matcher(t);
        if (mdKo.find()) {
            try {
                LocalDate d = LocalDate.of(today.getYear(),
                        safeInt(mdKo.group(1), -1), safeInt(mdKo.group(2), -1));
                if (d.isBefore(today.minusDays(30))) d = d.plusYears(1);
                return LocalDateTime.of(d, time);
            } catch (Exception ignored) {}
        }

        // 3. M/d
        Matcher mdSlash = P_MD_SLASH.matcher(t);
        if (mdSlash.find()) {
            try {
                LocalDate d = LocalDate.of(today.getYear(),
                        safeInt(mdSlash.group(1), -1), safeInt(mdSlash.group(2), -1));
                if (d.isBefore(today.minusDays(30))) d = d.plusYears(1);
                return LocalDateTime.of(d, time);
            } catch (Exception ignored) {}
        }

        // 4. 이번주 요일 — "이번주 금요일"
        Matcher thisWeekDay = P_THIS_WEEK_DAY.matcher(t);
        if (thisWeekDay.find()) {
            DayOfWeek target = korToDow(thisWeekDay.group(1));
            if (target != null) {
                LocalDate monday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
                return LocalDateTime.of(monday.plusDays(target.getValue() - 1), time);
            }
        }

        // 5. 다음주 요일 — "다음주 월요일"
        Matcher nextWeekDay = P_NEXT_WEEK_DAY.matcher(t);
        if (nextWeekDay.find()) {
            DayOfWeek target = korToDow(nextWeekDay.group(1));
            if (target != null) {
                LocalDate nextMonday = today.with(TemporalAdjusters.next(DayOfWeek.MONDAY));
                return LocalDateTime.of(nextMonday.plusDays(target.getValue() - 1), time);
            }
        }

        // 6. N일 후/뒤
        Matcher nDays = P_N_DAYS.matcher(t);
        if (nDays.find()) {
            int n = safeInt(nDays.group(1), -1);
            if (n > 0) return LocalDateTime.of(today.plusDays(n), time);
        }

        // 7. N주 후/뒤
        Matcher nWeeks = P_N_WEEKS.matcher(t);
        if (nWeeks.find()) {
            int n = safeInt(nWeeks.group(1), -1);
            if (n > 0) return LocalDateTime.of(today.plusWeeks(n), time);
        }

        // 8. 글피 (3일 후)
        if (P_3DAYS.matcher(t).find()) {
            return LocalDateTime.of(today.plusDays(3), time);
        }

        // 9. 주말 → 이번 주 토요일
        if (P_WEEKEND.matcher(t).find()) {
            LocalDate sat = today.with(TemporalAdjusters.nextOrSame(DayOfWeek.SATURDAY));
            return LocalDateTime.of(sat, time);
        }

        // 10. 요일 단독 (이번주/다음주 없이) → 가장 가까운 미래 해당 요일
        Matcher dayOnly = P_DAY_ONLY.matcher(t);
        if (dayOnly.find()
                && !P_THIS_WEEK.matcher(t).find()
                && !P_NEXT_WEEK.matcher(t).find()) {
            DayOfWeek target = korToDow(dayOnly.group(1));
            if (target != null) {
                LocalDate d = today.with(TemporalAdjusters.nextOrSame(target));
                return LocalDateTime.of(d, time);
            }
        }

        // 11. 상대 키워드 (오늘·내일·모레·다음주·이번주)
        LocalDate base;
        if (P_DAYAFTER.matcher(t).find()) {
            base = today.plusDays(2);
        } else if (P_TOMORROW.matcher(t).find()) {
            base = today.plusDays(1);
        } else if (P_NEXT_WEEK.matcher(t).find()) {
            base = today.with(TemporalAdjusters.next(DayOfWeek.MONDAY));
        } else if (P_THIS_WEEK.matcher(t).find()) {
            // 이번주 단독 → 이번 주 금요일
            LocalDate monday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            base = monday.plusDays(4);
        } else if (P_TODAY.matcher(t).find()) {
            base = today;
        } else {
            return null;
        }

        return LocalDateTime.of(base, time);
    }

    private static DayOfWeek korToDow(String kor) {
        return switch (kor) {
            case "월" -> DayOfWeek.MONDAY;
            case "화" -> DayOfWeek.TUESDAY;
            case "수" -> DayOfWeek.WEDNESDAY;
            case "목" -> DayOfWeek.THURSDAY;
            case "금" -> DayOfWeek.FRIDAY;
            case "토" -> DayOfWeek.SATURDAY;
            case "일" -> DayOfWeek.SUNDAY;
            default   -> null;
        };
    }

    private static LocalTime parseTime(String text) {
        if (text == null) return null;

        Matcher m1 = TIME_COLON.matcher(text);
        if (m1.find()) {
            int h = safeInt(m1.group(1), -1), min = safeInt(m1.group(2), -1);
            if (h >= 0 && h <= 23 && min >= 0 && min <= 59) return LocalTime.of(h, min);
        }

        Matcher m2 = TIME_KO.matcher(text);
        if (m2.find()) {
            String ampm = m2.group(1);
            int h   = safeInt(m2.group(2), -1);
            int min = m2.group(3) == null ? 0 : safeInt(m2.group(3), 0);
            if (h < 0 || h > 23) return null;
            if ("오후".equals(ampm) && h < 12) h += 12;
            if ("오전".equals(ampm) && h == 12) h = 0;
            if (h >= 0 && h <= 23 && min >= 0 && min <= 59) return LocalTime.of(h, min);
        }

        return null;
    }

    public static String toIsoDate(LocalDateTime dt) {
        return dt == null ? null : dt.toLocalDate().format(DateTimeFormatter.ISO_DATE);
    }

    public static boolean isTooOld(String isoDate, ZoneId zoneId, int daysBack) {
        if (isoDate == null || isoDate.isBlank()) return false;
        try {
            return LocalDate.parse(isoDate).isBefore(LocalDate.now(zoneId).minusDays(daysBack));
        } catch (Exception e) {
            return true;
        }
    }

    public static boolean isTooOld(LocalDate d, ZoneId zoneId, int daysBack) {
        if (d == null) return false;
        return d.isBefore(LocalDate.now(zoneId).minusDays(daysBack));
    }

    private static String normalize(String s) {
        return s.replaceAll("\\s+", " ").trim();
    }

    private static int safeInt(String s, int def) {
        try { return Integer.parseInt(s); } catch (Exception e) { return def; }
    }
}
