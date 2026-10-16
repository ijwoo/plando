import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import UndoRoundedIcon from "@mui/icons-material/UndoRounded";
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded";

import { isInRange, toDateOnly } from "../../utils/todoFilters.js";
import { priorityColor } from "../../../../shared/ui/tone.js";
import { useStatuses } from "../../../workspace/context/StatusContext.jsx";
import { isTodoDone, doneTodoStatusKey } from "../../../../shared/utils/todoStatus.js";
import { stripMarkdown } from "../../../../shared/utils/markdownUtils.jsx";
import { useProjectPill } from "../../../project/hooks/useProjectPill.js";
import { useWorkspacePermissions } from "../../../workspace/hooks/useWorkspacePermissions.js";
import { toast } from "../../../../shared/utils/toast.js";
import { getProjectIcon } from "../../../project/projectIcons.js";
import { projectIconColor } from "../../../project/utils/projectOptions.js";
import { resolveAssigneeList, getOptionLabel } from "../../../../shared/utils/assigneeUtils.js";
import { hapticLight } from "../../../../shared/utils/haptics.js";
import { formatMonthDay } from "../../../../shared/utils/formatters.js";
import CircleCheckbox from "../../../../shared/ui/common/CircleCheckbox.jsx";
import { PriorityPill } from "../../../../shared/ui/common/Chips.jsx";
import Press from "../../../../shared/ui/primitives/Press.jsx";

// 카톡 스타일 stick-open 스와이프
const ACTION_BUTTON_W = 80;       // 버튼 한 개 너비
const SWIPE_OPEN_THRESHOLD = 40;  // 이 거리 이상 끌면 열림으로 snap
const SWIPE_OVER_TRAVEL = 20;     // 열린 후 추가로 끌 수 있는 여유


/**
 * 마감일 D-day별 색조/라벨.
 * - 지연(<0): error 톤, "지연" 라벨
 * - 오늘(0): primary 톤, "오늘" 라벨
 * - 내일(1): warning 톤, "내일" 라벨
 * - 그 외: 기본(text.disabled), 날짜 그대로
 * 완료된 태스크는 무시(부모에서 처리)
 */
function getDueTone(dateStr, theme) {
    if (!dateStr) return null;
    const due = toDateOnly(dateStr);
    if (!due) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dDiff = Math.round((due - today) / 86400000);
    if (dDiff < 0)  return { color: theme.palette.error.main,   label: `${Math.abs(dDiff)}일 지연`, weight: 700 };
    if (dDiff === 0) return { color: theme.palette.primary.main, label: "오늘",                   weight: 700 };
    if (dDiff === 1) return { color: theme.palette.warning.main, label: "내일",                   weight: 700 };
    return null; // default 톤
}

function isTaskInRange(task, from, to) {
    return isInRange(task, from, to);
}

function getTodayRange() {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    return { start, end };
}
function getTomorrowRange() {
    const start = new Date(); start.setDate(start.getDate() + 1); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setHours(23, 59, 59, 999);
    return { start, end };
}
// 주는 일요일 시작 — 대시보드 주간 통계와 동일 기준
function getThisWeekRange() {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay());
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
}

