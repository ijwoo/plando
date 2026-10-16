import { alpha } from "@mui/material/styles";

import { isSameDay } from "../utils/calendarUtils.js";

/**
 * 캘린더 이벤트/날짜 칸 스타일.
 *
 * 예전엔 여기에 EVENT_TONE이라는 자체 색 맵(TODO/IN_PROGRESS/DONE 3종 + 다크 전용 hex)이
 * 있었다. 문제가 두 가지였다:
 *  1) **커스텀 상태가 전부 빨강으로 렌더됐다.** 맵에 없는 statusKey는 TODO로 폴백했는데,
 *     이 앱은 워크플로우 상태를 사용자가 직접 만들 수 있다(설정 > 워크플로우 상태).
 *  2) tone.js / StatusContext.toneOf 와 별개인 **네 번째 색 체계**였다.
 *
 * 지금은 색 결정을 호출측(StatusContext)에 위임한다. resolveTone(statusKey) 하나만 받으면
 * 커스텀 상태의 사용자 지정 색까지 그대로 따라간다.
 */

/**
 * @param event        react-big-calendar 이벤트 (resource.status / resource.doneAt 사용)
 * @param resolveTone  (statusKey) => { color, bg } — StatusContext.toneOf 로 만든 해석기
 */
export function getCalendarEventProps(event, resolveTone) {
    const status = event?.resource?.status;
    const tone = resolveTone(status);

    // 완료 판정은 doneAt 우선 — 커스텀 완료 상태(statusKey !== 'DONE')도 완료로 잡힌다.
    const done = Boolean(event?.resource?.doneAt) || status === "DONE";

    return {
        style: {
            backgroundColor: tone.bg,
            border: "none",
            color: tone.color,
            borderRadius: 7,
            fontWeight: 600,
            boxShadow: "none",
            // 완료된 일정은 취소선 — 목록/보드와 같은 처리 (예전엔 캘린더에만 없었다)
            textDecoration: done ? "line-through" : "none",
            opacity: done ? 0.72 : 1,
        },
    };
}

export function getCalendarDayProps(dateValue, theme) {
    if (isSameDay(dateValue, new Date())) {
        return {
            style: {
                backgroundColor: alpha(
                    theme.palette.primary.main,
                    theme.palette.mode === "dark" ? 0.08 : 0.05,
                ),
            },
        };
    }
    return {};
}
