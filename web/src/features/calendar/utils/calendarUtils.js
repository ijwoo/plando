// moment locale 의존 없이 한국어 문자열을 직접 조립한다.
// (react-big-calendar localizer는 moment를 사용하지만, format 콜백이 함수면
//  콜백 결과를 그대로 사용하므로 locale 영향을 받지 않음)
const KO_DAYS_SHORT = ["일", "월", "화", "수", "목", "금", "토"];

function pad2(n) {
    return String(n).padStart(2, "0");
}

function koAmPmTime(date) {
    const h = date.getHours();
    const min = date.getMinutes();
    const ampm = h < 12 ? "오전" : "오후";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${ampm} ${h12}:${pad2(min)}`;
}

function koMonthDay(date) {
    return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function koYearMonthDay(date) {
    return `${date.getFullYear()}년 ${koMonthDay(date)}`;
}

export function toDateFromYmd(ymd) {
    if (!ymd) return null;
    const d = new Date(`${ymd}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
}

export function toYmd(date) {
    if (!date) return "";
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

export function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

import { isSameDay } from "../../../shared/utils/formatters.js";

export { isSameDay };

/**
 * 이벤트가 걸치는 모든 날짜(자정 기준 Date)에 대해 visit 콜백을 호출한다.
 * 종일 이벤트의 exclusive end(다음날 00:00) 규약을 보정 —
 * MobileMonthView/MobileCalendarMonthGrid의 스팬 로직과 동일한 규칙.
 */
export function forEachEventDay(event, visit) {
    const rawStart = event.start instanceof Date ? event.start : new Date(event.start);
    let end = event.end
        ? (event.end instanceof Date ? event.end : new Date(event.end))
        : rawStart;
    // exclusive end 보정: 자정(00:00)에 끝나면 실제 마지막 날은 그 전날
    if (
        end.getHours() === 0 && end.getMinutes() === 0 && end.getSeconds() === 0 &&
        !isSameDay(rawStart, end)
    ) {
        end = new Date(end.getTime() - 60 * 1000);
    }
    const cur = new Date(rawStart);
    cur.setHours(0, 0, 0, 0);
    const last = new Date(end);
    last.setHours(0, 0, 0, 0);
    if (last < cur) {
        // 비정상 데이터(end < start) 방어 — 최소한 시작일에는 표시
        visit(new Date(cur));
        return;
    }
    // 안전장치: 비정상적으로 긴 범위로 인한 과도한 루프 방지 (2년 상한)
    for (let i = 0; cur <= last && i < 731; i++) {
        visit(new Date(cur));
        cur.setDate(cur.getDate() + 1);
    }
}

/**
 * 자정을 넘는 시간(timed) 이벤트를 특정 날짜 구간으로 클리핑한 사본을 반환.
 * (하루 단위 타임라인은 wall-clock 시각으로 배치하므로, 각 날짜에는
 *  해당 날짜 구간만 보여야 함 — 예: 22:00→익일 01:00은 22:00–23:59 / 00:00–01:00)
 * 해당 날짜 안에 온전히 들어가면 원본을 그대로 반환한다.
 */
export function clipTimedEventToDay(event, day) {
    const start = event.start instanceof Date ? event.start : new Date(event.start);
    const end = event.end
        ? (event.end instanceof Date ? event.end : new Date(event.end))
        : start;
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 0, 0);
    if (start >= dayStart && end <= dayEnd) return event; // 클리핑 불필요
    const segStart = start > dayStart ? start : dayStart;
    const segEnd = end < dayEnd ? end : dayEnd;
    if (segEnd <= segStart) return event; // 해당 날짜에 걸치지 않음(방어) — 원본 유지
    return { ...event, start: segStart, end: segEnd };
}

export function formatCalendarTitle(date) {
    if (!date) return "";
    const yyyy = date.getFullYear();
    const mm = date.getMonth() + 1;
    return `${yyyy}년 ${mm}월`;
}

export function formatWeekdayShort(date) {
    return KO_DAYS_SHORT[date.getDay()];
}

