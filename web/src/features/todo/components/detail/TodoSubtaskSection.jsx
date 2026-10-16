import React, { useEffect, useState, useCallback } from "react";
import {
    Box,
    Typography,
    Checkbox,
    IconButton,
    TextField,
    LinearProgress,
    Stack,
    CircularProgress,
    useMediaQuery,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { fadeDividerSx } from "../../../../shared/ui/glassSx.js";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded";
import SubdirectoryArrowRightRoundedIcon from "@mui/icons-material/SubdirectoryArrowRightRounded";
import EventRoundedIcon from "@mui/icons-material/EventRounded";
import KeyboardArrowRightRoundedIcon from "@mui/icons-material/KeyboardArrowRightRounded";

import { fetchSubtasks } from "../../api/todoSubtaskApi.js";
import { addTodo, deleteTodo, updateTodoStatus, getTodoById } from "../../api/todoApi.js";
import AssigneeStack from "../../../../shared/ui/common/AssigneeStack.jsx";
import { resolveAssigneeList } from "../../../../shared/utils/assigneeUtils.js";
import { formatMonthDay } from "../../../../shared/utils/formatters.js";
import { useOpenTodoDetail } from "../../hooks/useOpenTodoDetail.jsx";
import ConfirmDialog from "../../../../shared/ui/common/ConfirmDialog.jsx";
import { toast } from "../../../../shared/utils/toast.js";
import { APP_EVENTS } from "../../../../shared/constants/events.js";
import EmptyState from "../../../../shared/ui/common/EmptyState.jsx";
import { defaultTodoStatusKey, doneTodoStatusKey, isTodoDone } from "../../../../shared/utils/todoStatus.js";
import { useStatuses } from "../../../workspace/context/StatusContext.jsx";

/** 부모 todo 카운트 배지(subtaskTotal/Done) 갱신을 목록/보드에 전파 */
function dispatchParentCounts(parentTodoId, items) {
    if (!parentTodoId) return;
    const subtaskTotal = items.length;
    const subtaskDone = items.filter((s) => isTodoDone(s)).length;
    window.dispatchEvent(new CustomEvent(APP_EVENTS.TODO_UPDATED, {
        detail: { id: parentTodoId, patch: { subtaskTotal, subtaskDone } },
    }));
}

/**
 * 서브태스크 섹션.
 *
 * "서브태스크" = parentId로 묶인 실제 todo. 각각 자기 상세(댓글·첨부)를 가진다.
 *
 * Props:
 *  - todoId: 현재 상세로 열린 todo id
 *  - parentId: 현재 todo의 부모 id(있으면 이 todo 자체가 서브태스크 → 브레드크럼만 표시)
 *
 * 두 가지 렌더:
 *  1) parentId != null  → "상위 할 일" 브레드크럼(부모 제목, 클릭 시 부모 상세) — 깊이 1단계라 추가 UI 없음
 *  2) parentId == null  → 서브태스크 목록 + 진행률 + 인라인 추가/삭제/완료 토글
 */
export default function TodoSubtaskSection({ todoId, parentId }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));
    const openTodoDetail = useOpenTodoDetail();

    /* ── 컨테이너 스타일 ── */
    const containerSx = isMobile ? {
        borderRadius: "16px",
        boxShadow: "var(--plando-elev-1)",
        bgcolor: "background.paper",
        overflow: "hidden",
        mb: "10px",
    } : {
        borderRadius: 3,
        boxShadow: "var(--plando-elev-1)",
        bgcolor: "background.paper",
        p: 2,
        mb: 1.5,
    };
    const innerPad = isMobile ? { px: 2, pt: 2, pb: 1.5 } : {};

    // ─────────────────────────────────────────────
    // CASE 1) 이 todo 자체가 서브태스크 → 상위 할 일 브레드크럼
    // ─────────────────────────────────────────────
    if (parentId != null) {
        return <ParentBreadcrumb parentId={parentId} containerSx={containerSx} innerPad={innerPad} isMobile={isMobile} onOpen={openTodoDetail} />;
    }

    // ─────────────────────────────────────────────
    // CASE 2) 부모 → 서브태스크 목록
    // ─────────────────────────────────────────────
    return <SubtaskList todoId={todoId} containerSx={containerSx} innerPad={innerPad} isMobile={isMobile} isDark={isDark} theme={theme} onOpen={openTodoDetail} />;
}

