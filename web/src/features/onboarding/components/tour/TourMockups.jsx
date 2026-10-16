import React, { useEffect, useRef, useState } from "react";
import { Box, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { motion, AnimatePresence } from "framer-motion";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import LocationOnRoundedIcon from "@mui/icons-material/LocationOnRounded";
import NotificationsActiveRoundedIcon from "@mui/icons-material/NotificationsActiveRounded";
import ChatBubbleRoundedIcon from "@mui/icons-material/ChatBubbleRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import { statusColor, readableOn } from "../../../../shared/ui/tone.js";
import { PriorityPill } from "../../../../shared/ui/common/Chips.jsx";
import useLoopPhase from "../../hooks/useLoopPhase.js";
import { useTourReduced } from "../../hooks/useTourMotion.jsx";
import { getTourTokens, mockCardSx } from "./tourTokens.js";

/* ─────────────────────────────────────────────────────────────
   데스크탑 온보딩 투어의 미니 목업들.

   전부 코드로 그린 축소판이다 — 스크린샷 에셋 없음. 이유는 tourTokens.js 주석 참고
   (UI 리디자인 중 + 테마 8종 + 번들 크기). ThemePreview.jsx가 같은 접근의 선례.

   모션 규칙
   - 진입 애니메이션은 0.3~0.5s stagger, 루프는 useLoopPhase로만.
   - prefers-reduced-motion이면 모든 진입/루프를 끄고 **완성된 정적 상태**를 그린다.
     (각 목업의 `reduced` 분기 — initial={false} + phase 고정)

   드래그앤드롭 데모 규칙 (보드 / 캘린더)
   - 페이즈 테이블(BOARD_DRAG / CAL_DRAG)로 "대기 → 집기 → 이동 → 놓기 → 정착" 5단계를
     같은 틱으로 돌린다. 마지막 페이즈가 **드롭이 끝난 결과 화면**이라 reduced-motion에서
     useLoopPhase가 마지막에 고정돼도 그대로 정답이 된다.
   - 칸↔칸 "직선 이동"은 layoutId 공유 레이아웃이 맡고, 그 위에 얹히는 들어올림(scale/rotate)과
     살짝 뜨는 호(arc)는 안쪽 DragLift가 맡는다. 전부 transform/opacity — 그리드는 건드리지 않는다.
   - 한 바퀴 돌아 원위치로 되돌아가는 프레임은 `transition.layout.duration = 0`으로 끊어서
     "거꾸로 드래그되는" 역재생이 보이지 않게 한다.
   ───────────────────────────────────────────────────────────── */

const EASE = [0.2, 0.8, 0.2, 1];

/** OS의 reduce 신호 + 사용자가 투어 안에서 켠 선택까지 반영한 최종 판정. */
function useReduced() {
    return useTourReduced();
}

/**
 * 마운트 직후 첫 렌더에서만 true.
 * layoutId로 칸을 옮길 때 카드가 재마운트되면서 진입 애니메이션이 다시 재생되는 걸 막는다.
 */
function useFirstRender() {
    const ref = useRef(true);
    useEffect(() => {
        ref.current = false;
    }, []);
    return ref.current;
}

/* ── 드래그 데모 공통 조각 ───────────────────────────────── */

/** clip-path로 그린 마우스 커서 화살표. 색은 text.primary 파생이라 테마를 그대로 탄다. */
const CURSOR_CLIP = "polygon(0% 0%, 0% 76%, 24% 58%, 42% 96%, 60% 88%, 42% 52%, 72% 50%)";

/**
 * 드래그하는 손 역할의 포인터. 드래그되는 카드 **안쪽**에 절대배치돼 카드와 함께 이동한다.
 * state: near(다가옴) · hover(카드 위) · grab(집음) · drag(끌고 감) · drop(놓음) · off(사라짐)
 */
function DragCursor({ k, state }) {
    const pressed = state === "grab" || state === "drag";
    // 집는 순간과 놓는 순간에만 링을 새로 마운트해 한 번씩 퍼지게 한다.
    const ring = state === "grab" ? "grab" : state === "drop" ? "drop" : null;

    return (
        <Box
            component={motion.div}
            initial={false}
            animate={{
                opacity: state === "off" ? 0 : 1,
                x: state === "near" ? 7 : 0,
                y: state === "near" ? 7 : 0,
                scale: pressed ? 0.84 : 1,
            }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            sx={{
                position: "absolute",
                right: -4,
                bottom: -9,
                width: 13,
                height: 15,
                zIndex: 4,
                pointerEvents: "none",
            }}
        >
            <AnimatePresence>
                {ring && (
                    <Box
                        key={ring}
                        component={motion.div}
                        initial={{ scale: 0.35, opacity: 0.6 }}
                        animate={{ scale: 1.7, opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.52, ease: EASE }}
                        sx={{
                            position: "absolute",
                            left: -5,
                            top: -4,
                            width: 22,
                            height: 22,
                            borderRadius: "50%",
                            border: `1.5px solid ${k.accent}`,
                        }}
                    />
                )}
            </AnimatePresence>
            <Box
                sx={{
                    width: 13,
                    height: 15,
                    bgcolor: k.text,
                    clipPath: CURSOR_CLIP,
                    filter: "drop-shadow(var(--plando-elev-3))",
                }}
            />
        </Box>
    );
}

/** 들어올린 카드 밑에 깔리는 그림자 — opacity만 바뀌므로 레이아웃/리플로우가 없다. */
function LiftShadow({ strength = 0, radius = "var(--plando-radius-sm)", shadow = "var(--plando-shadow-4)" }) {
    return (
        <Box
            component={motion.div}
            initial={false}
            animate={{ opacity: strength }}
            transition={{ duration: 0.22, ease: EASE }}
            sx={{
                position: "absolute",
                inset: 0,
                borderRadius: radius,
                boxShadow: shadow,
                pointerEvents: "none",
            }}
        />
    );
}

/**
 * 커서를 올렸을 때의 살짝 뜸(hover) + 집어올림(scale·tilt) + 이동 중 호(arc) + 착지 스프링 래퍼.
 * 바깥 layoutId가 A칸→B칸 직선 이동을, 여기가 그 위에 얹히는 "손맛"을 맡는다.
 */
function DragLift({ hover, lift, travelling, scale = 1.08, tilt = -3, hop = 8, hoverY = 2, duration = 0.62, children }) {
    return (
        <Box
            component={motion.div}
            initial={false}
            animate={{
                scale: lift ? scale : 1,
                rotate: lift ? tilt : 0,
                y: travelling ? [0, -hop, 0] : hover ? -hoverY : 0,
            }}
            transition={{
                // 놓을 때만 스프링 — 툭 내려앉는 느낌.
                scale: lift ? { duration: 0.2, ease: EASE } : { type: "spring", stiffness: 520, damping: 22 },
                rotate: { duration: 0.24, ease: EASE },
                y: travelling ? { duration, ease: EASE } : { duration: 0.2, ease: EASE },
            }}
            sx={{ position: "relative", transformOrigin: "50% 50%" }}
        >
            {children}
        </Box>
    );
}

/* ── reduced-motion 전용 정적 드래그 설명 조각 ─────────────
   prefers-reduced-motion이면 루프가 마지막(=드롭이 끝난) 페이즈에 고정돼서 "완성된 화면"만
   남는다. 그러면 카피가 약속한 **드래그앤드롭**이 하나도 설명되지 않는다.
   그래서 모션 대신 **정적 합성**으로 제스처를 설명한다:
     출발지에 남은 점선 잔상 → 점선 커넥터(꺾인 선 + 화살촉) → 도착지 강조.
   전부 plain Box(모션 컴포넌트 아님) + 절대배치라 애니메이션도, 레이아웃 영향도 없다. */

/** 커넥터 옆에 붙는 작은 설명 칩. */
function DragHintChip({ k, sx }) {
    return (
        <Box
            sx={{
                position: "absolute",
                zIndex: 3,
                pointerEvents: "none",
                whiteSpace: "nowrap",
                px: 0.625,
                py: "1px",
                borderRadius: "var(--plando-radius-pill)",
                bgcolor: k.solid,
                border: `1px solid ${k.accent}`,
                color: k.accent,
                fontSize: 8,
                fontWeight: 800,
                lineHeight: 1.6,
                ...sx,
            }}
        >
            드래그해서 이동
        </Box>
    );
}

/* ── 공통 조각 ───────────────────────────────────────────── */

/** 미니 앱 창 프레임 — 상단 크롬 스트립 + 본문. */
function MockWindow({ k, children, bodySx }) {
    return (
        <Box
            sx={{
                width: "100%",
                height: "100%",
                borderRadius: "var(--plando-radius-lg)",
                border: `1px solid ${k.frameBorder}`,
                bgcolor: k.frameBg,
                boxShadow: "var(--plando-shadow-3)",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
            }}
        >
            <Box
                sx={{
                    height: 24,
                    px: 1.25,
                    display: "flex",
                    alignItems: "center",
                    gap: 0.75,
                    flexShrink: 0,
                    borderBottom: `1px solid ${k.border}`,
                }}
            >
                <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: k.accent, flexShrink: 0 }} />
                <Box sx={{ width: 32, height: 4, borderRadius: "2px", bgcolor: k.barSoft }} />
                <Box sx={{ flex: 1 }} />
                <Box sx={{ width: 16, height: 4, borderRadius: "2px", bgcolor: k.barFaint }} />
                <Box sx={{ width: 10, height: 4, borderRadius: "2px", bgcolor: k.barFaint }} />
            </Box>
            <Box sx={{ flex: 1, minHeight: 0, p: 1.25, display: "flex", flexDirection: "column", ...bodySx }}>
                {children}
            </Box>
        </Box>
    );
}