// ── SwipeableRow (카톡 스타일 stick-open) ─────────────────
// 좌측 스와이프 → 액션 영역 노출 후 stay open. 사용자가 액션 버튼 탭으로 실행.
// 부모(MobileListView)가 openRowId state로 한 번에 한 행만 열림 보장.
function SwipeableRow({
    children,
    actions = [],   // [{ key, label, bg, icon, onTap }]
    isOpen,
    onOpenChange,   // (next: boolean) => void — 부모가 single-open 관리
    disabled = false,
}) {
    const totalWidth = actions.length * ACTION_BUTTON_W;
    const [dx, setDx] = useState(0);
    const [animating, setAnimating] = useState(false);
    const startX = useRef(0);
    const startY = useRef(0);
    const baseDx = useRef(0);
    const dragging = useRef(false);
    const lockedAxis = useRef(null);

    // isOpen이 외부에서 바뀌면 dx 동기화
    useEffect(() => {
        if (!dragging.current) {
            setAnimating(true);
            setDx(isOpen ? -totalWidth : 0);
        }
    }, [isOpen, totalWidth]);

    const onDown = (e) => {
        if (disabled || actions.length === 0) return;
        const pt = e.touches ? e.touches[0] : e;
        startX.current = pt.clientX;
        startY.current = pt.clientY;
        baseDx.current = dx;
        dragging.current = true;
        lockedAxis.current = null;
        setAnimating(false);
    };

    const onMove = (e) => {
        if (!dragging.current || disabled) return;
        const pt = e.touches ? e.touches[0] : e;
        const ddx = pt.clientX - startX.current;
        const ddy = pt.clientY - startY.current;

        if (!lockedAxis.current) {
            const absX = Math.abs(ddx);
            const absY = Math.abs(ddy);
            if (absX < 8 && absY < 8) return;
            if (absY > absX) {
                lockedAxis.current = "y";
                return;
            }
            lockedAxis.current = "x";
        }
        if (lockedAxis.current === "y") return;

        const next = Math.max(
            -(totalWidth + SWIPE_OVER_TRAVEL),
            Math.min(SWIPE_OVER_TRAVEL, baseDx.current + ddx)
        );
        setDx(next);
    };

    const onUp = () => {
        if (!dragging.current) return;
        dragging.current = false;
        setAnimating(true);

        // open ↔ closed snap 결정 (시작 상태 + 이동 거리 기반)
        const wasOpen = baseDx.current < 0;
        const delta = dx - baseDx.current;
        let next;
        if (wasOpen) {
            // 열린 상태에서 우측으로 SWIPE_OPEN_THRESHOLD 이상 끌면 닫음
            next = delta > SWIPE_OPEN_THRESHOLD ? false : true;
        } else {
            // 닫힌 상태에서 좌측으로 SWIPE_OPEN_THRESHOLD 이상 끌면 열음
            next = -delta > SWIPE_OPEN_THRESHOLD ? true : false;
        }
        if (next !== wasOpen) hapticLight();
        onOpenChange?.(next);
        setDx(next ? -totalWidth : 0);
        lockedAxis.current = null;
    };

    return (
        <Box sx={{ position: "relative", overflow: "hidden" }}>
            {/* 액션 영역 (행 우측에 위치) */}
            <Stack
                direction="row"
                sx={{
                    position: "absolute",
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: totalWidth,
                    pointerEvents: isOpen ? "auto" : "none",
                }}
            >
                {actions.map((a) => (
                    <Box
                        key={a.key}
                        onClick={(e) => {
                            e.stopPropagation();
                            hapticLight();
                            a.onTap?.();
                            onOpenChange?.(false);
                        }}
                        sx={{
                            width: ACTION_BUTTON_W,
                            bgcolor: a.bg,
                            color: "#fff",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 0.5,
                            cursor: "pointer",
                            "&:active": { opacity: 0.8 },
                        }}
                    >
                        {a.icon}
                        <Typography
                            sx={{
                                fontSize: 12,
                                fontWeight: 700,
                                letterSpacing: "-0.01em",
                                color: "#fff",
                            }}
                        >
                            {a.label}
                        </Typography>
                    </Box>
                ))}
            </Stack>

            <Box
                onTouchStart={onDown}
                onTouchMove={onMove}
                onTouchEnd={onUp}
                onTouchCancel={onUp}
                sx={{
                    position: "relative",
                    bgcolor: "background.default",
                    transform: `translateX(${dx}px)`,
                    transition: animating ? "transform 240ms cubic-bezier(0.2,0.8,0.2,1)" : "none",
                    touchAction: "pan-y",
                }}
                onTransitionEnd={() => setAnimating(false)}
            >
                {children}
            </Box>
        </Box>
    );
}

