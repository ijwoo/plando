import React, { useCallback, useRef, useState } from "react";
import { isAndroid } from "../../../../shared/utils/platformUtils.js";
import { hapticMedium } from "../../../../shared/utils/haptics.js";
import { resolveAssigneeList, getOptionLabel } from "../../../../shared/utils/assigneeUtils.js";
import { resolveImageUrl } from "../../../../shared/utils/urlUtils.js";
import { stripMarkdown } from "../../../../shared/utils/markdownUtils.jsx";
import { hideScrollbarSx } from "../../../../shared/ui/glassSx.js";
import { formatAbsoluteDue } from "../../../../shared/utils/formatters.js";
import { STATUS_LABEL, priorityColor, statusColor as statusToneColor } from "../../../../shared/ui/tone.js";
import { isTodoDone } from "../../../../shared/utils/todoStatus.js";
import { useStatuses } from "../../../workspace/context/StatusContext.jsx";
import { useWorkspacePermissions } from "../../../workspace/hooks/useWorkspacePermissions.js";
import { useProjectPill } from "../../../project/hooks/useProjectPill.js";
import { getProjectIcon } from "../../../project/projectIcons.js";
import { projectIconColor } from "../../../project/utils/projectOptions.js";
import { PriorityPill } from "../../../../shared/ui/common/Chips.jsx";
import { createPortal } from "react-dom";
import { Z } from "../../../../shared/ui/zIndex.js";
import {
    Avatar,
    AvatarGroup,
    Box,
    Stack,
    Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";

// ── helpers ────────────────────────────────────────────────────────
function getInitial(name) {
    if (!name) return "?";
    return String(name).trim().charAt(0).toUpperCase();
}
function formatDueDate(todo) {
    // 리스트/상세와 동일 포맷 ("오늘"/"내일"/"6월 12일") — raw ISO 노출 금지
    const raw = todo.dueDate || todo.startAt;
    return raw ? formatAbsoluteDue(raw) : null;
}

// ── design tokens (mock 스타일로 단순화 — 토큰 재사용) ─────────────
function tok(isDark) {
    return isDark ? {
        colBg:      isAndroid ? "rgba(28,28,45,0.98)"  : "rgba(255,255,255,0.04)",
        colBorder:  "rgba(255,255,255,0.08)",
        colHead:    isAndroid ? "rgba(35,35,55,0.99)"  : "rgba(255,255,255,0.06)",
        cardBg:     isAndroid ? "rgba(38,38,60,0.99)"  : "rgba(255,255,255,0.06)",
        cardBorder: "rgba(255,255,255,0.08)",
        text:       "rgba(255,255,255,0.92)",
        text2:      "rgba(255,255,255,0.55)",
        text3:      "rgba(255,255,255,0.30)",
        addBorder:  "rgba(255,255,255,0.12)",
        menuBg:     "rgba(18,18,30,0.97)",
        menuBorder: "rgba(255,255,255,0.13)",
        ovBg:       "rgba(0,0,0,0.55)",
        sep:        "rgba(255,255,255,0.09)",
        countBg:    "rgba(255,255,255,0.10)",
    } : {
        colBg:      isAndroid ? "rgba(245,245,250,0.99)" : "rgba(255,255,255,0.65)",
        colBorder:  "rgba(60,60,67,0.10)",
        colHead:    "rgba(242,242,247,0.99)",
        cardBg:     "#FFFFFF",
        cardBorder: "rgba(60,60,67,0.06)",
        text:       "rgba(0,0,0,0.88)",
        text2:      "rgba(0,0,0,0.50)",
        text3:      "rgba(0,0,0,0.28)",
        addBorder:  "rgba(60,60,67,0.15)",
        menuBg:     "rgba(252,252,255,0.98)",
        menuBorder: "rgba(60,60,67,0.12)",
        ovBg:       "rgba(0,0,0,0.32)",
        sep:        "rgba(0,0,0,0.06)",
        countBg:    "rgba(0,0,0,0.06)",
    };
}

// 칸반 컬럼 헤더 dot — IN_PROGRESS/DONE은 tone.js statusColor(앱 전체 프로세스 색)와 일치.
// TODO는 회색 유지 (column header 컨벤션 — 빨강은 alarming).
function colDotColor(theme, status) {
    if (status === "TODO") return "var(--plando-gray)";
    return statusToneColor(theme, status);
}

// ── KanbanCard (mock 스타일: 좌측 priority 막대 + 정돈된 메타) ─────
function KanbanCard({ todo, t, onLongPress, onTap }) {
    const theme          = useTheme();
    const timerRef       = useRef(null);
    const movedRef       = useRef(false);
    const longPressedRef = useRef(false);
    const startRef       = useRef({ x: 0, y: 0 });

    const assignees   = resolveAssigneeList(todo);
    // assignees 빈 배열일 때 getOptionLabel(undefined)이 "-" 반환하므로 명시 분기.
    const primaryName = assignees.length > 0 ? getOptionLabel(assignees[0]) : "";
    const noAssignee  = assignees.length === 0;
    const dueDate     = formatDueDate(todo);
    // 완료 판정은 isTodoDone 단일 소스 — 커스텀 완료 상태 컬럼의 카드도 취소선이 붙어야 한다
    const isDone      = isTodoDone(todo);
    const pColor      = priorityColor(theme, todo.priority);
    const { project, show: showProjectPill } = useProjectPill(todo);
    // priority bar는 LOW도 표시 (사용자 요청)
    const showPriorityBar = !isDone && !!todo.priority;

    const onTouchStart = (e) => {
        movedRef.current = false;
        longPressedRef.current = false;
        startRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        timerRef.current = setTimeout(() => {
            if (!movedRef.current) {
                longPressedRef.current = true;
                hapticMedium();
                if (navigator.vibrate) navigator.vibrate(8);
                onLongPress(todo);
            }
        }, 500);
    };
    const onTouchMove = (e) => {
        const dx = Math.abs(e.touches[0].clientX - startRef.current.x);
        const dy = Math.abs(e.touches[0].clientY - startRef.current.y);
        if (dx > 6 || dy > 6) {
            movedRef.current = true;
            clearTimeout(timerRef.current);
        }
    };
    const onTouchEnd = () => {
        clearTimeout(timerRef.current);
        if (!movedRef.current && !longPressedRef.current) onTap(todo.id);
    };

    return (
        <Box
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            sx={{
                position: "relative",
                background: t.cardBg,
                ...(isAndroid ? {} : { backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }),
                border: `1px solid ${t.cardBorder}`,
                borderRadius: "var(--plando-radius-card)",
                p: "12px 14px 10px 14px",
                mb: 1,
                cursor: "pointer",
                transition: "transform 0.14s ease",
                "&:active": { transform: "scale(0.98)" },
                userSelect: "none",
                WebkitUserSelect: "none",
                WebkitTouchCallout: "none",
                overflow: "hidden",
            }}
        >
            {/* 좌측 priority 막대 — 기존 그대로 */}
            {showPriorityBar && (
                <Box
                    sx={{
                        position: "absolute",
                        left: 0, top: 12, bottom: 12,
                        width: 3,
                        borderRadius: 999,
                        bgcolor: pColor,
                    }}
                />
            )}

            {/* title */}
            <Typography
                sx={{
                    fontSize: 14,
                    fontWeight: 600,
                    lineHeight: 1.4,
                    letterSpacing: "-0.02em",
                    color: isDone ? t.text3 : t.text,
                    textDecoration: isDone ? "line-through" : "none",
                    wordBreak: "break-word",
                    mb: todo.content ? 0.5 : 1,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                }}
            >
                {todo.title}
            </Typography>

            {/* content preview */}
            {todo.content && (
                <Typography
                    sx={{
                        fontSize: 12,
                        color: t.text2,
                        lineHeight: 1.4,
                        mb: 0.875,
                        display: "-webkit-box",
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        opacity: isDone ? 0.5 : 1,
                    }}
                >
                    {stripMarkdown(todo.content)}
                </Typography>
            )}

            {/* meta row: priority pill + assignees / due */}
            <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                spacing={1}
                sx={{ mt: 0.5 }}
            >
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0, flex: 1, flexWrap: "wrap", rowGap: 0.5 }}>
                    {/* 프로젝트 칩 (mock) — 전체 스코프에서만, 인박스/소속 없음이면 생략 */}
                    {showProjectPill && (() => {
                        const ProjIcon = getProjectIcon(project.icon);
                        return (
                            <Stack
                                direction="row"
                                alignItems="center"
                                spacing={0.5}
                                sx={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: isDone ? t.text3 : t.text2,
                                }}
                            >
                                <ProjIcon sx={{ fontSize: 13, color: projectIconColor(project.color) ?? "text.secondary", opacity: isDone ? 0.4 : 1, flexShrink: 0 }} />
                                <Box sx={{ maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {project.name}
                                </Box>
                            </Stack>
                        );
                    })()}

                    {!isDone && todo.priority && (
                        <PriorityPill priority={todo.priority} />
                    )}
                    {/* 참여자 없으면 표기 생략 — 빈 값은 채우지 않는다 */}
                    {!noAssignee && (
                        <>
                            <AvatarGroup
                                max={3}
                                sx={{ "& .MuiAvatar-root": { width: 18, height: 18, fontSize: 9, border: "1.5px solid", borderColor: t.cardBg } }}
                            >
                                {assignees.map((a, i) => {
                                    const name = getOptionLabel(a);
                                    const src = resolveImageUrl(a?.profileImageUrl);
                                    return (
                                        <Avatar key={i} src={src || undefined}>
                                            {!src && getInitial(name)}
                                        </Avatar>
                                    );
                                })}
                            </AvatarGroup>
                            {primaryName && (
                                <Typography sx={{ fontSize: 11, fontWeight: 500, color: t.text2, lineHeight: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {assignees.length > 1
                                        ? `${primaryName} 외 ${assignees.length - 1}`
                                        : primaryName}
                                </Typography>
                            )}
                        </>
                    )}
                </Stack>

                {dueDate && (
                    <Stack direction="row" spacing={0.35} alignItems="center" sx={{ flexShrink: 0 }}>
                        <ScheduleRoundedIcon sx={{ fontSize: 12, color: t.text3 }} />
                        <Typography sx={{ fontSize: 11, fontWeight: 500, color: t.text3 }}>{dueDate}</Typography>
                    </Stack>
                )}
            </Stack>
        </Box>
    );
}

// ── KanbanColumn ───────────────────────────────────────────────────
function KanbanColumn({ status, statusLabel, statusColor, list, t, isDark, onLongPress, onTap, onOpenAdd, onBulkArchive }) {
    const theme = useTheme();
    const meta = { label: statusLabel ?? STATUS_LABEL[status] ?? status, dot: statusColor ?? colDotColor(theme, status) };
    return (
        <Box sx={{
            flexShrink: 0,
            width: "calc(100vw - 6px)",
            maxWidth: 320,
            height: "96%",
            display: "flex",
            flexDirection: "column",
            background: t.colBg,
            ...(isAndroid ? {} : { backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)" }),
            border: `1px solid ${t.colBorder}`,
            borderRadius: "20px",
            overflow: "hidden",
        }}>
            {/* header */}
            <Box sx={{
                px: 2,
                py: 1.5,
                background: t.colHead,
                ...(isAndroid ? {} : { backdropFilter: "blur(16px)" }),
                borderBottom: `1px solid ${t.colBorder}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
            }}>
                <Stack direction="row" spacing={1} alignItems="center">
                    <Box sx={{
                        width: 8, height: 8,
                        borderRadius: "50%",
                        bgcolor: meta.dot,
                        flexShrink: 0,
                    }} />
                    <Typography sx={{
                        fontSize: 13.5,
                        fontWeight: 800,
                        letterSpacing: "-0.01em",
                        color: t.text,
                    }}>
                        {meta.label}
                    </Typography>
                </Stack>
                <Box sx={{
                    minWidth: 22, height: 22,
                    borderRadius: 999,
                    bgcolor: t.countBg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    px: 0.75,
                }}>
                    <Typography sx={{ fontSize: 11, fontWeight: 800, color: t.text2 }}>
                        {list.length}
                    </Typography>
                </Box>
            </Box>

            {/* cards */}
            <Box sx={{
                flex: 1,
                overflowY: "auto",
                overflowX: "hidden",
                px: 1.5,
                pt: 1.25,
                pb: 0.5,
                ...hideScrollbarSx,
            }}>
                {list.length === 0 && (
                    <Box sx={{
                        minHeight: 72,
                        border: `1.5px dashed ${isDark ? "rgba(255,255,255,0.10)" : "rgba(60,60,67,0.10)"}`,
                        borderRadius: "12px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        mb: 1,
                    }}>
                        <Typography sx={{ fontSize: 12, fontWeight: 500, color: t.text3 }}>비어있어요</Typography>
                    </Box>
                )}
                {list.map((todo) => (
                    <KanbanCard
                        key={todo.id}
                        todo={todo}
                        t={t}
                        onLongPress={onLongPress}
                        onTap={onTap}
                    />
                ))}
            </Box>

            {/* 아카이브 보기 — 완료 카테고리 컬럼만. 호출부가 category === "DONE"일 때만 핸들러를 넘긴다.
                (예전엔 statusKey === "DONE"까지 같이 봐서 커스텀 완료 컬럼에는 버튼이 안 떴다) */}
            {onBulkArchive && (
                <Box
                    onClick={onBulkArchive}
                    sx={{
                        mx: 1.5,
                        mb: 0.75,
                        py: 0.875,
                        border: `1px solid ${t.colBorder}`,
                        borderRadius: "12px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 0.5,
                        cursor: "pointer",
                        bgcolor: t.countBg,
                        "&:active": { opacity: 0.65 },
                    }}
                >
                    <Inventory2RoundedIcon sx={{ fontSize: 13, color: t.text2 }} />
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: t.text2 }}>아카이브 보기</Typography>
                </Box>
            )}

            {/* add button — 생성 권한이 없으면 아예 렌더하지 않는다 (데스크탑 BoardColumn과 동일) */}
            {onOpenAdd && (
                <Box
                    onClick={onOpenAdd}
                    sx={{
                        mx: 1.5,
                        mb: 1.5,
                        py: 0.9,
                        border: `1.5px dashed ${t.addBorder}`,
                        borderRadius: "12px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 0.5,
                        cursor: "pointer",
                        color: t.text2,
                        "&:active": { opacity: 0.65 },
                    }}
                >
                    <AddIcon sx={{ fontSize: 15 }} />
                    <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: t.text2 }}>추가</Typography>
                </Box>
            )}
        </Box>
    );
}

// ── MobileKanban (컨텍스트 sheet 보존, 외부 인터페이스 0 변화) ─────
export default function MobileKanban({
    grouped,
    isDark,
    onMoveStatus,
    onOpenDetail,
    onDelete,
    onOpenAddWithStatus,
    onBulkArchiveDone,
    onAddStatus,
    onManageStatuses,
    heightOffset = 0,
}) {
    const t = tok(isDark);
    const theme = useTheme();
    const { statuses: statusDefs, colorOf: statusColorOf } = useStatuses();
    const { canManageWorkspace, canEditContent, canDeleteTodo, myEmail, atLeast } = useWorkspacePermissions();
    const [ctxTodo, setCtxTodo] = useState(null);

    const handleLongPress = useCallback((todo) => setCtxTodo(todo), []);
    const handleTap       = useCallback((id)   => onOpenDetail(id), [onOpenDetail]);
    const closeCtx        = useCallback(()     => setCtxTodo(null), []);

    // swipe-down to dismiss sheet
    const sheetRef    = useRef(null);
    const swipeStartY = useRef(0);
    const swipeDeltaY = useRef(0);

    const onSheetTouchStart = useCallback((e) => {
        swipeStartY.current = e.touches[0].clientY;
        swipeDeltaY.current = 0;
        if (sheetRef.current) {
            sheetRef.current.style.transition = "none";
            sheetRef.current.style.transform  = "translateY(0)";
        }
    }, []);

    const onSheetTouchMove = useCallback((e) => {
        const dy = e.touches[0].clientY - swipeStartY.current;
        if (dy < 0) return;
        swipeDeltaY.current = dy;
        if (sheetRef.current) {
            sheetRef.current.style.transform = `translateY(${dy}px)`;
        }
    }, []);

    const onSheetTouchEnd = useCallback(() => {
        if (swipeDeltaY.current > 100) {
            closeCtx();
        } else if (sheetRef.current) {
            sheetRef.current.style.transition = "transform 0.25s ease";
            sheetRef.current.style.transform  = "translateY(0)";
        }
    }, [closeCtx]);

    const handleMove = useCallback((status) => {
        if (ctxTodo) onMoveStatus(ctxTodo.id, status);
        closeCtx();
    }, [ctxTodo, onMoveStatus, closeCtx]);

    const handleEdit = useCallback(() => {
        if (ctxTodo) onOpenDetail(ctxTodo.id);
        closeCtx();
    }, [ctxTodo, onOpenDetail, closeCtx]);

    const handleDelete = useCallback((e) => {
        if (ctxTodo) onDelete(e, ctxTodo);
        closeCtx();
    }, [ctxTodo, onDelete, closeCtx]);

    /* 권한 게이팅 — 서버 PermissionService와 같은 규칙으로, 실패할 액션은 아예 렌더하지 않고 이유를 적는다.
       · 상태 변경(=편집): MEMBER 이상 + 샘플 차단 (데모 워크스페이스는 전부 샘플이라 항상 403)
       · 삭제: ADMIN 이상 || 작성자 본인. 샘플은 ADMIN 이상만 삭제 가능(수정은 계속 불가) */
    const moveBlockedReason = !ctxTodo
        ? null
        : ctxTodo.isSample
            ? "샘플 할 일은 수정할 수 없어요."
            : !canEditContent ? "읽기 전용 권한이라 상태를 바꿀 수 없어요." : null;
    const canMoveCtx = Boolean(ctxTodo) && !moveBlockedReason;

    /* 작성자 판정은 목록 DTO(TodoResponseDto)의 `userEmail`이 유일한 소스다 — 여기서 직접 확인해
       perms.canDeleteTodo의 필드 가정과 무관하게 MEMBER가 자기 할 일을 지울 수 있게 한다.
       샘플은 서버가 "수정 불가 / 삭제는 ADMIN+만 허용"이라 그 규칙을 그대로 반영. */
    const isCtxAuthor = Boolean(myEmail) && Boolean(ctxTodo?.userEmail)
        && myEmail.toLowerCase() === ctxTodo.userEmail.toLowerCase();
    const isAdmin = atLeast("ADMIN");
    const canDeleteCtx = Boolean(ctxTodo)
        && (ctxTodo.isSample ? isAdmin : (isAdmin || isCtxAuthor || canDeleteTodo(ctxTodo)));
    const deleteBlockedReason = !ctxTodo || canDeleteCtx
        ? null
        : ctxTodo.isSample ? "샘플 할 일은 관리자만 삭제할 수 있어요." : "삭제는 작성자 또는 관리자만 할 수 있어요.";

    const moveTargets = canMoveCtx
        ? statusDefs.map((s) => s.statusKey).filter((s) => s !== ctxTodo.status)
        : [];

    return (
        <>
            {/* horizontal scroll kanban */}
            <Box sx={{
                display: "flex",
                flexDirection: "row",
                alignItems: "stretch",
                gap: "12px",
                overflowX: "auto",
                scrollSnapType: "x mandatory",
                scrollPaddingLeft: "20px",
                // 바텀네비 safe-area를 빼지 않으면 노치 기기에서 컬럼 하단이 네비 뒤로 잘림
                height: `calc(100dvh - ${210 + heightOffset}px - env(safe-area-inset-bottom, 0px))`,
                px: "20px",
                pb: "16px",
                pt: "4px",
                ...hideScrollbarSx,
                "& > *": { scrollSnapAlign: "start" },
            }}>
                {statusDefs.map((s) => (
                    <KanbanColumn
                        key={s.statusKey}
                        status={s.statusKey}
                        statusLabel={s.label}
                        statusColor={s.color}
                        list={grouped[s.statusKey] ?? []}
                        t={t}
                        isDark={isDark}
                        onLongPress={handleLongPress}
                        onTap={handleTap}
                        /* 생성 권한이 없으면 핸들러를 넘기지 않아 '추가' 버튼 자체가 사라진다 */
                        onOpenAdd={canEditContent ? () => onOpenAddWithStatus(s.statusKey) : undefined}
                        onBulkArchive={s.category === "DONE" ? onBulkArchiveDone : undefined}
                    />
                ))}
                {canManageWorkspace && (
                    <Stack spacing={1} sx={{ flexShrink: 0, width: 140, alignSelf: "flex-start", mt: 1 }}>
                        <Box onClick={onAddStatus} sx={{
                            height: 56,
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5,
                            borderRadius: 3, border: `1.5px dashed ${t.addBorder}`,
                            color: t.text3, fontSize: 14, fontWeight: 700, cursor: "pointer",
                            "&:active": { opacity: 0.65 },
                        }}>
                            + 상태 추가
                        </Box>
                        {/* 상태 관리 진입점 — 모바일엔 여기 말고 없었다(데스크탑에만 있어서 이름·순서·삭제를 못 건드렸음) */}
                        {onManageStatuses && (
                            <Box onClick={onManageStatuses} sx={{
                                py: 1,
                                display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5,
                                borderRadius: 2, color: t.text3, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                                "&:active": { opacity: 0.65 },
                            }}>
                                ⚙ 상태 관리
                            </Box>
                        )}
                    </Stack>
                )}
            </Box>

            {/* context sheet */}
            {ctxTodo && createPortal(
                <Box
                    onClick={closeCtx}
                    sx={{
                        position: "fixed",
                        inset: 0,
                        zIndex: Z.MODAL_NESTED,
                        background: t.ovBg,
                        ...(isAndroid ? {} : { backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }),
                        display: "flex",
                        alignItems: "flex-end",
                    }}
                >
                    <Box
                        ref={sheetRef}
                        onClick={(e) => e.stopPropagation()}
                        onTouchStart={onSheetTouchStart}
                        onTouchMove={onSheetTouchMove}
                        onTouchEnd={onSheetTouchEnd}
                        sx={{
                            width: "100%",
                            background: t.menuBg,
                            ...(isAndroid ? {} : { backdropFilter: "blur(40px)", WebkitBackdropFilter: "blur(40px)" }),
                            border: `1px solid ${t.menuBorder}`,
                            borderRadius: "20px 20px 0 0",
                            pt: 1.5,
                            pb: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
                            touchAction: "none",
                            willChange: "transform",
                        }}
                    >
                        <Box sx={{
                            width: 36, height: 4,
                            borderRadius: 2,
                            bgcolor: isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.14)",
                            mx: "auto",
                            mb: 2,
                        }} />

                        <Typography sx={{
                            px: 2.5,
                            pb: 1.5,
                            fontSize: 14.5,
                            fontWeight: 800,
                            letterSpacing: "-0.01em",
                            color: t.text,
                            borderBottom: `1px solid ${t.sep}`,
                            mb: 0.5,
                            lineHeight: 1.3,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        }}>
                            {ctxTodo.title}
                        </Typography>

                        {/* 실행 불가한 이유를 시트 안에서 바로 설명 — 메뉴가 말없이 사라지지 않도록 */}
                        {moveBlockedReason && (
                            <Typography sx={{ px: 2.5, py: 1.4, fontSize: 13, fontWeight: 600, color: t.text2, lineHeight: 1.5 }}>
                                {moveBlockedReason}
                            </Typography>
                        )}

                        {moveTargets.map((status) => (
                            <Box
                                key={status}
                                onClick={() => handleMove(status)}
                                sx={{
                                    px: 2.5, py: 1.4,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1.5,
                                    cursor: "pointer",
                                    "&:active": {
                                        bgcolor: "var(--plando-surface-low)",
                                    },
                                }}
                            >
                                <Box sx={{
                                    width: 8, height: 8,
                                    borderRadius: "50%",
                                    bgcolor: statusColorOf(status),
                                    flexShrink: 0,
                                }} />
                                <Typography sx={{ fontSize: 15, fontWeight: 600, color: t.text }}>
                                    {(statusDefs.find((d) => d.statusKey === status)?.label) ?? STATUS_LABEL[status] ?? status}(으)로 이동
                                </Typography>
                            </Box>
                        ))}

                        {moveTargets.length > 0 && <Box sx={{ my: 0.75, borderTop: `1px solid ${t.sep}` }} />}

                        <Box
                            onClick={handleEdit}
                            sx={{
                                px: 2.5, py: 1.4,
                                display: "flex",
                                alignItems: "center",
                                gap: 1.5,
                                cursor: "pointer",
                                "&:active": {
                                    bgcolor: "var(--plando-surface-low)",
                                },
                            }}
                        >
                            <EditOutlinedIcon sx={{ fontSize: 18, color: t.text2 }} />
                            <Typography sx={{ fontSize: 15, fontWeight: 600, color: t.text }}>
                                {canEditContent && !ctxTodo.isSample ? "상세 보기 / 편집" : "상세 보기"}
                            </Typography>
                        </Box>

                        {/* 삭제 버튼이 없는 이유를 밝힌다 */}
                        {deleteBlockedReason && (
                            <Typography sx={{ px: 2.5, py: 1.4, fontSize: 13, fontWeight: 600, color: t.text2, lineHeight: 1.5 }}>
                                {deleteBlockedReason}
                            </Typography>
                        )}

                        {/* 삭제 = ADMIN+ || 작성자 본인 (샘플은 ADMIN+만) */}
                        {canDeleteCtx && (
                            <Box
                                onClick={handleDelete}
                                sx={{
                                    px: 2.5, py: 1.4,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1.5,
                                    cursor: "pointer",
                                    "&:active": { bgcolor: alpha(theme.palette.error.main, 0.07) },
                                }}
                            >
                                <DeleteOutlineIcon sx={{ fontSize: 18, color: "var(--plando-red)" }} />
                                <Typography sx={{ fontSize: 15, fontWeight: 600, color: "var(--plando-red)" }}>
                                    삭제
                                </Typography>
                            </Box>
                        )}
                    </Box>
                </Box>,
                document.body
            )}
        </>
    );
}