/* ── 상위 할 일 브레드크럼 ── */
function ParentBreadcrumb({ parentId, containerSx, innerPad, isMobile, onOpen }) {
    const [parent, setParent] = useState(null);

    useEffect(() => {
        let mounted = true;
        if (!parentId) return;
        getTodoById(parentId)
            .then((res) => { if (mounted) setParent(res.data); })
            .catch((e) => console.error("상위 할 일 조회 실패", e));
        return () => { mounted = false; };
    }, [parentId]);

    if (!parent) return null;

    return (
        <Box sx={containerSx}>
            <Box
                onClick={() => onOpen(parent.id)}
                sx={{
                    ...innerPad,
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    cursor: "pointer",
                    borderRadius: isMobile ? 0 : 2,
                    "&:hover .parent-title": { color: "primary.main" },
                }}
            >
                <SubdirectoryArrowRightRoundedIcon sx={{ fontSize: isMobile ? 16 : 18, color: "text.disabled", transform: "rotate(180deg) scaleX(-1)" }} />
                <Stack sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 11, fontWeight: 800, color: "text.disabled", letterSpacing: "-0.01em" }}>
                        상위 할 일
                    </Typography>
                    <Typography
                        className="parent-title"
                        sx={{
                            fontSize: isMobile ? 15 : 14,
                            fontWeight: 700,
                            color: "text.primary",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            transition: "color .15s ease",
                        }}
                    >
                        {parent.title || "(제목 없음)"}
                    </Typography>
                </Stack>
                <KeyboardArrowRightRoundedIcon sx={{ fontSize: 20, color: "text.disabled", flexShrink: 0 }} />
            </Box>
        </Box>
    );
}

