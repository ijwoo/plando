import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
    Box,
    CircularProgress,
    Collapse,
    IconButton,
    Stack,
    Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import RestoreRoundedIcon from "@mui/icons-material/RestoreRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";

import { fetchArchivedTodos, restoreTodo } from "../../api/todoApi.js";
import { getApiError } from "../../../../shared/api/axiosInstance.js";
import { toast } from "../../../../shared/utils/toast.js";
import { resolveAssigneeLabel } from "../../../../shared/utils/assigneeUtils.js";
import { formatMonthDay } from "../../../../shared/utils/formatters.js";
import { stripMarkdown } from "../../../../shared/utils/markdownUtils.jsx";
import { priorityColor } from "../../../../shared/ui/tone.js";
import { isTodoDone } from "../../../../shared/utils/todoStatus.js";
import { PriorityPill } from "../../../../shared/ui/common/Chips.jsx";
import CircleCheckbox from "../../../../shared/ui/common/CircleCheckbox.jsx";
import { getMobilePageBg } from "../../../../shared/ui/glassSx.js";
import { useProjectPill } from "../../../project/hooks/useProjectPill.js";
import { useOpenTodoDetail } from "../../hooks/useOpenTodoDetail.jsx";
import { Z } from "../../../../shared/ui/zIndex.js";
import { APP_EVENTS } from "../../../../shared/constants/events.js";
import Press from "../../../../shared/ui/primitives/Press.jsx";

/** 날짜 기준으로 "YYYY년 M월" 키 반환 */
function getMonthKey(todo) {
    const raw = todo.dueDate || todo.startAt || todo.createdAt;
    if (!raw) return "날짜 없음";
    const d = new Date(raw);
    if (isNaN(d)) return "날짜 없음";
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
}

/** 정렬 기준: 최신 월이 앞 */
function sortMonthKeysDesc(keys) {
    return [...keys].sort((a, b) => {
        if (a === "날짜 없음") return 1;
        if (b === "날짜 없음") return -1;
        // "2025년 3월" → 파싱
        const parse = (s) => {
            const m = s.match(/(\d+)년\s*(\d+)월/);
            return m ? parseInt(m[1]) * 100 + parseInt(m[2]) : 0;
        };
        return parse(b) - parse(a);
    });
}

function groupByMonth(todos) {
    const map = {};
    for (const todo of todos) {
        const key = getMonthKey(todo);
        if (!map[key]) map[key] = [];
        map[key].push(todo);
    }
    return map;
}

// ── 행 — 본 목록(MobileListView TaskRow)과 동일 문법: 체크 서클 + 제목/내용 + 메타 줄 ──
function TodoRow({ todo, isLast, onTap, onRestore }) {
    const theme = useTheme();
    // 완료 판정은 isTodoDone 단일 소스 — 커스텀 완료 상태도 체크·취소선이 붙어야 한다
    const isDone = isTodoDone(todo);
    const pColor = priorityColor(theme, todo.priority);
    const showPriorityBar = !isDone && todo.priority && todo.priority !== "LOW";
    const assigneeLabel = resolveAssigneeLabel(todo);
    const { project, show: showProjectPill } = useProjectPill(todo);

    return (
        <Press
            onClick={() => onTap(todo.id)}
            haptic="light"
            pressScale={0.99}
            activeBg="var(--plando-surface-faint)"
            style={{
                display: "flex",
                gap: 14,
                padding: "16px 20px",
                borderBottom: isLast ? "none" : `1px solid ${theme.palette.divider}`,
                alignItems: "flex-start",
                position: "relative",
            }}
        >
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
                {/* 표시 전용 — disabled는 Press가 0.5 투명 처리해 본 목록과 색이 달라지므로 no-op으로 */}
                <CircleCheckbox
                    checked={isDone}
                    onToggle={() => {}}
                    size={28}
                    accent={theme.palette.success.main}
                />
            </Box>

            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                    sx={{
                        fontSize: 16,
                        fontWeight: 600,
                        letterSpacing: "-0.02em",
                        lineHeight: 1.45,
                        color: isDone ? "text.disabled" : "text.primary",
                        textDecoration: isDone ? "line-through" : "none",
                        wordBreak: "break-word",
                        mb: 0.5,
                    }}
                >
                    {todo.title}
                </Typography>

                {todo.content && (
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
                        {stripMarkdown(todo.content)}
                    </Typography>
                )}

                {/* Meta row — 본 목록과 동일 구성 */}
                <Stack
                    direction="row"
                    alignItems="center"
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
                    {showProjectPill && (
                        <Stack
                            direction="row"
                            alignItems="center"
                            spacing={0.5}
                            sx={{ fontSize: 12, fontWeight: 600, color: isDone ? "text.disabled" : "text.secondary" }}
                        >
                            <Box
                                sx={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: "50%",
                                    bgcolor: project.color,
                                    opacity: isDone ? 0.4 : 1,
                                }}
                            />
                            <Box>{project.name}</Box>
                        </Stack>
                    )}
                    {!isDone && todo.priority && <PriorityPill priority={todo.priority} />}
                    {assigneeLabel && (
                        <Typography sx={{ fontSize: 12, fontWeight: 500, color: "text.disabled" }}>
                            {assigneeLabel}
                        </Typography>
                    )}
                    {todo.dueDate && (
                        <Typography sx={{ fontSize: 12, fontWeight: 500, color: "text.disabled", whiteSpace: "nowrap" }}>
                            {formatMonthDay(todo.dueDate)}
                        </Typography>
                    )}
                </Stack>
            </Box>

            {onRestore && (
                <IconButton
                    size="small"
                    onClick={(e) => { e.stopPropagation(); onRestore(todo.id); }}
                    sx={{ flexShrink: 0, color: "text.secondary", mt: 0.25, "&:active": { opacity: 0.6 } }}
                    title="복원"
                >
                    <RestoreRoundedIcon sx={{ fontSize: 18 }} />
                </IconButton>
            )}
        </Press>
    );
}