// ── TaskRow ────────────────────────────────────────────
function TaskRow({
    task,
    isLast,
    onTap,
    onToggleStatus,
    onArchive,
    isOpen,
    onOpenChange,
    canEditContent = true,
}) {
    const theme = useTheme();
    const success = theme.palette.success.main;
    /* 완료 판정·진행 중 판정은 상태 key 비교가 아니라 카테고리(=커스텀 상태 포함) 기준.
       예전엔 status === "DONE"이라 커스텀 완료 상태의 할 일이 체크·취소선 없이 미완료처럼 보였다. */
    const { statuses: statusDefs, categoryOf: statusCategoryOf, label: statusLabelOf, colorOf: statusColorOf } = useStatuses();
    const isDone = isTodoDone(task);
    const isInProgress = !isDone && statusCategoryOf(task.status) === "IN_PROGRESS";
    const inProgressColor = statusColorOf(task.status);
    const pColor = priorityColor(theme, task.priority);
    const showPriorityBar = !isDone && task.priority && task.priority !== "LOW";

    const assignees = resolveAssigneeList(task);
    // assignees가 비었을 때 getOptionLabel(undefined)이 "-" 반환하므로 명시적 분기.
    const primaryName = assignees.length > 0 ? getOptionLabel(assignees[0]) : "";
    const noAssignee = assignees.length === 0;

    // 서브태스크(parentId 기반 실제 할 일) 배지 — 서버 집계값 사용
    const subtaskTotal = task.subtaskTotal ?? 0;
    const subtaskDone = task.subtaskDone ?? 0;
    const hasChildTodos = subtaskTotal > 0;

    const rowActiveBg = "var(--plando-surface-faint)";
    const dueTone = !isDone ? getDueTone(task.dueDate, theme) : null;

    const { project, show: showProjectPill } = useProjectPill(task);

    /* 편집 불가면(뷰어 / 샘플 데이터) 서버가 403으로 막는다 — 스와이프 액션을 아예 열지 않고,
       체크 서클은 상태 표시용으로만 남긴 뒤 탭하면 이유를 알려준다. (눌리는데 매번 실패하는 컨트롤 금지) */
    const blockedReason = task.isSample
        ? "샘플 할 일은 수정할 수 없어요."
        : !canEditContent ? "읽기 전용 권한이라 완료·보관을 할 수 없어요." : null;
    const canEdit = !blockedReason;

    // 좌측 스와이프 액션 — 상태별로 다름
    const swipeActions = !canEdit ? [] : isDone
        ? [
            {
                key: "undo",
                label: "되돌리기",
                bg: theme.palette.text.secondary,
                icon: <UndoRoundedIcon sx={{ fontSize: 20, color: "#fff" }} />,
                onTap: () => onToggleStatus?.(task.id, task.status),
            },
            {
                key: "archive",
                label: "보관",
                bg: theme.palette.text.disabled,
                icon: <Inventory2RoundedIcon sx={{ fontSize: 20, color: "#fff" }} />,
                onTap: () => onArchive?.(task.id),
            },
        ]
        : [
            {
                key: "complete",
                label: "완료",
                bg: statusColorOf(doneTodoStatusKey(statusDefs)),
                icon: <CheckRoundedIcon sx={{ fontSize: 22, color: "#fff" }} />,
                onTap: () => onToggleStatus?.(task.id, task.status),
            },
            {
                key: "archive",
                label: "보관",
                bg: theme.palette.text.disabled,
                icon: <Inventory2RoundedIcon sx={{ fontSize: 20, color: "#fff" }} />,
                onTap: () => onArchive?.(task.id),
            },
        ];

    return (
        <SwipeableRow
            actions={swipeActions}
            isOpen={isOpen}
            onOpenChange={onOpenChange}
        >
            <Box sx={{ bgcolor: "background.default" }}>
                <Press
                    onClick={() => {
                        // 액션 영역이 열려있으면 우선 닫기 (카톡 패턴)
                        if (isOpen) {
                            onOpenChange?.(false);
                            return;
                        }
                        onTap?.(task.id);
                    }}
                    haptic="light"
                    pressScale={0.99}
                    activeBg={rowActiveBg}
                    style={{
                        display: "flex",
                        gap: 14,
                        padding: "16px 20px",
                        borderBottom: isLast ? "none" : `1px solid ${theme.palette.divider}`,
                        alignItems: "flex-start",
                        position: "relative",
                    }}
                >
                    {/* 좌측 priority 막대 — 기존 그대로 (HIGH/MEDIUM만) */}
                    {showPriorityBar && (
                        <Box
                            sx={{
                                position: "absolute",
                                left: 0,
                                top: 14,
                                bottom: 14,
                                width: 3,
                                borderRadius: 999,
                                bgcolor: pColor,
                            }}
                        />
                    )}

                    <Box sx={{ pt: "1px" }}>
                        <CircleCheckbox
                            checked={isDone}
                            onToggle={() => {
                                if (!canEdit) { toast.info(blockedReason); return; }
                                onToggleStatus?.(task.id, task.status);
                            }}
                            size={28}
                            accent={success}
                        />
                    </Box>

                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        {/* Title row */}
                        <Stack direction="row" alignItems="flex-start" spacing={1} sx={{ mb: 0.5 }}>
                            <Box sx={{ flex: 1, minWidth: 0, display: "flex", alignItems: "flex-start", gap: 0.5 }}>
                                {task.focused && (
                                    <BoltRoundedIcon
                                        sx={{ fontSize: 18, color: "primary.main", mt: "2px", flexShrink: 0 }}
                                        aria-label="포커스"
                                    />
                                )}
                                <Typography
                                    sx={{
                                        flex: 1,
                                        fontSize: 16,
                                        fontWeight: 600,
                                        letterSpacing: "-0.02em",
                                        lineHeight: 1.45,
                                        color: isDone ? "text.disabled" : "text.primary",
                                        textDecoration: isDone ? "line-through" : "none",
                                        wordBreak: "break-word",
                                    }}
                                >
                                    {task.title}
                                </Typography>
                            </Box>

                            {/* 진행 중 배지 — 커스텀 진행 상태('검토중' 등)는 그 상태의 이름·색 그대로 노출 */}
                            {isInProgress && (
                                <Stack
                                    direction="row"
                                    alignItems="center"
                                    spacing={0.5}
                                    sx={{
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: inProgressColor,
                                        whiteSpace: "nowrap",
                                        pt: 0.4,
                                    }}
                                >
                                    <Box
                                        sx={{
                                            width: 5,
                                            height: 5,
                                            borderRadius: 999,
                                            bgcolor: inProgressColor,
                                            animation: "plando-todo-pulse 1.6s ease-in-out infinite",
                                        }}
                                    />
                                    <span>{statusLabelOf(task.status)}</span>
                                </Stack>
                            )}

                        </Stack>

                        {/* Sub text */}
                        {task.content && (
                            <Typography
                                sx={{
                                    fontSize: 13.5,
                                    color: "text.secondary",
                                    fontWeight: 500,
                                    letterSpacing: "-0.01em",
                                    lineHeight: 1.5,
                                    mb: 0.75,
                                    display: "-webkit-box",
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: "vertical",
                                    overflow: "hidden",
                                    opacity: isDone ? 0.5 : 1,
                                }}
                            >
                                {stripMarkdown(task.content)}
                            </Typography>
                        )}

                        {/* Meta row — priority 항상 (LOW 포함), 담당자 없으면 "담당자 없음" */}
                        <Stack
                            direction="row"
                            alignItems="center"
                            spacing={1.25}
                            sx={{
                                flexWrap: "wrap",
                                fontSize: 12,
                                fontWeight: 500,
                                color: "text.disabled",
                                mt: 0.25,
                                gap: 1.25,
                                rowGap: 0.5,
                            }}
                        >
                            {/* 프로젝트 칩 (mock) — 전체 스코프에서만, 인박스/소속 없음이면 생략 */}
                            {showProjectPill && (() => {
                                const ProjIcon = getProjectIcon(project.icon);
                                return (
                                    <Stack
                                        direction="row"
                                        alignItems="center"
                                        spacing={0.5}
                                        sx={{
                                            fontSize: 12,
                                            fontWeight: 600,
                                            color: isDone ? "text.disabled" : "text.secondary",
                                        }}
                                    >
                                        <ProjIcon sx={{ fontSize: 14, color: projectIconColor(project.color) ?? "text.secondary", opacity: isDone ? 0.4 : 1, flexShrink: 0 }} />
                                        <Box>{project.name}</Box>
                                    </Stack>
                                );
                            })()}

                            {!isDone && task.priority && (
                                <PriorityPill priority={task.priority} />
                            )}
                            {/* 서브태스크 배지 — AccountTree 아이콘 + n/m */}
                            {hasChildTodos && (
                                <Stack
                                    direction="row"
                                    alignItems="center"
                                    spacing={0.5}
                                    sx={{
                                        fontSize: 12,
                                        fontWeight: 700,
                                        color: subtaskDone === subtaskTotal ? success : "text.disabled",
                                        fontVariantNumeric: "tabular-nums",
                                    }}
                                >
                                    <AccountTreeRoundedIcon sx={{ fontSize: 13 }} />
                                    <span>{subtaskDone}/{subtaskTotal}</span>
                                </Stack>
                            )}
                            {/* 참여자 없으면 표기 생략 — 빈 값은 채우지 않는다 */}
                            {!noAssignee && (
                                <Typography sx={{ fontSize: 12, fontWeight: 500, color: "text.disabled" }}>
                                    {assignees.length > 1
                                        ? `${primaryName} 외 ${assignees.length - 1}`
                                        : primaryName}
                                </Typography>
                            )}
                            {task.dueDate && (
                                <Typography
                                    sx={{
                                        fontSize: 12,
                                        fontWeight: dueTone?.weight ?? 500,
                                        color: dueTone?.color ?? "text.disabled",
                                        whiteSpace: "nowrap",
                                        letterSpacing: "-0.01em",
                                    }}
                                >
                                    {dueTone?.label
                                        ? `${dueTone.label} · ${formatMonthDay(task.dueDate)}`
                                        : formatMonthDay(task.dueDate)}
                                </Typography>
                            )}
                        </Stack>
                    </Box>
                </Press>
            </Box>
        </SwipeableRow>
    );
}