/** 목업 안 세그먼트 컨트롤(보드/목록, 월/주/일). */
function MiniSegmented({ k, items, activeIndex }) {
    return (
        <Box
            sx={{
                display: "inline-flex",
                p: "2px",
                gap: "2px",
                borderRadius: "var(--plando-radius-pill)",
                bgcolor: k.surface,
                border: `1px solid ${k.border}`,
            }}
        >
            {items.map((label, i) => (
                <Box
                    key={label}
                    sx={{
                        px: 0.875,
                        py: "2px",
                        borderRadius: "var(--plando-radius-pill)",
                        fontSize: 9,
                        fontWeight: 700,
                        lineHeight: 1.5,
                        color: i === activeIndex ? k.onAccent : k.text3,
                        bgcolor: i === activeIndex ? k.accent : "transparent",
                    }}
                >
                    {label}
                </Box>
            ))}
        </Box>
    );
}

/** 담당자 아바타 — 색은 팔레트 파생(primary/warning/success). */
function MiniAvatar({ k, color, initial, size = 16 }) {
    return (
        <Box
            sx={{
                width: size,
                height: size,
                borderRadius: "50%",
                bgcolor: color,
                color: readableOn(color),
                border: `1.5px solid ${k.solid}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: size * 0.5,
                fontWeight: 800,
                flexShrink: 0,
            }}
        >
            {initial}
        </Box>
    );
}

/* ── 1. 할 일 보드 ───────────────────────────────────────── */

/**
 * 보드 카드. done이면 체크 + 취소선이 그려진다.
 * enter=false면 진입 애니메이션을 생략한다 — layoutId로 컬럼을 이동할 때
 * 재마운트되면서 fade-in이 다시 재생돼 깜빡이는 걸 막기 위함.
 */
function MiniTaskCard({ k, label, tone, done, layoutId, layout, delay, reduced, enter = true, ghost = false }) {
    const skipEnter = reduced || !enter;
    return (
        <Box
            component={motion.div}
            layoutId={layoutId}
            layout={layout}
            initial={skipEnter ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                duration: 0.36,
                delay: skipEnter ? 0 : delay,
                ease: EASE,
                // 드롭 슬롯이 열리면서 아래로 밀릴 때 미끄러지듯 이동.
                layout: { duration: 0.32, ease: EASE },
            }}
            sx={{
                ...mockCardSx(k),
                // 잔상(ghost)은 테두리만 점선으로 바꾼다 — 굵기가 같아서 박스 크기가 그대로다.
                ...(ghost
                    ? {
                        bgcolor: "transparent",
                        borderStyle: "dashed",
                        borderColor: k.text3,
                        boxShadow: "none",
                    }
                    : null),
                px: 0.875,
                py: 0.75,
                display: "flex",
                alignItems: "center",
                gap: 0.625,
                minWidth: 0,
            }}
        >
            {done ? (
                <Box
                    component={motion.div}
                    initial={reduced ? false : { scale: 0.4 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 520, damping: 20 }}
                    sx={{
                        width: 11,
                        height: 11,
                        borderRadius: "50%",
                        bgcolor: tone,
                        color: readableOn(tone),
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                    }}
                >
                    <CheckRoundedIcon sx={{ fontSize: 8 }} />
                </Box>
            ) : (
                <Box
                    sx={{
                        width: 11,
                        height: 11,
                        borderRadius: "50%",
                        border: `1.5px solid ${tone}`,
                        flexShrink: 0,
                    }}
                />
            )}

            <Box sx={{ position: "relative", minWidth: 0 }}>
                <Typography
                    noWrap
                    sx={{ fontSize: 9.5, fontWeight: 600, lineHeight: 1.5, color: done || ghost ? k.text3 : k.text }}
                >
                    {label}
                </Typography>
                {done && (
                    <Box
                        component={motion.div}
                        initial={reduced ? false : { scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 0.3, delay: reduced ? 0 : 0.18, ease: EASE }}
                        sx={{
                            position: "absolute",
                            left: 0,
                            right: 0,
                            top: "52%",
                            height: "1px",
                            bgcolor: k.text3,
                            transformOrigin: "left center",
                        }}
                    />
                )}
            </Box>
        </Box>
    );
}

/**
 * 보드 컬럼. `highlight`면 "여기에 놓을 수 있어요" 상태 — 점선 테두리 + 옅은 accent 배경.
 * 카운트는 고정 크기 박스 안에서 굴러가므로 숫자가 바뀌어도 헤더가 흔들리지 않는다.
 */
function BoardColumnMock({ k, title, tone, count, highlight, reduced, children }) {
    return (
        <Box
            sx={{
                flex: 1,
                minWidth: 0,
                bgcolor: highlight ? k.accentFaint : k.surface,
                border: `1px ${highlight ? "dashed" : "solid"} ${highlight ? k.accent : k.border}`,
                borderRadius: "var(--plando-radius-md)",
                p: 0.75,
                display: "flex",
                flexDirection: "column",
                gap: 0.625,
                transition:
                    "background-color var(--plando-dur-base) var(--plando-ease), border-color var(--plando-dur-base) var(--plando-ease)",
            }}
        >
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 0.25 }}>
                <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: tone, flexShrink: 0 }} />
                <Typography noWrap sx={{ fontSize: 9, fontWeight: 800, color: k.text2, letterSpacing: "-0.01em" }}>
                    {title}
                </Typography>
                <Box sx={{ ml: "auto", position: "relative", width: 8, height: 13, flexShrink: 0 }}>
                    <AnimatePresence initial={false}>
                        <Box
                            key={count}
                            component={motion.div}
                            initial={reduced ? false : { opacity: 0, y: -7 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 7 }}
                            transition={{ duration: 0.24, ease: EASE }}
                            sx={{
                                position: "absolute",
                                inset: 0,
                                fontSize: 8.5,
                                fontWeight: 700,
                                color: k.text3,
                                textAlign: "right",
                                lineHeight: "13px",
                            }}
                        >
                            {count}
                        </Box>
                    </AnimatePresence>
                </Box>
            </Box>
            {children}
        </Box>
    );
}

/**
 * 카드가 내려앉을 빈 자리 — 집어든 순간 열리고, 카드가 도착하면 그대로 대체된다.
 * 높이를 맞추려고 안에 실제 카드를 visibility:hidden으로 깔아둔다 (px 하드코딩 방지).
 */
function DropSlot({ k, label, reduced }) {
    return (
        <Box
            component={motion.div}
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2, ease: EASE }}
            sx={{ position: "relative", minWidth: 0 }}
        >
            <Box sx={{ visibility: "hidden" }}>
                <MiniTaskCard k={k} label={label} tone={k.accent} reduced enter={false} />
            </Box>
            <Box
                sx={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "var(--plando-radius-sm)",
                    border: `1px dashed ${k.accent}`,
                    bgcolor: k.accentFaint,
                }}
            />
        </Box>
    );
}

/* 드래그 데모 페이즈 — 760ms 틱 × 6 = 4.56s 한 바퀴.
   at: 카드가 어느 컬럼에 있는지 · hover: 커서를 올려 살짝 뜬 상태 · lift: 집어든 상태
   target: 목적지 컬럼 하이라이트 · slot: 목적지에 빈 자리를 염 · ghost: 출발지에 남는 잔상 */
const BOARD_TICK = 760;
const BOARD_DROP_AT = 4;   // 이 페이즈부터 "완료" 처리 (착지 후에야 체크가 그려진다)
const BOARD_DRAG = [
    /* 0 접근   */ { at: "doing", hover: false, lift: false, target: false, slot: false, ghost: false, cursor: "near" },
    /* 1 올려둠 */ { at: "doing", hover: true, lift: false, target: false, slot: false, ghost: false, cursor: "hover" },
    /* 2 집기   */ { at: "doing", hover: false, lift: true, target: true, slot: true, ghost: false, cursor: "grab" },
    /* 3 이동   */ { at: "done", hover: false, lift: true, target: true, slot: false, ghost: true, cursor: "drag" },
    /* 4 놓기   */ { at: "done", hover: false, lift: false, target: false, slot: false, ghost: false, cursor: "drop" },
    /* 5 정착   */ { at: "done", hover: false, lift: false, target: false, slot: false, ghost: false, cursor: "off" },
];
const BOARD_MOVER = "API 연동";

/* reduced-motion 커넥터 기하 — 컬럼/카드 sx에 쓴 spacing과 1:1로 맞춘 상수.
   (MUI spacing 1 = 8px · 컬럼 padding 0.75→6 + 테두리 1 · 컬럼 gap 0.875→7 · 카드 gap 0.625→5) */
const BOARD_COL_INSET = 7;                                  // 컬럼 안쪽 여백 + 테두리
const BOARD_COL_GAP = 7;                                    // 컬럼 사이 간격
const BOARD_CARD_GAP = 5;                                   // 카드 사이 간격
const BOARD_TRAIL_DX = BOARD_COL_INSET * 2 + BOARD_COL_GAP; // 잔상 오른쪽 끝 → 도착 카드 왼쪽 끝 = 21px
const BOARD_TRAIL_UP = 2 * BOARD_CARD_GAP;                  // 세로 이동 = 카드 2장(200%) + 간격 2칸

/**
 * reduced-motion 전용 — "진행 중"에 남은 점선 잔상 + 거기서 "완료"의 도착 카드로 이어지는
 * 정적 점선 커넥터.
 *
 * 좌표 계산에 DOM 측정이 필요 없다. 잔상 래퍼가 **카드 한 장 크기**라
 * `100%` = 카드 너비/높이가 되고, 잔상은 출발 컬럼의 3번째·도착 카드는 다음 컬럼의 1번째인데
 * 두 컬럼의 헤더/여백/카드 높이가 모두 같아서 세로 거리가 정확히 `200% + 10px`로 떨어진다.
 * 가로 거리도 컬럼 여백·간격의 합(21px)으로 고정이다.
 */
function BoardDragTrail({ k }) {
    const line = `1.5px dashed ${k.accent}`;
    const seg = { position: "absolute", zIndex: 3, pointerEvents: "none" };
    // 도착 카드의 세로 중심 (잔상 위쪽 기준)
    const destY = `50% - 200% - ${BOARD_TRAIL_UP}px`;

    return (
        <Box sx={{ position: "relative", minWidth: 0 }}>
            <MiniTaskCard k={k} label={BOARD_MOVER} tone={k.text3} reduced enter={false} ghost />

            {/* ① 잔상 오른쪽 → 컬럼 사이 홈 */}
            <Box sx={{ ...seg, left: "100%", top: "calc(50% - 0.75px)", width: 11, borderTop: line }} />
            {/* ② 컬럼 사이 홈을 따라 위로 */}
            <Box
                sx={{
                    ...seg,
                    left: `calc(100% + ${BOARD_COL_INSET + 3}px)`,
                    top: `calc(${destY})`,
                    height: `calc(200% + ${BOARD_TRAIL_UP}px)`,
                    borderLeft: line,
                }}
            />
            {/* ③ 도착 카드 쪽으로 */}
            <Box
                sx={{
                    ...seg,
                    left: `calc(100% + ${BOARD_COL_INSET + 3}px)`,
                    top: `calc(${destY} - 0.75px)`,
                    width: BOARD_TRAIL_DX - BOARD_COL_INSET - 3 - 5,
                    borderTop: line,
                }}
            />
            {/* ④ 도착 카드 왼쪽 모서리에 닿는 화살촉 */}
            <Box
                sx={{
                    ...seg,
                    left: `calc(100% + ${BOARD_TRAIL_DX - 5}px)`,
                    top: `calc(${destY} - 3.5px)`,
                    width: 5,
                    height: 7,
                    bgcolor: k.accent,
                    clipPath: "polygon(100% 50%, 0% 0%, 0% 100%)",
                }}
            />

            <DragHintChip k={k} sx={{ top: "calc(100% + 6px)", left: 0 }} />
        </Box>
    );
}

/**
 * 할 일 보드 — 카드가 stagger로 들어온 뒤, "API 연동" 카드를 **집어서 끌어다 놓는다**.
 * 집기(들림+그림자+기울임) → 완료 컬럼이 열리고 하이라이트 → 호를 그리며 이동(출발지엔 잔상)
 * → 툭 내려앉고 나서야 체크 + 취소선이 그려진다. (layoutId 공유 레이아웃 + DragLift)
 */
export function BoardMockup() {
    const theme = useTheme();
    const k = getTourTokens(theme);
    const reduced = useReduced();
    const phase = useLoopPhase(BOARD_DRAG.length, BOARD_TICK, !reduced);
    const drag = BOARD_DRAG[phase];
    const atDone = drag.at === "done";
    const dropped = phase >= BOARD_DROP_AT;
    const firstRender = useFirstRender();

    const toneTodo = statusColor(theme, "TODO");
    const toneDoing = statusColor(theme, "IN_PROGRESS");
    const toneDone = statusColor(theme, "DONE");

    const mover = (
        <Box
            component={motion.div}
            layoutId="tour-board-mover"
            // 한 바퀴 끝나고 원위치로 돌아가는 프레임(phase 0)은 끊어서 역재생을 감춘다.
            transition={{ layout: { duration: phase === 0 ? 0 : 0.62, ease: EASE } }}
            sx={{ position: "relative", minWidth: 0 }}
        >
            <DragLift hover={drag.hover} lift={drag.lift} travelling={drag.lift && atDone} scale={1.07} tilt={-2.5} hop={9}>
                <LiftShadow strength={drag.lift ? 1 : drag.hover ? 0.45 : 0} />
                <MiniTaskCard
                    k={k}
                    label={BOARD_MOVER}
                    tone={dropped ? toneDone : toneDoing}
                    done={dropped}
                    delay={0.24}
                    reduced={reduced}
                    enter={firstRender}
                />
            </DragLift>
            {!reduced && <DragCursor k={k} state={drag.cursor} />}
        </Box>
    );

    return (
        <MockWindow k={k} bodySx={{ gap: 1 }}>
            {/* 툴바 */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexShrink: 0 }}>
                <MiniSegmented k={k} items={["보드", "목록"]} activeIndex={0} />
                <Box sx={{ flex: 1 }} />
                <Box
                    sx={{
                        px: 1,
                        py: "3px",
                        borderRadius: "var(--plando-radius-pill)",
                        bgcolor: k.accent,
                        color: k.onAccent,
                        fontSize: 9,
                        fontWeight: 800,
                    }}
                >
                    + 할 일
                </Box>
            </Box>

            {/* 컬럼 3개 */}
            <Box sx={{ display: "flex", gap: 0.875, flex: 1, minHeight: 0, alignItems: "stretch" }}>
                <BoardColumnMock k={k} title="할 일" tone={toneTodo} count={3} reduced={reduced}>
                    <MiniTaskCard k={k} label="리서치 정리" tone={toneTodo} delay={0.04} reduced={reduced} />
                    <MiniTaskCard k={k} label="배포 점검" tone={toneTodo} delay={0.09} reduced={reduced} />
                    <MiniTaskCard k={k} label="온보딩 카피" tone={toneTodo} delay={0.14} reduced={reduced} />
                </BoardColumnMock>

                <BoardColumnMock k={k} title="진행 중" tone={toneDoing} count={atDone ? 2 : 3} reduced={reduced}>
                    <MiniTaskCard k={k} label="디자인 QA" tone={toneDoing} delay={0.18} reduced={reduced} />
                    <MiniTaskCard k={k} label="권한 정책 정리" tone={toneDoing} delay={0.22} reduced={reduced} />
                    {!atDone && mover}
                    {/* 카드가 떠난 자리에 남는 잔상 — 옮긴 거지 복사한 게 아니라는 신호 */}
                    {drag.ghost && (
                        <Box
                            component={motion.div}
                            initial={{ opacity: 0.3 }}
                            animate={{ opacity: 0 }}
                            transition={{ duration: 0.6, ease: EASE }}
                            sx={{ pointerEvents: "none" }}
                        >
                            <MiniTaskCard k={k} label={BOARD_MOVER} tone={toneDoing} reduced enter={false} />
                        </Box>
                    )}
                    {/* 모션을 끈 상태에서는 잔상이 사라지지 않고 남아, 커넥터로 "여기서 저기로 옮겼다"를 설명한다 */}
                    {reduced && <BoardDragTrail k={k} />}
                </BoardColumnMock>

                <BoardColumnMock
                    k={k}
                    title="완료"
                    tone={toneDone}
                    count={atDone ? 3 : 2}
                    highlight={drag.target}
                    reduced={reduced}
                >
                    {drag.slot && <DropSlot k={k} label={BOARD_MOVER} reduced={reduced} />}
                    {atDone && mover}
                    <MiniTaskCard
                        k={k}
                        label="스펙 확정"
                        tone={toneDone}
                        done
                        delay={0.3}
                        reduced={reduced}
                        layout={!reduced && phase !== 0}
                    />
                    <MiniTaskCard
                        k={k}
                        label="로고 시안"
                        tone={toneDone}
                        done
                        delay={0.34}
                        reduced={reduced}
                        layout={!reduced && phase !== 0}
                    />
                </BoardColumnMock>
            </Box>
        </MockWindow>
    );
}

/* ── 2. AI 빠른 추가 ─────────────────────────────────────── */

const AI_INPUT = "내일 오후 3시 강남에서 거래처 미팅";

/**
 * AI 빠른 추가 — 입력창에 문장이 타이핑되고, 파싱된 카드(제목·날짜·장소·우선순위)가
 * 조립된다. 다 조립되면 잠시 멈췄다가 처음부터 반복.
 */
export function AiParseMockup() {
    const theme = useTheme();
    const k = getTourTokens(theme);
    const reduced = useReduced();

    const [typed, setTyped] = useState(reduced ? AI_INPUT.length : 0);
    const [parsed, setParsed] = useState(reduced);

    useEffect(() => {
        if (reduced) {
            setTyped(AI_INPUT.length);
            setParsed(true);
            return undefined;
        }
        let alive = true;
        let timer;
        let i = 0;

        const step = () => {
            if (!alive) return;
            i += 1;
            setTyped(i);
            if (i < AI_INPUT.length) {
                timer = setTimeout(step, 52);
            } else {
                timer = setTimeout(() => {
                    if (!alive) return;
                    setParsed(true);
                    timer = setTimeout(() => {
                        if (!alive) return;
                        setParsed(false);
                        i = 0;
                        setTyped(0);
                        timer = setTimeout(step, 520);
                    }, 2800);
                }, 320);
            }
        };

        timer = setTimeout(step, 420);
        return () => {
            alive = false;
            clearTimeout(timer);
        };
    }, [reduced]);

    const chips = [
        { Icon: ScheduleRoundedIcon, label: "내일 오후 3:00" },
        { Icon: LocationOnRoundedIcon, label: "강남" },
    ];

    return (
        <MockWindow k={k} bodySx={{ gap: 1, justifyContent: "center" }}>
            {/* 입력창 */}
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.75,
                    px: 1.25,
                    py: 1,
                    borderRadius: "var(--plando-radius-md)",
                    bgcolor: k.surface,
                    border: `1px solid ${parsed ? k.accent : k.border}`,
                    transition: "border-color var(--plando-dur-base) var(--plando-ease)",
                    flexShrink: 0,
                }}
            >
                <AutoAwesomeRoundedIcon sx={{ fontSize: 13, color: k.accent, flexShrink: 0 }} />
                <Typography noWrap sx={{ fontSize: 11, fontWeight: 600, color: k.text, minWidth: 0 }}>
                    {AI_INPUT.slice(0, typed)}
                </Typography>
                {!reduced && !parsed && (
                    <Box
                        component={motion.div}
                        animate={{ opacity: [1, 1, 0, 0] }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        sx={{ width: "1.5px", height: 12, bgcolor: k.accent, flexShrink: 0 }}
                    />
                )}
            </Box>

            {/* 화살표 */}
            <Box
                component={motion.div}
                animate={reduced ? undefined : { y: [0, 3, 0] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                sx={{ display: "flex", justifyContent: "center", color: k.text3, flexShrink: 0 }}
            >
                <KeyboardArrowDownRoundedIcon sx={{ fontSize: 16 }} />
            </Box>

            {/* 파싱 결과 카드 — 카드가 나타났다 사라져도 위 입력창이 흔들리지 않게 높이 고정 */}
            <Box sx={{ height: 96, flexShrink: 0 }}>
                <AnimatePresence>
                    {parsed && (
                        <Box
                            component={motion.div}
                            initial={reduced ? false : { opacity: 0, y: 10, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.34, ease: EASE }}
                            sx={{
                                ...mockCardSx(k),
                                borderRadius: "var(--plando-radius-md)",
                                borderLeft: `3px solid ${k.accent}`,
                                boxShadow: "var(--plando-shadow-2)",
                                p: 1.25,
                            }}
                        >
                            <Box
                                component={motion.div}
                                initial={reduced ? false : { opacity: 0, x: -6 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.28, delay: reduced ? 0 : 0.1, ease: EASE }}
                            >
                                <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: k.text, mb: 0.875 }}>
                                    거래처 미팅
                                </Typography>
                            </Box>

                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
                                {chips.map(({ Icon, label }, i) => (
                                    <Box
                                        key={label}
                                        component={motion.div}
                                        initial={reduced ? false : { opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.26, delay: reduced ? 0 : 0.22 + i * 0.1, ease: EASE }}
                                        sx={{ display: "flex", alignItems: "center", gap: 0.375 }}
                                    >
                                        <Icon sx={{ fontSize: 12, color: k.text3 }} />
                                        <Typography sx={{ fontSize: 10.5, fontWeight: 600, color: k.text2 }}>
                                            {label}
                                        </Typography>
                                    </Box>
                                ))}
                                <Box
                                    component={motion.div}
                                    initial={reduced ? false : { opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.26, delay: reduced ? 0 : 0.42, ease: EASE }}
                                >
                                    <PriorityPill priority="HIGH" />
                                </Box>
                            </Box>
                        </Box>
                    )}
                </AnimatePresence>
            </Box>
        </MockWindow>
    );
}

/* ── 3. 캘린더 ───────────────────────────────────────────── */

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const CAL_OFFSET = 3;      // 1일이 수요일 칸에서 시작
const CAL_TODAY = 11;
const CAL_EVENTS = {
    4: { label: "기획 리뷰", key: "accent" },
    8: { label: "디자인 QA", key: "warning" },
    11: { label: "배포", key: "accent" },
    16: { label: "회고", key: "success" },
    19: { label: "출장", key: "warning" },
};

/** 일정 pill 진입 stagger 순서 — 드래그 대상(8일)이 칸을 옮겨도 순서가 안 밀리게 미리 고정. */
const CAL_ORDER = Object.keys(CAL_EVENTS).map(Number).sort((a, b) => a - b);
const calDelay = (day) => 0.18 + CAL_ORDER.indexOf(day) * 0.09;

/* 8일 "디자인 QA"를 17일 칸으로 끌어다 놓는다 (수요일 → 그다음 주 금요일). */
const CAL_DRAG_FROM = 8;
const CAL_DRAG_TO = 17;

/* 드래그 데모 페이즈 — 780ms 틱 × 6 = 4.68s 한 바퀴. (BOARD_DRAG와 같은 문법) */
const CAL_TICK = 780;
const CAL_DROP_AT = 4;     // 이 페이즈부터 도착 날짜가 확정된 상태
const CAL_DRAG = [
    /* 0 접근   */ { at: "from", hover: false, lift: false, target: false, ghost: false, cursor: "near" },
    /* 1 올려둠 */ { at: "from", hover: true, lift: false, target: false, ghost: false, cursor: "hover" },
    /* 2 집기   */ { at: "from", hover: false, lift: true, target: true, ghost: false, cursor: "grab" },
    /* 3 이동   */ { at: "to", hover: false, lift: true, target: true, ghost: true, cursor: "drag" },
    /* 4 놓기   */ { at: "to", hover: false, lift: false, target: false, ghost: false, cursor: "drop" },
    /* 5 정착   */ { at: "to", hover: false, lift: false, target: false, ghost: false, cursor: "off" },
];

/**
 * 캘린더 칸 안 일정 pill의 겉모습 (실제 일정 · 잔상 모두 이걸 쓴다).
 * ghostColor를 주면 "빈 껍데기" 잔상 — 테두리는 outline이라 pill 크기가 그대로다.
 */
function CalPill({ tone, label, ghostColor }) {
    const ghost = Boolean(ghostColor);
    return (
        <Box
            sx={{
                borderRadius: "3px",
                px: "3px",
                py: "1px",
                bgcolor: ghost ? "transparent" : tone,
                color: ghost ? ghostColor : readableOn(tone),
                ...(ghost ? { outline: `1px dashed ${ghostColor}`, outlineOffset: "-1px" } : null),
                fontSize: 7,
                fontWeight: 800,
                lineHeight: 1.45,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
            }}
        >
            {label}
        </Box>
    );
}

/* reduced-motion 커넥터 기하 — 월 그리드 sx와 1:1로 맞춘 상수.
   그리드는 7×5 고정에 gap 3px, 칸 padding 3px이라 DOM 측정 없이 칸 좌표를 계산할 수 있다. */
const CAL_GAP = 3;                 // 그리드 gap = 칸 padding
const CAL_COLS = 7;
const CAL_ROWS = 5;
const CAL_PILL_H = 12;             // pill 높이 (py 1×2 + 7px×1.45)
const CAL_PILL_TOP = 14;           // 칸 위쪽 → pill 위쪽 (padding 3 + 날짜숫자 9 + gap 2)
const CAL_PILL_MID = CAL_PILL_TOP + CAL_PILL_H / 2;

const calCol = (day) => (day + CAL_OFFSET - 1) % CAL_COLS;
const calRow = (day) => Math.floor((day + CAL_OFFSET - 1) / CAL_COLS);

/**
 * reduced-motion 전용 — 8일 칸의 잔상에서 17일 칸으로 이어지는 정적 점선 커넥터.
 *
 * 그리드 위에 통째로 덮이는 절대배치 오버레이라 칸 크기/개수를 전혀 건드리지 않는다.
 * 칸 폭·높이는 `1fr`이므로 CSS 변수로 그대로 유도한다 (--cw 칸 폭 · --cs 열 간격 · --rs 행 간격).
 * 가로 변수는 가로 속성에서만, 세로 변수는 세로 속성에서만 쓴다 (%의 기준축이 다르므로).
 */
function CalDragTrail({ k }) {
    const line = `1.5px dashed ${k.accent}`;
    const seg = { position: "absolute", zIndex: 3, pointerEvents: "none" };

    const fromCol = calCol(CAL_DRAG_FROM);
    const fromRow = calRow(CAL_DRAG_FROM);
    const toCol = calCol(CAL_DRAG_TO);
    const toRow = calRow(CAL_DRAG_TO);

    const cw = "var(--tour-cal-cw)";
    const cs = "var(--tour-cal-cs)";
    const rs = "var(--tour-cal-rs)";

    const startX = `${fromCol} * ${cs} + ${cw} - ${CAL_GAP}px`;              // 출발 pill 오른쪽 끝
    const endX = `${toCol} * ${cs} + ${cw} / 2`;                             // 도착 pill 가로 중심
    const runX = `${toCol - fromCol} * ${cs} - ${cw} / 2 + ${CAL_GAP}px`;    // 가로 구간 길이
    const startY = `${fromRow} * ${rs} + ${CAL_PILL_MID}px`;                 // 출발 pill 세로 중심
    const headY = `${toRow} * ${rs} + ${CAL_PILL_TOP - 5}px`;                // 화살촉 위쪽 (촉 끝 = pill 윗변)

    return (
        <Box
            sx={{
                position: "absolute",
                inset: 0,
                zIndex: 3,
                pointerEvents: "none",
                "--tour-cal-cw": `((100% - ${(CAL_COLS - 1) * CAL_GAP}px) / ${CAL_COLS})`,
                "--tour-cal-cs": `(((100% - ${(CAL_COLS - 1) * CAL_GAP}px) / ${CAL_COLS}) + ${CAL_GAP}px)`,
                "--tour-cal-rs": `(((100% - ${(CAL_ROWS - 1) * CAL_GAP}px) / ${CAL_ROWS}) + ${CAL_GAP}px)`,
            }}
        >
            {/* ① 출발 pill에서 도착 열까지 가로로 */}
            <Box
                sx={{
                    ...seg,
                    left: `calc(${startX})`,
                    top: `calc(${startY} - 0.75px)`,
                    width: `calc(${runX})`,
                    borderTop: line,
                }}
            />
            {/* ② 도착 열을 따라 아래로 */}
            <Box
                sx={{
                    ...seg,
                    left: `calc(${endX} - 0.75px)`,
                    top: `calc(${startY})`,
                    height: `calc(${headY} - (${startY}))`,
                    borderLeft: line,
                }}
            />
            {/* ③ 도착 pill 윗변에 닿는 화살촉 */}
            <Box
                sx={{
                    ...seg,
                    left: `calc(${endX} - 3.5px)`,
                    top: `calc(${headY})`,
                    width: 7,
                    height: 5,
                    bgcolor: k.accent,
                    clipPath: "polygon(50% 100%, 0% 0%, 100% 0%)",
                }}
            />

            <DragHintChip k={k} sx={{ left: `calc(${startX} + 5px)`, top: `calc(${startY} + 5px)` }} />
        </Box>
    );
}

/**
 * 캘린더 — 월 그리드가 그려지고 일정 pill이 순서대로 내려앉은 뒤,
 * "디자인 QA"를 **집어서 다른 날짜 칸으로 끌어다 놓는다.** ("드래그로 시간을 옮길 수 있어요")
 * 도착 칸은 이동하는 동안 점선 + 옅은 accent로 드롭 타깃임을 표시하고,
 * 출발 칸에는 잔상이 남았다 사라지며, 놓는 순간 도착 날짜 숫자가 튀며 강조된다.
 */
export function CalendarMockup() {
    const theme = useTheme();
    const k = getTourTokens(theme);
    const reduced = useReduced();
    const phase = useLoopPhase(CAL_DRAG.length, CAL_TICK, !reduced);
    const drag = CAL_DRAG[phase];
    const firstRender = useFirstRender();

    const eventTone = {
        accent: k.accent,
        warning: theme.palette.warning.main,
        success: theme.palette.success.main,
    };

    const cells = Array.from({ length: 35 }, (_, i) => i - CAL_OFFSET + 1);
    const moverEv = CAL_EVENTS[CAL_DRAG_FROM];
    const moverTone = eventTone[moverEv.key];
    const enterMover = firstRender && !reduced;

    const mover = (
        <Box
            component={motion.div}
            layoutId="tour-cal-mover"
            // 한 바퀴 끝나고 8일로 되돌아가는 프레임(phase 0)은 끊어서 역재생을 감춘다.
            transition={{ layout: { duration: phase === 0 ? 0 : 0.62, ease: EASE } }}
            sx={{ position: "relative", minWidth: 0 }}
        >
            <DragLift
                hover={drag.hover}
                lift={drag.lift}
                travelling={drag.lift && drag.at === "to"}
                scale={1.22}
                tilt={-5}
                hop={7}
                hoverY={1.5}
            >
                <LiftShadow
                    strength={drag.lift ? 1 : drag.hover ? 0.45 : 0}
                    radius="3px"
                    shadow="var(--plando-shadow-3)"
                />
                <Box
                    component={motion.div}
                    initial={enterMover ? { opacity: 0, y: -10, scale: 0.9 } : false}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{
                        type: "spring",
                        stiffness: 460,
                        damping: 26,
                        delay: enterMover ? calDelay(CAL_DRAG_FROM) : 0,
                    }}
                >
                    <CalPill tone={moverTone} label={moverEv.label} />
                </Box>
            </DragLift>
            {!reduced && <DragCursor k={k} state={drag.cursor} />}
        </Box>
    );

    return (
        <MockWindow k={k} bodySx={{ gap: 0.875 }}>
            {/* 툴바 */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexShrink: 0 }}>
                <Typography sx={{ fontSize: 11, fontWeight: 800, color: k.text }}>7월</Typography>
                <Box sx={{ flex: 1 }} />
                <MiniSegmented k={k} items={["월", "주", "일"]} activeIndex={0} />
            </Box>

            {/* 요일 */}
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "3px", flexShrink: 0 }}>
                {WEEKDAYS.map((d, i) => (
                    <Typography
                        key={d}
                        align="center"
                        sx={{ fontSize: 8.5, fontWeight: 700, color: i === 0 ? theme.palette.error.main : k.text3 }}
                    >
                        {d}
                    </Typography>
                ))}
            </Box>

            {/* 월 그리드 */}
            <Box
                sx={{
                    flex: 1,
                    minHeight: 0,
                    display: "grid",
                    gridTemplateColumns: "repeat(7, 1fr)",
                    gridAutoRows: "1fr",
                    gap: "3px",
                    // 정적 커넥터 오버레이의 기준 박스 (reduced일 때만 추가 — 애니메이션 경로는 그대로)
                    ...(reduced ? { position: "relative" } : null),
                }}
            >
                {cells.map((day, idx) => {
                    const inMonth = day >= 1 && day <= 31;
                    const isFrom = day === CAL_DRAG_FROM;
                    const isTo = day === CAL_DRAG_TO;
                    // 드래그 대상은 아래에서 mover로 따로 그린다.
                    const ev = inMonth && !isFrom ? CAL_EVENTS[day] : null;
                    const isToday = day === CAL_TODAY;
                    // 드롭 타깃 표시 — reduced에서는 "여기로 옮겨졌어요" 자리로 그대로 남겨둔다
                    const hint = isTo && (drag.target || reduced);
                    const landed = isTo && phase >= CAL_DROP_AT;         // 착지 완료 = 날짜가 바뀐 상태
                    const hostsMover = (isFrom && drag.at === "from") || (isTo && drag.at === "to");
                    const dayLit = isToday || landed;

                    return (
                        <Box
                            key={idx}
                            sx={{
                                position: "relative",
                                // 날아가는 pill이 뒤 칸 배경에 가리지 않게 들고 있는 칸만 올린다.
                                zIndex: hostsMover ? 2 : undefined,
                                minWidth: 0,
                                borderRadius: "5px",
                                bgcolor: hint ? k.accentFaint : inMonth ? k.surface : "transparent",
                                border: `1px ${hint ? "dashed" : "solid"} ${hint || isToday ? k.accent : "transparent"}`,
                                p: "3px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "2px",
                                transition:
                                    "background-color var(--plando-dur-base) var(--plando-ease), border-color var(--plando-dur-base) var(--plando-ease)",
                            }}
                        >
                            {inMonth && (
                                <Box
                                    component={motion.div}
                                    initial={false}
                                    // 놓이는 순간 도착 날짜가 한 번 튄다 — "이제 이 날짜예요"
                                    animate={{ scale: !reduced && isTo && phase === CAL_DROP_AT ? [1, 1.4, 1] : 1 }}
                                    transition={{ duration: 0.44, ease: EASE }}
                                    sx={{ transformOrigin: "left center", width: "fit-content" }}
                                >
                                    <Typography
                                        sx={{
                                            fontSize: 7.5,
                                            fontWeight: dayLit ? 800 : 600,
                                            lineHeight: 1.2,
                                            color: dayLit ? k.accent : k.text3,
                                            transition: "color var(--plando-dur-base) var(--plando-ease)",
                                        }}
                                    >
                                        {day}
                                    </Typography>
                                </Box>
                            )}

                            {ev && (
                                <Box
                                    component={motion.div}
                                    initial={reduced ? false : { opacity: 0, y: -10, scale: 0.9 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    transition={{
                                        type: "spring",
                                        stiffness: 460,
                                        damping: 26,
                                        delay: reduced ? 0 : calDelay(day),
                                    }}
                                >
                                    <CalPill tone={eventTone[ev.key]} label={ev.label} />
                                </Box>
                            )}

                            {/* 모션을 끈 상태에서는 출발 칸의 잔상이 사라지지 않고 남는다 */}
                            {reduced && isFrom && (
                                <CalPill tone={moverTone} label={moverEv.label} ghostColor={k.text3} />
                            )}

                            {hostsMover && mover}

                            {/* 출발 칸에 남았다 사라지는 잔상 */}
                            {isFrom && drag.ghost && (
                                <Box
                                    component={motion.div}
                                    initial={{ opacity: 0.32 }}
                                    animate={{ opacity: 0 }}
                                    transition={{ duration: 0.62, ease: EASE }}
                                    sx={{ pointerEvents: "none" }}
                                >
                                    <CalPill tone={moverTone} label={moverEv.label} />
                                </Box>
                            )}
                        </Box>
                    );
                })}

                {/* 8일 잔상 → 17일 칸을 잇는 정적 커넥터 (그리드 위 오버레이 — 칸 크기에 영향 없음) */}
                {reduced && <CalDragTrail k={k} />}
            </Box>
        </MockWindow>
    );
}

/* ── 4. 지도 · 위치 알림 ─────────────────────────────────── */

/** 지도 — 핀이 떨어지고 알림 반경이 맥동하다가 도착 알림 토스트가 슬라이드인. */
export function MapMockup() {
    const theme = useTheme();
    const k = getTourTokens(theme);
    const reduced = useReduced();
    const phase = useLoopPhase(2, 2600, !reduced);
    const toastOn = phase === 1;

    const roads = [
        { top: "34%", left: "-12%", w: "124%", rot: "-9deg" },
        { top: "72%", left: "-12%", w: "124%", rot: "4deg" },
        { top: "-20%", left: "26%", w: "140%", rot: "78deg" },
    ];
    const blocks = [
        { top: "8%", left: "6%", w: 46, h: 26 },
        { top: "44%", left: "72%", w: 40, h: 34 },
        { top: "78%", left: "14%", w: 34, h: 20 },
    ];

    return (
        <MockWindow k={k} bodySx={{ p: 0 }}>
            <Box sx={{ position: "relative", flex: 1, minHeight: 0, bgcolor: k.surface, overflow: "hidden" }}>
                {/* 추상화된 도로 / 블록 */}
                {roads.map((r, i) => (
                    <Box
                        key={`r${i}`}
                        sx={{
                            position: "absolute",
                            top: r.top,
                            left: r.left,
                            width: r.w,
                            height: 5,
                            bgcolor: k.barFaint,
                            transform: `rotate(${r.rot})`,
                        }}
                    />
                ))}
                {blocks.map((b, i) => (
                    <Box
                        key={`b${i}`}
                        sx={{
                            position: "absolute",
                            top: b.top,
                            left: b.left,
                            width: b.w,
                            height: b.h,
                            borderRadius: "4px",
                            bgcolor: k.barFaint,
                        }}
                    />
                ))}

                {/* 알림 반경 */}
                <Box
                    sx={{
                        position: "absolute",
                        top: "50%",
                        left: "42%",
                        transform: "translate(-50%, -50%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <Box
                        component={motion.div}
                        animate={reduced ? undefined : { scale: [1, 1.16, 1], opacity: [0.85, 0.35, 0.85] }}
                        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                        sx={{
                            width: 140,
                            height: 140,
                            borderRadius: "50%",
                            bgcolor: k.accentFaint,
                            border: `1.5px solid ${k.accentSoft}`,
                        }}
                    />
                    {/* 핀 */}
                    <Box
                        component={motion.div}
                        initial={reduced ? false : { y: -26, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 420, damping: 18, delay: reduced ? 0 : 0.2 }}
                        sx={{ position: "absolute", display: "flex", flexDirection: "column", alignItems: "center" }}
                    >
                        <LocationOnRoundedIcon sx={{ fontSize: 30, color: k.accent, filter: "drop-shadow(var(--plando-elev-3))" }} />
                    </Box>
                    {/* 반경 라벨 */}
                    <Typography
                        sx={{
                            position: "absolute",
                            bottom: -6,
                            fontSize: 8,
                            fontWeight: 800,
                            color: k.accent,
                            bgcolor: k.frameBg,
                            border: `1px solid ${k.border}`,
                            borderRadius: "var(--plando-radius-pill)",
                            px: 0.75,
                            py: "1px",
                        }}
                    >
                        반경 200m
                    </Typography>
                </Box>

                {/* 다른 장소 핀 (희미하게) */}
                <LocationOnRoundedIcon sx={{ position: "absolute", top: "16%", left: "68%", fontSize: 17, color: k.text3 }} />
                <LocationOnRoundedIcon sx={{ position: "absolute", top: "76%", left: "78%", fontSize: 17, color: k.text3 }} />

                {/* 도착 알림 토스트 */}
                <AnimatePresence>
                    {toastOn && (
                        <Box
                            component={motion.div}
                            initial={reduced ? false : { opacity: 0, x: 16, y: -4 }}
                            animate={{ opacity: 1, x: 0, y: 0 }}
                            exit={{ opacity: 0, x: 16 }}
                            transition={{ duration: 0.34, ease: EASE }}
                            sx={{
                                position: "absolute",
                                top: 10,
                                right: 10,
                                left: "34%",
                                display: "flex",
                                alignItems: "center",
                                gap: 0.875,
                                px: 1,
                                py: 0.875,
                                borderRadius: "var(--plando-radius-md)",
                                bgcolor: k.frameBg,
                                border: `1px solid ${k.border}`,
                                boxShadow: "var(--plando-shadow-3)",
                            }}
                        >
                            <Box
                                sx={{
                                    width: 20,
                                    height: 20,
                                    borderRadius: "var(--plando-radius-sm)",
                                    bgcolor: k.accentSoft,
                                    color: k.accent,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                }}
                            >
                                <NotificationsActiveRoundedIcon sx={{ fontSize: 12 }} />
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                                <Typography noWrap sx={{ fontSize: 9.5, fontWeight: 800, color: k.text }}>
                                    근처에 왔어요
                                </Typography>
                                <Typography noWrap sx={{ fontSize: 9, fontWeight: 600, color: k.text2 }}>
                                    성수 카페 · 원두 사오기
                                </Typography>
                            </Box>
                        </Box>
                    )}
                </AnimatePresence>
            </Box>
        </MockWindow>
    );
}

/* ── 5. 협업 ─────────────────────────────────────────────── */

/** 협업 — 담당자 아바타가 튀어나오고 댓글이 한 개씩 쌓인다. */
export function CollabMockup() {
    const theme = useTheme();
    const k = getTourTokens(theme);
    const reduced = useReduced();
    const phase = useLoopPhase(3, 1500, !reduced);

    const people = [
        { initial: "지", color: theme.palette.primary.main },
        { initial: "현", color: theme.palette.warning.main },
        { initial: "민", color: theme.palette.success.main },
    ];

    const comments = [
        { id: "c1", mine: false, initial: "현", color: theme.palette.warning.main, text: "초안 올렸어요, 확인 부탁해요" },
        { id: "c2", mine: true, initial: "지", color: theme.palette.primary.main, text: "확인했어요! 바로 이어서 할게요" },
    ];
    const visible = comments.slice(0, phase);

    return (
        <MockWindow k={k} bodySx={{ gap: 1 }}>
            {/* 워크스페이스 스위처 */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexShrink: 0 }}>
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                        px: 0.875,
                        py: "3px",
                        borderRadius: "var(--plando-radius-pill)",
                        bgcolor: k.accentSoft,
                        color: k.accent,
                        fontSize: 9,
                        fontWeight: 800,
                    }}
                >
                    디자인팀 워크스페이스
                    <KeyboardArrowDownRoundedIcon sx={{ fontSize: 11 }} />
                </Box>
                <Box sx={{ flex: 1 }} />
                <Box sx={{ display: "flex" }}>
                    {people.map((p, i) => (
                        <Box
                            key={p.initial}
                            component={motion.div}
                            initial={reduced ? false : { opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ type: "spring", stiffness: 520, damping: 22, delay: reduced ? 0 : 0.12 + i * 0.1 }}
                            sx={{ ml: i === 0 ? 0 : "-5px" }}
                        >
                            <MiniAvatar k={k} color={p.color} initial={p.initial} />
                        </Box>
                    ))}
                </Box>
            </Box>

            {/* 담당자가 붙은 할 일 카드 */}
            <Box
                component={motion.div}
                initial={reduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.36, ease: EASE }}
                sx={{ ...mockCardSx(k), borderRadius: "var(--plando-radius-md)", p: 1.125, flexShrink: 0 }}
            >
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                    <Box sx={{ width: 11, height: 11, borderRadius: "50%", border: `1.5px solid ${statusColor(theme, "IN_PROGRESS")}`, flexShrink: 0 }} />
                    <Typography noWrap sx={{ fontSize: 11.5, fontWeight: 700, color: k.text, minWidth: 0 }}>
                        스프린트 리뷰 준비
                    </Typography>
                    <Box sx={{ flex: 1 }} />
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.25, color: k.text3 }}>
                        <ChatBubbleRoundedIcon sx={{ fontSize: 10 }} />
                        <Typography sx={{ fontSize: 9, fontWeight: 700 }}>{visible.length}</Typography>
                    </Box>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.625, mt: 0.875, pl: "19px" }}>
                    <Typography sx={{ fontSize: 9, fontWeight: 700, color: k.text3 }}>담당</Typography>
                    <Box sx={{ display: "flex" }}>
                        {people.slice(0, 2).map((p, i) => (
                            <Box key={p.initial} sx={{ ml: i === 0 ? 0 : "-5px" }}>
                                <MiniAvatar k={k} color={p.color} initial={p.initial} size={14} />
                            </Box>
                        ))}
                    </Box>
                </Box>
            </Box>

            {/* 댓글 스레드 */}
            <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 0.75, pt: 0.25 }}>
                <AnimatePresence initial={false}>
                    {visible.map((c) => (
                        <Box
                            key={c.id}
                            component={motion.div}
                            initial={reduced ? false : { opacity: 0, y: 10, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.96 }}
                            transition={{ duration: 0.32, ease: EASE }}
                            sx={{
                                display: "flex",
                                alignItems: "flex-end",
                                gap: 0.625,
                                alignSelf: c.mine ? "flex-end" : "flex-start",
                                flexDirection: c.mine ? "row-reverse" : "row",
                                maxWidth: "82%",
                            }}
                        >
                            <MiniAvatar k={k} color={c.color} initial={c.initial} size={15} />
                            <Box
                                sx={{
                                    px: 1,
                                    py: 0.75,
                                    borderRadius: "var(--plando-radius-md)",
                                    bgcolor: c.mine ? k.accent : k.surfaceStrong,
                                    color: c.mine ? k.onAccent : k.text,
                                    fontSize: 10,
                                    fontWeight: 600,
                                    lineHeight: 1.45,
                                }}
                            >
                                {c.text}
                            </Box>
                        </Box>
                    ))}
                </AnimatePresence>
            </Box>
        </MockWindow>
    );
}