// ── 월 그룹 (접기/펼치기) — 본 목록 GroupHeader 톤 ─────────
function MonthGroup({ monthKey, todos, open, onToggle, onTap, onRestore }) {
    return (
        <Box>
            <Box
                onClick={onToggle}
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    px: 2.5,
                    pt: 2,
                    pb: 1,
                    cursor: "pointer",
                    "&:active": { opacity: 0.7 },
                }}
            >
                <Typography sx={{ fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em", color: "text.secondary" }}>
                    {monthKey}
                </Typography>
                <Typography sx={{ flex: 1, fontSize: 13, fontWeight: 700, color: "text.disabled", letterSpacing: "-0.01em" }}>
                    {todos.length}
                </Typography>
                <ExpandMoreRoundedIcon
                    sx={{
                        fontSize: 18,
                        color: "text.disabled",
                        flexShrink: 0,
                        transform: open ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.2s ease",
                    }}
                />
            </Box>

            <Collapse in={open} timeout={200}>
                <Box>
                    {todos.map((todo, i) => (
                        <TodoRow
                            key={todo.id}
                            todo={todo}
                            isLast={i === todos.length - 1}
                            onTap={onTap}
                            onRestore={onRestore}
                        />
                    ))}
                </Box>
            </Collapse>
        </Box>
    );
}

// ── 섹션 헤더 — 본 목록 GroupHeader와 동일 문법 ───────────
function SectionHeader({ label, count }) {
    return (
        <Stack direction="row" alignItems="baseline" spacing={1} sx={{ px: 2.5, pt: 3, pb: 0.5 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em", color: "text.secondary" }}>
                {label}
            </Typography>
            {count > 0 && (
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: "text.disabled", letterSpacing: "-0.01em" }}>
                    {count}
                </Typography>
            )}
        </Stack>
    );
}