// ── GroupHeader ────────────────────────────────────────
function GroupHeader({ label, count, accent, action }) {
    return (
        <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ px: 2.5, pt: 3, pb: 1.25 }}
        >
            <Stack direction="row" alignItems="baseline" spacing={1}>
                <Typography
                    sx={{
                        fontSize: 13,
                        fontWeight: 700,
                        letterSpacing: "-0.01em",
                        color: accent ? "primary.main" : "text.secondary",
                    }}
                >
                    {label}
                </Typography>
                {count != null && (
                    <Typography
                        sx={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: "text.disabled",
                            letterSpacing: "-0.01em",
                        }}
                    >
                        {count}
                    </Typography>
                )}
            </Stack>
            {action}
        </Stack>
    );
}

// ── EmptyState ─────────────────────────────────────────
function EmptyState({ tab }) {
    const theme = useTheme();
    const text =
        tab === "today" ? "오늘 할 일을 다 끝냈어요" :
        tab === "done"  ? "아직 완료한 할 일이 없어요" :
        tab === "recurring" ? "반복 일정이 없어요" :
        "아직 할 일이 없어요";
    const sub =
        tab === "today" ? "내일 할 일도 미리 정리해 볼까요?" :
        "왼쪽으로 밀면 완료 처리할 수 있어요";
    return (
        <Box sx={{ py: 10, textAlign: "center", px: 4 }}>
            <Box
                sx={{
                    width: 56, height: 56, borderRadius: 999,
                    mx: "auto", mb: 2,
                    bgcolor: alpha(theme.palette.primary.main, 0.10),
                    display: "flex", alignItems: "center", justifyContent: "center",
                }}
            >
                <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                    <path
                        d="M6.5 13l4 4 9-9"
                        stroke={theme.palette.primary.main}
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            </Box>
            <Typography sx={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em", mb: 0.75 }}>
                {text}
            </Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 500, color: "text.disabled", letterSpacing: "-0.01em", lineHeight: 1.5 }}>
                {sub}
            </Typography>
        </Box>
    );
}