export function getCalendarFormats() {
    // react-big-calendar의 format 콜백이 함수면 콜백 반환값을 그대로 사용하므로
    // moment locale에 의존하지 않고 한국어 문자열을 직접 만든다.
    const fmtTime = (date) => koAmPmTime(date);
    const fmtTimeRange = ({ start, end }) =>
        `${koAmPmTime(start)} – ${koAmPmTime(end)}`;

    const dateRangeKo = ({ start, end }) => {
        const sameYear = start.getFullYear() === end.getFullYear();
        const sameMonth = sameYear && start.getMonth() === end.getMonth();
        if (sameMonth) {
            return `${koYearMonthDay(start)} – ${end.getDate()}일`;
        }
        if (sameYear) {
            return `${koYearMonthDay(start)} – ${koMonthDay(end)}`;
        }
        return `${koYearMonthDay(start)} – ${koYearMonthDay(end)}`;
    };

    return {
        weekdayFormat: (date) => formatWeekdayShort(date),
        // 주 뷰 컬럼 헤더 (예: "월 5/26")
        dayFormat: (date) =>
            `${formatWeekdayShort(date)} ${date.getMonth() + 1}/${date.getDate()}`,
        // 일 뷰 제목 (예: "2026년 5월 27일 (수)")
        dayHeaderFormat: (date) =>
            `${koYearMonthDay(date)} (${formatWeekdayShort(date)})`,
        // 주 뷰 제목 (예: "2026년 5월 25일 – 31일")
        dayRangeHeaderFormat: dateRangeKo,
        monthHeaderFormat: (date) => `${date.getFullYear()}년 ${date.getMonth() + 1}월`,
        // 시간 거터 (왼쪽 시간 축, 예: "오전 9:00")
        timeGutterFormat: fmtTime,
        // 이벤트 시간 범위
        eventTimeRangeFormat: fmtTimeRange,
        eventTimeRangeStartFormat: ({ start }) => fmtTime(start),
        eventTimeRangeEndFormat: ({ end }) => fmtTime(end),
        // 슬롯 드래그 선택 시 표시되는 시간 범위
        selectRangeFormat: fmtTimeRange,
        // 목록(agenda) 헤더 (예: "2026년 5월 28일 – 6월 4일")
        agendaHeaderFormat: dateRangeKo,
        agendaDateFormat: (date) =>
            `${koMonthDay(date)} (${formatWeekdayShort(date)})`,
        agendaTimeFormat: fmtTime,
        agendaTimeRangeFormat: fmtTimeRange,
    };
}

/**
 * Todo -> react-big-calendar Event
 * startTime/endTime이 있으면 시간 이벤트, 없으면 종일 이벤트
 */
export function toCalendarEvent(todo) {
    const s = toDateFromYmd(todo.startAt);
    const e = toDateFromYmd(todo.dueDate);
    if (!s && !e) return null;

    if (todo.startTime) {
        const [sh, sm] = todo.startTime.split(":").map(Number);
        const startDate = new Date(s ?? e);
        startDate.setHours(sh, sm, 0, 0);

        let endDate;
        if (todo.endTime) {
            const [eh, em] = todo.endTime.split(":").map(Number);
            endDate = new Date(e ?? s);
            endDate.setHours(eh, em, 0, 0);
        } else {
            endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
        }

        return {
            id: todo.id,
            title: todo.title,
            start: startDate,
            // 종료가 시작보다 앞이면(날짜가 뒤집힌 경우 포함) 최소 1시간짜리로 그린다
            end: endDate > startDate ? endDate : new Date(startDate.getTime() + 60 * 60 * 1000),
            allDay: false,
            resource: todo,
        };
    }

    /* 시작일이 마감일보다 뒤인 데이터가 실제로 들어온다(입력을 막지 못하던 시절의 것 포함).
       그대로 두면 end < start 가 되어 react-big-calendar 가 **어느 칸에도 안 그린다** —
       목록에는 있는데 캘린더에서만 사라져서 사용자가 원인을 찾을 수 없다.
       뒤집힌 범위는 바로잡아 그린다. 잘못 저장된 데이터를 안 보여주는 것보다 낫다. */
    const rawStart = s ?? e;
    const rawEnd = e ?? s;
    const inverted = rawStart && rawEnd && rawStart > rawEnd;
    const start = inverted ? rawEnd : rawStart;
    const endBase = inverted ? rawStart : rawEnd;
    const end = addDays(endBase, 1);

    return {
        id: todo.id,
        title: todo.title,
        start,
        end,
        allDay: true,
        resource: todo,
    };
}