function EmptyNotice({ text }) {
    return (
        <Typography sx={{ px: 2.5, py: 2.5, fontSize: 13, color: "text.disabled", textAlign: "center" }}>
            {text}
        </Typography>
    );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────
export default function MobileArchiveView({ doneTodos, onBack, onOpenDetail, onRestored }) {
    const theme = useTheme();
    const openTodoDetail = useOpenTodoDetail();

    const [archivedTodos, setArchivedTodos] = useState([]);
    const [loading, setLoading]             = useState(true);
    const [search, setSearch]               = useState("");

    // 접기/펼치기 상태: { [section_monthKey]: bool }
    const [openGroups, setOpenGroups] = useState({});

    const loadArchived = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetchArchivedTodos();
            setArchivedTodos(res.data ?? []);
        } catch {
            setArchivedTodos([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadArchived(); }, [loadArchived]);

    useEffect(() => {
        const handle = (e) => {
            if (e.detail?.archived) loadArchived();
        };
        window.addEventListener(APP_EVENTS.TODO_UPDATED, handle);
        return () => window.removeEventListener(APP_EVENTS.TODO_UPDATED, handle);
    }, [loadArchived]);

    const handleRestore = useCallback(async (id) => {
        try {
            await restoreTodo(id);
            setArchivedTodos((prev) => prev.filter((t) => t.id !== id));
            toast.success("복원됐어요.");
            onRestored?.();
        } catch (e) {
            toast.error(getApiError(e, "복원에 실패했어요."));
        }
    }, [onRestored]);

    const handleArchivedTap = useCallback((id) => {
        openTodoDetail(id, {
            onRestore: async () => { await handleRestore(id); },
        });
    }, [openTodoDetail, handleRestore]);

    const toggleGroup = useCallback((key) => {
        setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
    }, []);

    const q = search.trim().toLowerCase();

    // 완료된 작업 월별 그룹
    const doneGrouped = useMemo(() => {
        const filtered = doneTodos.filter((t) => !q || t.title?.toLowerCase().includes(q));
        return groupByMonth(filtered);
    }, [doneTodos, q]);
    const doneMonths = useMemo(() => sortMonthKeysDesc(Object.keys(doneGrouped)), [doneGrouped]);
    const doneTotalCount = useMemo(() => doneTodos.filter((t) => !q || t.title?.toLowerCase().includes(q)).length, [doneTodos, q]);

    // 아카이브 월별 그룹
    const archiveGrouped = useMemo(() => {
        const filtered = archivedTodos.filter((t) => !q || t.title?.toLowerCase().includes(q));
        return groupByMonth(filtered);
    }, [archivedTodos, q]);
    const archiveMonths = useMemo(() => sortMonthKeysDesc(Object.keys(archiveGrouped)), [archiveGrouped]);
    const archiveTotalCount = useMemo(() => archivedTodos.filter((t) => !q || t.title?.toLowerCase().includes(q)).length, [archivedTodos, q]);

    // 데이터 로드 후 각 섹션의 최신 월만 기본 오픈
    useEffect(() => {
        if (!loading) {
            setOpenGroups((prev) => {
                const next = { ...prev };
                if (doneMonths.length > 0 && prev[`done_${doneMonths[0]}`] === undefined) {
                    next[`done_${doneMonths[0]}`] = true;
                }
                if (archiveMonths.length > 0 && prev[`arch_${archiveMonths[0]}`] === undefined) {
                    next[`arch_${archiveMonths[0]}`] = true;
                }
                return next;
            });
        }
    }, [loading, doneMonths, archiveMonths]);

    return createPortal(
        <Box sx={{
            position: "fixed",
            inset: 0,
            zIndex: Z.SHEET,
            background: getMobilePageBg(theme),
            display: "flex",
            flexDirection: "column",
        }}>
            {/* 헤더 */}
            <Box sx={{
                flexShrink: 0,
                bgcolor: "background.default",
                borderBottom: `1px solid ${theme.palette.divider}`,
                pt: "calc(env(safe-area-inset-top) + 8px)",
                pb: 1.5,
            }}>
                <Stack direction="row" alignItems="center" spacing={0.5} sx={{ px: 1.5, mb: 1 }}>
                    <IconButton size="small" onClick={onBack} sx={{ color: "text.secondary" }}>
                        <ArrowBackIosNewRoundedIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                    <Typography sx={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em", color: "text.primary", flex: 1 }}>
                        완료 · 아카이브
                    </Typography>
                </Stack>

                {/* 검색 */}
                <Box sx={{
                    mx: 2, px: 1.5, height: 38, borderRadius: "12px",
                    background: "var(--plando-surface-low)",
                    display: "flex", alignItems: "center", gap: 1,
                }}>
                    <SearchRoundedIcon sx={{ fontSize: 17, color: "text.disabled", flexShrink: 0 }} />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="검색..."
                        style={{
                            flex: 1, border: "none", outline: "none", background: "transparent",
                            fontSize: 14, fontFamily: "inherit", color: theme.palette.text.primary,
                        }}
                    />
                    {search && (
                        <IconButton size="small" onClick={() => setSearch("")} sx={{ p: 0.25, color: "text.disabled" }}>
                            <CloseRoundedIcon sx={{ fontSize: 15 }} />
                        </IconButton>
                    )}
                </Box>
            </Box>

            {/* 콘텐츠 */}
            <Box sx={{ flex: 1, overflowY: "auto", pb: "calc(env(safe-area-inset-bottom) + 32px)" }}>

                {/* ── 완료된 작업 ── */}
                <SectionHeader label="완료된 작업" count={doneTotalCount} />
                {doneTotalCount === 0 ? (
                    <EmptyNotice text={q ? "검색 결과 없음" : "완료된 작업이 없어요"} />
                ) : (
                    doneMonths.map((month) => (
                        <MonthGroup
                            key={`done_${month}`}
                            monthKey={month}
                            todos={doneGrouped[month]}
                            open={!!openGroups[`done_${month}`]}
                            onToggle={() => toggleGroup(`done_${month}`)}
                            onTap={onOpenDetail}
                            onRestore={null}
                        />
                    ))
                )}

                {/* ── 아카이브 ── */}
                <SectionHeader label="아카이브" count={archiveTotalCount} />
                {loading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
                        <CircularProgress size={22} />
                    </Box>
                ) : archiveTotalCount === 0 ? (
                    <EmptyNotice text={q ? "검색 결과 없음" : "보관된 항목이 없어요"} />
                ) : (
                    archiveMonths.map((month) => (
                        <MonthGroup
                            key={`arch_${month}`}
                            monthKey={month}
                            todos={archiveGrouped[month]}
                            open={!!openGroups[`arch_${month}`]}
                            onToggle={() => toggleGroup(`arch_${month}`)}
                            onTap={handleArchivedTap}
                            onRestore={handleRestore}
                        />
                    ))
                )}
            </Box>
        </Box>,
        document.body
    );
}