// ── Grouping per tab ───────────────────────────────────
// 완료 판정은 isTodoDone(=doneAt/카테고리 기준) 단일 소스. status === "DONE" 비교를 쓰면
// 커스텀 완료 상태의 할 일이 "완료" 그룹에 안 잡혀서, 탭 뱃지는 "완료 3"인데 목록은 비는 어긋남이 났다.
function buildGroups(tab, todos) {
    /* 보관은 status 값이 아니라 boolean 필드(archived)다 — "ARCHIVED"라는 상태 key는 서버에
       존재한 적이 없어서 예전 조건(status !== "ARCHIVED")은 항상 참, 즉 아무것도 거르지 못했다.
       목록 API는 archived=false만 내려주지만, 보관 직후 낙관적 patch로 archived=true가 붙은 행이
       잠깐 남을 수 있으므로 여기서 실제 필드로 거른다. */
    const live = todos.filter((t) => !t.archived);

    if (tab === "today") {
        const { start, end } = getTodayRange();
        const inToday = live.filter((t) => isTaskInRange(t, start, end));
        return [
            { label: "진행 중", accent: true, items: inToday.filter((t) => !isTodoDone(t)) },
            { label: "완료", items: inToday.filter((t) => isTodoDone(t)) },
        ].filter((g) => g.items.length > 0);
    }

    if (tab === "week") {
        const { start: tStart, end: tEnd } = getTodayRange();
        const { start: tmStart, end: tmEnd } = getTomorrowRange();
        const { start: wStart, end: wEnd } = getThisWeekRange();
        const undone = live.filter((t) => !isTodoDone(t));
        const todayItems = undone.filter((t) => isTaskInRange(t, tStart, tEnd));
        const tmrItems = undone.filter((t) => isTaskInRange(t, tmStart, tmEnd));
        const seen = new Set([...todayItems, ...tmrItems].map((t) => t.id));
        const weekItems = undone.filter(
            (t) => isTaskInRange(t, wStart, wEnd) && !seen.has(t.id)
        );
        return [
            { label: "오늘", accent: true, items: todayItems },
            { label: "내일", items: tmrItems },
            { label: "이번 주", items: weekItems },
        ].filter((g) => g.items.length > 0);
    }

    if (tab === "all") {
        const undone = live.filter((t) => !isTodoDone(t));
        const high = undone.filter((t) => t.priority === "HIGH");
        const mid = undone.filter((t) => t.priority === "MEDIUM");
        const low = undone.filter((t) => !t.priority || t.priority === "LOW");
        const done = live.filter((t) => isTodoDone(t));
        return [
            { label: "높은 우선순위", accent: true, items: high },
            { label: "중간", items: mid },
            { label: "낮음", items: low },
            { label: "완료", items: done },
        ].filter((g) => g.items.length > 0);
    }

    if (tab === "done") {
        return [{ label: "완료", accent: true, items: live.filter((t) => isTodoDone(t)) }]
            .filter((g) => g.items.length > 0);
    }

    if (tab === "recurring") {
        const recurring = live.filter((t) => t.hasRecurrence || t.recurrenceSourceId != null);
        return [
            { label: "진행 중", accent: true, items: recurring.filter((t) => !isTodoDone(t)) },
            { label: "완료", items: recurring.filter((t) => isTodoDone(t)) },
        ].filter((g) => g.items.length > 0);
    }

    return [];
}