/* ── 서브태스크 목록 ── */
function SubtaskList({ todoId, containerSx, innerPad, isMobile, isDark, theme, onOpen }) {
    const { statuses } = useStatuses();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newTitle, setNewTitle] = useState("");
    const [adding, setAdding] = useState(false);
    const [hoveredId, setHoveredId] = useState(null);
    // 서브태스크는 자기 상세(댓글·첨부)를 가진 실제 todo → 삭제 전 확인 (다른 todo 삭제와 동일 규칙)
    const [deleteTarget, setDeleteTarget] = useState(null);

    const load = useCallback(async () => {
        if (!todoId) return;
        try {
            const res = await fetchSubtasks(todoId);
            setItems(res.data ?? []);
        } catch (e) {
            console.error("서브태스크 로드 실패", e);
        } finally {
            setLoading(false);
        }
    }, [todoId]);

    useEffect(() => { load(); }, [load]);

    const doneCount = items.filter((i) => isTodoDone(i)).length;
    const total = items.length;
    const progress = total > 0 ? Math.round((doneCount / total) * 100) : 0;

    const handleToggle = async (item) => {
        // 리터럴 대신 워크스페이스의 실제 상태 key — 'DONE'을 지운 워크스페이스에서 400이 나고,
        // 커스텀 완료 상태 항목은 값이 덮여 되돌릴 수 없다.
        const next = isTodoDone(item) ? defaultTodoStatusKey(statuses) : doneTodoStatusKey(statuses);
        const snapshot = [...items];
        const optimistic = items.map((i) => (i.id === item.id ? { ...i, status: next } : i));
        setItems(optimistic);
        try {
            await updateTodoStatus(item.id, next);
            window.dispatchEvent(new CustomEvent(APP_EVENTS.TODO_UPDATED, { detail: { id: item.id, patch: { status: next } } }));
            dispatchParentCounts(todoId, optimistic);
        } catch (e) {
            setItems(snapshot);
            toast.error(e?.response?.data?.message || "서브태스크 수정 중 오류가 발생했어요.");
        }
    };

    const handleAdd = async () => {
        const title = newTitle.trim();
        if (!title) return;
        setAdding(true);
        try {
            // 'TODO' 리터럴 금지 — 그 key를 지운 워크스페이스에서 400이 난다
            const res = await addTodo({
                title,
                status: defaultTodoStatusKey(statuses),
                priority: "MEDIUM",
                parentId: todoId,
            });
            const next = res.data ? [...items, res.data] : items;
            setItems(next);
            setNewTitle("");
            dispatchParentCounts(todoId, next);
            /* 목록·보드·캘린더는 각자 배열을 들고 TODO_ADDED 로만 항목을 추가한다.
               이 이벤트를 안 쏘면 새 서브태스크가 그 배열에 영영 안 들어가서,
               새로고침(GET /todos가 서브태스크도 내려줌) 전까지 목록에 나타나지 않았다. */
            if (res.data) {
                window.dispatchEvent(new CustomEvent(APP_EVENTS.TODO_ADDED, { detail: res.data }));
            }
        } catch (e) {
            toast.error(e?.response?.data?.message || "서브태스크 추가 중 오류가 발생했어요.");
        } finally {
            setAdding(false);
        }
    };

    const handleKeyDown = (e) => {
        // IME 조합 중 Enter 무시 — 한글 마지막 글자 중복 입력 방지
        if (e.nativeEvent?.isComposing || e.keyCode === 229) return;
        if (e.key === "Enter") { e.preventDefault(); handleAdd(); }
    };

    const handleDelete = async (id) => {
        const next = items.filter((i) => i.id !== id);
        setItems(next);
        try {
            await deleteTodo(id); // 내부에서 TODO_DELETED 전파
            dispatchParentCounts(todoId, next);
        } catch (e) {
            load();
            toast.error(e?.response?.data?.message || "서브태스크 삭제 중 오류가 발생했어요.");
        }
    };

    if (loading) {
        return (
            <Box sx={{ ...containerSx, display: "flex", alignItems: "center", gap: 1, p: 2 }}>
                <CircularProgress size={16} />
                <Typography variant="caption" color="text.secondary">서브태스크 로딩 중...</Typography>
            </Box>
        );
    }

    return (
        <Box sx={containerSx}>
            <Box sx={innerPad}>
                {/* 헤더 — AccountTree 아이콘 + "서브태스크" */}
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                    <AccountTreeRoundedIcon sx={{ fontSize: isMobile ? 16 : 18, color: "text.secondary" }} />
                    <Typography sx={{ fontSize: 13, fontWeight: 800, color: "text.secondary", flex: 1 }}>
                        서브태스크
                    </Typography>
                    {total > 0 && (
                        <Typography sx={{ fontSize: 12, color: "text.secondary", fontWeight: 700 }}>
                            {doneCount}/{total}
                        </Typography>
                    )}
                </Stack>

                {/* 진행률 바 */}
                {total > 0 && (
                    <Box sx={{ mb: 1.5 }}>
                        <LinearProgress
                            variant="determinate"
                            value={progress}
                            sx={{
                                height: isMobile ? 5 : 6,
                                borderRadius: 999,
                                bgcolor: isDark ? alpha("#fff", 0.1) : alpha("#000", 0.08),
                                "& .MuiLinearProgress-bar": {
                                    borderRadius: 999,
                                    bgcolor: progress === 100 ? "success.main" : "primary.main",
                                },
                            }}
                        />
                        <Typography
                            variant="caption"
                            color={progress === 100 ? "success.main" : "text.secondary"}
                            sx={{ mt: 0.4, display: "block", fontWeight: 700, fontSize: 11 }}
                        >
                            {progress}% 완료
                        </Typography>
                    </Box>
                )}

                {/* 0개일 때 헤더가 입력창에 바로 붙어 간격만 무너졌다 */}
                {total === 0 && (
                    <EmptyState
                        emoji="🧩"
                        title="서브태스크가 없어요"
                        desc="큰 일을 작은 단계로 쪼개면 진행률이 보여요."
                        size="sm"
                        sx={{ py: 2 }}
                    />
                )}

                {/* 항목 목록 */}
                <Stack spacing={isMobile ? 0 : 1.5} sx={{ mb: total > 0 ? 1.5 : 0 }}>
                    {items.map((item) => {
                        const isDone = isTodoDone(item); // 커스텀 완료 상태 대응(진행률은 이미 isTodoDone을 쓰고 있었다)
                        const assignees = resolveAssigneeList(item);
                        return (
                            <Box
                                key={item.id}
                                onMouseEnter={() => !isMobile && setHoveredId(item.id)}
                                onMouseLeave={() => !isMobile && setHoveredId(null)}
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 0.5,
                                    borderRadius: isMobile ? 0 : 2,
                                    px: isMobile ? 0 : 0.5,
                                    py: isMobile ? 0.75 : 0,
                                    ...(isMobile ? fadeDividerSx(theme.palette.divider, "bottom") : {}),
                                    "&:last-child": isMobile ? { backgroundImage: "none" } : {},
                                    "&:hover": !isMobile ? {
                                        bgcolor: isDark ? alpha("#fff", 0.05) : alpha("#000", 0.04),
                                    } : {},
                                }}
                            >
                                <Checkbox
                                    checked={isDone}
                                    onChange={() => handleToggle(item)}
                                    size="small"
                                    sx={{
                                        p: isMobile ? 0.75 : 0.5,
                                        color: "text.disabled",
                                        "&.Mui-checked": { color: "success.main" },
                                    }}
                                />
                                {/* 제목 — 클릭 시 그 서브태스크의 상세 열기 */}
                                <Typography
                                    onClick={() => onOpen(item.id)}
                                    sx={{
                                        flex: 1,
                                        minWidth: 0,
                                        fontSize: isMobile ? 15 : 14,
                                        color: isDone ? "text.disabled" : "text.primary",
                                        textDecoration: isDone ? "line-through" : "none",
                                        lineHeight: 1.5,
                                        wordBreak: "break-word",
                                        cursor: "pointer",
                                        "&:hover": { color: "primary.main" },
                                    }}
                                >
                                    {item.title || "(제목 없음)"}
                                </Typography>
                                {/* 마감 칩 */}
                                {item.dueDate && (
                                    <Stack
                                        direction="row"
                                        alignItems="center"
                                        spacing={0.25}
                                        sx={{ color: "text.disabled", fontSize: 11, fontWeight: 700, flexShrink: 0 }}
                                    >
                                        <EventRoundedIcon sx={{ fontSize: 12 }} />
                                        {formatMonthDay(item.dueDate)}
                                    </Stack>
                                )}
                                {/* 담당자 아바타 */}
                                {assignees.length > 0 && (
                                    <Box sx={{ flexShrink: 0 }}>
                                        <AssigneeStack assignees={assignees} size={20} max={2} overlap={-6} />
                                    </Box>
                                )}
                                {/* 모바일: 항상 표시 / 데스크탑: hover시 표시 */}
                                {(isMobile || hoveredId === item.id) && (
                                    <IconButton
                                        size="small"
                                        onClick={() => setDeleteTarget(item)}
                                        sx={{
                                            color: "text.disabled",
                                            p: isMobile ? 1 : 0.5,
                                            flexShrink: 0,
                                            "&:hover": { color: "error.main" },
                                        }}
                                    >
                                        <DeleteOutlineRoundedIcon sx={{ fontSize: isMobile ? 18 : 16 }} />
                                    </IconButton>
                                )}
                            </Box>
                        );
                    })}
                </Stack>

                {/* 항목 추가 */}
                <Stack direction="row" spacing={1} alignItems="center">
                    <TextField
                        size="small"
                        fullWidth
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onFocus={(e) => {
                            if (isMobile) {
                                setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "nearest" }), 350);
                            }
                        }}
                        placeholder="서브태스크 추가..."
                        disabled={adding}
                        sx={{
                            "& .MuiOutlinedInput-root": {
                                borderRadius: 2,
                                fontSize: isMobile ? 15 : 13,
                                bgcolor: isDark ? alpha("#fff", 0.04) : alpha("#000", 0.03),
                            },
                        }}
                    />
                    <IconButton
                        size="small"
                        onClick={handleAdd}
                        disabled={!newTitle.trim() || adding}
                        color="primary"
                        sx={{
                            width: isMobile ? 40 : 34,
                            height: isMobile ? 40 : 34,
                            flexShrink: 0,
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                            "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.2) },
                            "&.Mui-disabled": { opacity: 0.4 },
                        }}
                    >
                        {adding ? <CircularProgress size={16} /> : <AddRoundedIcon sx={{ fontSize: isMobile ? 20 : 18 }} />}
                    </IconButton>
                </Stack>
            </Box>

            <ConfirmDialog
                open={Boolean(deleteTarget)}
                title="삭제 확인"
                message={
                    deleteTarget?.title
                        ? `"${deleteTarget.title}" 삭제할까요?\n삭제하면 되돌릴 수 없어요.`
                        : "이 서브태스크를 삭제할까요?\n삭제하면 되돌릴 수 없어요."
                }
                confirmText="삭제"
                confirmColor="error"
                onClose={() => setDeleteTarget(null)}
                onConfirm={() => {
                    const target = deleteTarget;
                    setDeleteTarget(null);
                    if (target) handleDelete(target.id);
                }}
            />
        </Box>
    );
}
