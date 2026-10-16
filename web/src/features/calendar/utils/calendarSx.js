import { blurSx } from "../../../shared/ui/glassSx.js";
import { Z } from "../../../shared/ui/zIndex.js";

export function getCalendarSx(isDark, isMobile = false) {
    // 데스크탑: 에어리 미니멀 — 연한 구분선/투명 헤더/off-range 회색칠 제거. 모바일은 기존 유지.
    const border = isDark ? "rgba(255,255,255,0.08)" : (isMobile ? "rgba(60,60,67,0.13)" : "#e4e9f1");
    const softBorder = isDark ? (isMobile ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.06)") : (isMobile ? "rgba(60,60,67,0.08)" : "#eef1f6");
    const panelBg = isMobile
        ? (isDark ? "rgba(13,13,26,0.75)" : "rgba(255,255,255,0.80)")
        : (isDark ? "rgba(15, 23, 42, 0.72)" : "#ffffff");
    const cellBg = isMobile
        ? (isDark ? "rgba(255,255,255,0.01)" : "rgba(255,255,255,0.40)")
        : (isDark ? "rgba(255,255,255,0.015)" : "#ffffff");
    // 헤더 배경: 모바일만 채우고 데스크탑은 투명.
    const headerBg = isMobile
        ? (isDark ? "rgba(255,255,255,0.03)" : "rgba(242,242,247,0.95)")
        : "transparent";
    const todayBg = "var(--plando-primary-soft)"; // 테마 primary를 따라간다(고정 파랑이었음)
    const hoverBg = isDark ? "rgba(255,255,255,0.05)" : "#f8fbff";
    // off-range(이전/다음달) 셀: 모바일만 회색칠, 데스크탑은 칠 없이 숫자만 흐리게.
    const offBg = isMobile ? (isDark ? "rgba(255,255,255,0.025)" : "#E8EAED") : "transparent";
    const textMain = isDark ? "#E8EAED" : "#0f172a";
    const textSub = isDark ? "rgba(255,255,255,0.68)" : "#64748b";
    const textMuted = isDark ? "rgba(255,255,255,0.28)" : "#94a3b8";

    return {
        height: { xs: 360, sm: 400, md: "calc(100dvh - 175px)" },

        "& .rbc-toolbar": {
            display: "none",
        },

        "& .rbc-calendar": {
            fontFamily: "inherit",
            color: textMain,
            backgroundColor: "transparent",
        },

        "& .rbc-month-view, & .rbc-time-view, & .rbc-agenda-view": {
            overflow: "hidden",
            borderRadius: isMobile ? 0 : "20px",
            border: isMobile ? "none" : `1px solid ${border}`,
            background: panelBg,
            ...blurSx(isMobile ? "blur(32px)" : "blur(10px)"),
            boxShadow: isMobile
                ? "none"
                : (isDark
                    ? "0 8px 24px rgba(0,0,0,0.18)"
                    : "0 10px 24px rgba(15,23,42,0.06)"),
        },

        "& .rbc-header": {
            padding: isMobile ? "5px 4px" : "13px 8px",
            fontWeight: isMobile ? 800 : 600,
            fontSize: isMobile ? 14 : 12.5,
            letterSpacing: isMobile ? 0 : "0.02em",
            textAlign: "center",
            color: isMobile ? textMain : textSub,
            borderBottom: isMobile ? "none" : `1px solid ${softBorder}`,
            backgroundColor: isMobile ? "transparent" : headerBg,
        },

        // 요일 헤더 — 일요일 빨강, 토요일 파랑 (모바일/데스크탑 공통)
        "& .rbc-header:first-of-type": {
            color: "var(--plando-red)",
        },
        "& .rbc-header:last-of-type": {
            color: "var(--plando-primary)",
        },

        "& .rbc-header + .rbc-header": {
            borderLeft: isMobile ? "none" : `1px solid ${softBorder}`,
        },

        "& .rbc-month-row": {
            minHeight: isMobile ? 44 : undefined,
        },

        // 모바일: 이벤트 바 숨김 (dot indicator 방식 사용)
        ...(isMobile ? {
            "& .rbc-row-content .rbc-row + .rbc-row": { display: "none" },
            "& .rbc-show-more": { display: "none" },
        } : {}),

        "& .rbc-month-row + .rbc-month-row": {
            borderTop: `1px solid ${softBorder}`,
        },

        "& .rbc-day-bg": {
            backgroundColor: cellBg,
            transition: "background-color 0.18s ease",
        },

        "& .rbc-day-bg + .rbc-day-bg": {
            borderLeft: isMobile ? "none" : `1px solid ${softBorder}`,
        },

        "& .rbc-day-bg:hover": {
            backgroundColor: hoverBg,
        },

        // 오늘: 데스크탑은 셀 전체 틴트 없이 숫자 pill만(아래 rbc-today .rbc-date-cell>a). 모바일은 기존 셀 틴트.
        "& .rbc-today": {
            backgroundColor: isMobile ? todayBg : "transparent",
        },

        "& .rbc-off-range-bg": {
            backgroundColor: offBg,
        },

        "& .rbc-off-range": {
            color: textMuted,
        },

        "& .rbc-off-range .rbc-date-cell > a": {
            color: textMuted,
        },

        "& .rbc-date-cell": {
            padding: isMobile ? "4px 0 2px" : "10px 10px 4px",
            textAlign: isMobile ? "center" : "left",
            fontWeight: isMobile ? 800 : 600,
            fontSize: isMobile ? 13 : 16,
            color: textMain,
        },

        "& .rbc-date-cell > a": {
            color: "inherit",
            textDecoration: "none",
        },

        // 날짜 숫자 — 일요일 빨강 / 토요일 파랑.
        // off-range(이전/다음달) 일·토는 위쪽 `& .rbc-off-range .rbc-date-cell > a` 룰이
        // specificity(0,2,1)로 이겨 muted 유지. 여기 셀렉터는 (0,2,0)로 일부러 낮게 유지.
        "& .rbc-date-cell:first-of-type": {
            color: "var(--plando-red)",
        },
        "& .rbc-date-cell:last-of-type": {
            color: "var(--plando-primary)",
        },

        // 오늘 날짜 숫자: 데스크탑은 브랜드 컬러 채운 원형 pill(흰 숫자), 모바일은 기존 연한 틴트.
        "& .rbc-today .rbc-date-cell > a": {
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: isMobile ? 24 : 28,
            height: isMobile ? 24 : 28,
            padding: isMobile ? "0 6px" : 0,
            borderRadius: 999,
            fontWeight: 700,
            // 테마 8종을 따라야 한다 — 예전엔 모바일 경로가 고정 파랑(rgba(59,130,246,…))이라
            // 핑크·민트·오션 테마에서도 오늘 칩만 파랗게 남았다.
            backgroundColor: isMobile ? "var(--plando-primary-soft-2)" : "var(--plando-primary)",
            // 다크 primary는 파스텔 블루(#8AB4F8) → 흰 글씨 대비 부족하므로 어두운 글씨.
            color: isMobile ? "var(--plando-primary)" : (isDark ? "#0A0A0F" : "#ffffff"),
            boxShadow: isMobile ? "none" : "var(--plando-shadow-1)",
        },

        "& .rbc-row-content": {
            padding: isMobile ? "0 2px 2px" : "0 4px 4px",
            zIndex: Z.STICKY,
        },

        "& .rbc-row-segment": {
            padding: isMobile ? "0 1px 1px" : "0 2px 2px",
        },

        "& .rbc-event": {
            minHeight: isMobile ? 18 : 23,
            padding: isMobile ? "1px 4px" : "3px 8px",
            borderRadius: isMobile ? 8 : 7,
            border: "none",
            backgroundColor: "var(--plando-red-soft)",
            color: "var(--plando-red)",
            fontWeight: 600,
            fontSize: isMobile ? 10.5 : 11.5,
            boxShadow: "none",
            transition: "filter 0.15s ease, transform 0.15s ease",
        },

        ...(isMobile ? {} : {
            "& .rbc-event:hover": {
                filter: isDark ? "brightness(1.12)" : "brightness(0.96)",
            },
        }),

        "& .rbc-event-content": {
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            lineHeight: 1.1,
        },

        "& .rbc-selected": {
            boxShadow: isDark
                ? "0 0 0 1px rgba(255,255,255,0.08)"
                : "0 0 0 1px rgba(15,23,42,0.05)",
        },

        "& .rbc-show-more": {
            display: "block !important",
            marginTop: isMobile ? 1 : 2,
            padding: isMobile ? "1px 4px" : "2px 6px",
            fontWeight: 700,
            fontSize: isMobile ? 10 : 11,
            lineHeight: 1.3,
            color: "var(--plando-primary)",
            backgroundColor: "transparent",
            textDecoration: "none",
            cursor: "pointer",
            zIndex: Z.STICKY,
            position: "relative",
        },

        "& .rbc-time-header-content, & .rbc-time-content": {
            minWidth: 0,
            borderColor: border,
        },

        "& .rbc-time-slot": {
            borderTop: `1px solid ${softBorder}`,
        },

        "& .rbc-timeslot-group": {
            borderBottom: `1px solid ${softBorder}`,
        },

        "& .rbc-label": {
            color: textSub,
            fontSize: 12,
        },

        "& .rbc-current-time-indicator": {
            backgroundColor: "var(--plando-primary)",
            height: 2,
        },

        "& .rbc-agenda-view table.rbc-agenda-table": {
            borderColor: border,
            color: textMain,
            backgroundColor: "transparent",
        },

        "& .rbc-agenda-view table.rbc-agenda-table thead > tr > th": {
            padding: "12px 10px",
            fontWeight: 800,
            borderBottom: `1px solid ${border}`,
            backgroundColor: headerBg,
        },

        "& .rbc-agenda-view table.rbc-agenda-table tbody > tr > td": {
            padding: "12px 10px",
            borderTop: `1px solid ${softBorder}`,
            backgroundColor: cellBg,
        },

        "& .rbc-slot-selection": {
            backgroundColor: "var(--plando-primary-soft)",
            border: "1px dashed var(--plando-primary)",
            color: "var(--plando-primary)",
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 600,
            padding: "2px 6px",
        },

        "& .rbc-selected-cell": {
            backgroundColor: "var(--plando-primary-soft)",
            opacity: 0.5,
        },

        /* "+N개 더" 팝오버. 예전엔 흰 배경(#ffffff)·검은 글자(#0f172a)·빨간 이벤트(#991b1b)가
           하드코딩돼 있어 **다크 모드에서 흰 판이 그대로 떴고**, 팝오버 안의 일정은 상태와
           무관하게 전부 빨강이었다. 토큰으로 교체 — 이벤트 색은 eventPropGetter가 이미 인라인으로
           칠하므로 여기서 color를 덮어쓰지 않는다. */
        "& .rbc-overlay": {
            backgroundColor: "var(--plando-surface)",
            border: "1px solid var(--plando-border)",
            borderRadius: 12,
            boxShadow: "var(--plando-shadow-3)",
            padding: "8px 0",
            zIndex: Z.POPOVER,
        },

        "& .rbc-overlay-header": {
            padding: "6px 12px 8px",
            fontWeight: 800,
            fontSize: 13,
            color: "var(--plando-text-primary)",
            borderBottom: "1px solid var(--plando-border)",
            marginBottom: 4,
        },

        "& .rbc-overlay .rbc-event": {
            margin: "2px 8px",
        },

        "& .rbc-addons-dnd-drag-preview": {
            backgroundColor: "var(--plando-primary-soft-2)",
            border: "1px solid var(--plando-primary-soft-2)",
            color: "var(--plando-primary)",
            borderRadius: 12,
            boxShadow: "none",
        },

        // ── 목록 뷰 빈 상태 ──────────────────────────────────────────
        "& .rbc-agenda-view": {
            position: "relative",
        },
        "& .rbc-agenda-empty": {
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "10px",
            color: textMuted,
            fontSize: "14px",
            fontWeight: 600,
            letterSpacing: "-0.015em",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            userSelect: "none",
        },
    };
}