// ── MAIN ───────────────────────────────────────────────
/**
 * Mobile list view. mock의 Toss-tone separator 리스트.
 *
 * Props:
 *   todos: 전체 todo 배열 (TodoBoardPage의 useTodoBoardData에서)
 *   tab: "today" | "week" | "all" | "done" | "recurring"
 *   onOpenDetail(id)
 *   onToggleStatus(id, currentStatus) — DONE↔TODO 토글, 기존 updateTodoField 사용
 */
export default function MobileListView({
    todos = [],
    tab = "today",
    onOpenDetail,
    onToggleStatus,
    onArchiveTodo,    // 개별 task 보관 (스와이프 액션) — TodoBoardPage에서 archiveTodo API 호출
    onArchive,        // 페이지 레벨 — 아카이브 뷰로 이동 (헤더 버튼)
    myOnly = false,
    onToggleMyOnly,
}) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const primary = theme.palette.primary.main;
    // 행마다 훅을 부르면 localStorage 파싱이 행 수만큼 반복된다 — 여기서 한 번 읽어 내려보낸다
    const { canEditContent } = useWorkspacePermissions();

    const [openRowId, setOpenRowId] = useState(null); // 카톡 스타일: 한 행만 swipe 열림

    const handleRowOpen = useCallback((id, next) => {
        setOpenRowId(next ? id : (cur) => (cur === id ? null : cur));
    }, []);

    const groups = useMemo(() => buildGroups(tab, todos), [tab, todos]);
    const isEmpty = groups.length === 0;

    // 헤더 우측 액션: [내 할 일 토글] [아카이브]
    const headerActions = (
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ flexShrink: 0 }}>
            {onToggleMyOnly && (
                <Press
                    onClick={onToggleMyOnly}
                    haptic="light"
                    pressScale={0.95}
                    activeBg={isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"}
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: myOnly ? "3px 9px 3px 7px" : "3px 9px",
                        borderRadius: 999,
                        border: `1px solid ${myOnly ? alpha(primary, 0.4) : theme.palette.divider}`,
                        background: myOnly ? alpha(primary, isDark ? 0.16 : 0.08) : "transparent",
                        color: myOnly ? primary : theme.palette.text.disabled,
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "-0.01em",
                        whiteSpace: "nowrap",
                        transition: "background 180ms, border-color 180ms, color 180ms",
                    }}
                >
                    {myOnly && <CheckRoundedIcon sx={{ fontSize: 12 }} />}
                    <span>내 할 일</span>
                </Press>
            )}
            {onArchive && (
                <Press
                    onClick={onArchive}
                    haptic="light"
                    pressScale={0.9}
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "4px 8px",
                        borderRadius: 999,
                        color: theme.palette.text.secondary,
                        fontSize: 12,
                        fontWeight: 600,
                        letterSpacing: "-0.01em",
                    }}
                >
                    <Inventory2RoundedIcon sx={{ fontSize: 14 }} />
                    <span>아카이브</span>
                </Press>
            )}
        </Stack>
    );

    return (
        <>
            {isEmpty ? (
                <>
                    {/* 빈 상태에서도 아카이브/내할일 접근 가능하도록 우측 정렬 행 */}
                    <Stack direction="row" justifyContent="flex-end" sx={{ px: 2, pt: 1.5 }}>
                        {headerActions}
                    </Stack>
                    <EmptyState tab={tab} />
                </>
            ) : (
                groups.map((g, gi) => (
                    <Box key={`${gi}-${g.label}`}>
                        <GroupHeader
                            label={g.label}
                            count={g.items.length}
                            accent={g.accent}
                            action={gi === 0 ? headerActions : null}
                        />
                        {g.items.map((task, i) => (
                            <TaskRow
                                key={task.id}
                                task={task}
                                isLast={i === g.items.length - 1}
                                onTap={onOpenDetail}
                                onToggleStatus={onToggleStatus}
                                onArchive={onArchiveTodo}
                                isOpen={openRowId === task.id}
                                onOpenChange={(next) => handleRowOpen(task.id, next)}
                                canEditContent={canEditContent}
                            />
                        ))}
                    </Box>
                ))
            )}
            <Box sx={{ height: 80 }} />

            <style>{`
                @keyframes plando-todo-pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50%      { opacity: 0.5; transform: scale(1.4); }
                }
            `}</style>
        </>
    );
}

// FAB는 shared/ui/common/MobileFab으로 추출됨 — 부모(TodoBoardPage)에서 직접 import해 사용
