package com.example.todo.service;

import com.example.llm.util.KoreanDateTimeUtil;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 한 문장 → 할 일 초안.
 *
 * 왜 서버에 두는가: 같은 규칙이 앱(parseKoreanTask.ts)·시리 인텐트(Swift)에 각각 있으면
 * **세 벌이 조용히 어긋난다.** 시리로 "내일 3시"라고 했을 때와 앱에 같은 문장을 적었을 때
 * 결과가 다르면 사용자는 무엇이 맞는지 알 수 없다. 날짜 해석은 이미 서버에 있으므로
 * (KoreanDateTimeUtil, AI 가 쓰던 것) 그것을 그대로 쓴다.
 *
 * 여기서 하는 일은 둘뿐이다: 마감을 뽑고, **그 말을 제목에서 걷어낸다.**
 * 걷어내지 않으면 제목이 "내일 3시 킥오프 미팅" 이 되어, 마감을 따로 갖고 있으면서도
 * 목록에 날짜가 두 번 나온다.
 */
@Service
public class QuickCaptureService {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    /** 제목에서 걷어낼 시간 표현. 날짜 파서가 이미 읽은 말들이라 제목에 남을 이유가 없다. */
    private static final Pattern[] STRIP = {
            Pattern.compile("\\d{4}[-/.]\\d{1,2}[-/.]\\d{1,2}"),
            Pattern.compile("\\d{1,2}\\s*월\\s*\\d{1,2}\\s*일"),
            Pattern.compile("(이번주|다음주|담주)\\s*[월화수목금토일]요일"),
            Pattern.compile("(오늘|내일|모레|글피)"),
            Pattern.compile("(이번주|다음주|담주|이번달|다음달)"),
            Pattern.compile("[월화수목금토일]요일"),
            Pattern.compile("(오전|오후)?\\s*\\d{1,2}\\s*시(\\s*\\d{1,2}\\s*분?)?"),
            Pattern.compile("까지"),
    };

    /** 우선순위 말 — 뽑아 쓰고 제목에서는 걷어낸다. */
    private static final Pattern HIGH = Pattern.compile("(급하게|급함|긴급|중요|우선)");
    private static final Pattern LOW  = Pattern.compile("(천천히|나중에|여유)");

    public record Draft(String title, String dueDate, String startTime, String priority) {}

    public Draft parse(String raw) {
        String text = raw == null ? "" : raw.trim();
        if (text.isEmpty()) return new Draft("", null, null, "MEDIUM");

        LocalDateTime due = KoreanDateTimeUtil.resolveDueDateFromText(text, KST);

        String priority = HIGH.matcher(text).find() ? "HIGH"
                : LOW.matcher(text).find() ? "LOW" : "MEDIUM";

        String title = text;
        for (Pattern p : STRIP) title = p.matcher(title).replaceAll(" ");
        title = HIGH.matcher(title).replaceAll(" ");
        title = LOW.matcher(title).replaceAll(" ");
        title = title.replaceAll("\\s+", " ").trim();
        /* 다 걷어내면 제목이 빈다("내일까지" 만 말한 경우). 그때는 원문을 쓴다 —
           제목 없는 할 일보다 날짜가 겹쳐 보이는 쪽이 낫다. */
        if (title.isEmpty()) title = text;

        // 시간을 실제로 말했을 때만 시작 시간을 잡는다. 파서는 없으면 09:00 을 넣는다.
        boolean saidTime = Pattern.compile("(오전|오후)?\\s*\\d{1,2}\\s*시").matcher(text).find();
        String startTime = (due != null && saidTime)
                ? String.format("%02d:%02d", due.getHour(), due.getMinute()) : null;

        return new Draft(title, due == null ? null : KoreanDateTimeUtil.toIsoDate(due), startTime, priority);
    }
}
