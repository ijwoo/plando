import React, { useEffect, useMemo, useRef, useState } from "react";
import RGL, { WidthProvider } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { Box, Typography, Stack, IconButton, Menu, MenuItem, Tooltip, ListItemIcon } from "@mui/material";
import { useNavigate } from "react-router-dom";
import DragIndicatorRoundedIcon from "@mui/icons-material/DragIndicatorRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import TodayRoundedIcon from "@mui/icons-material/TodayRounded";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import TimelineRoundedIcon from "@mui/icons-material/TimelineRounded";
import CenterFocusStrongRoundedIcon from "@mui/icons-material/CenterFocusStrongRounded";
import DonutLargeRoundedIcon from "@mui/icons-material/DonutLargeRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import ListAltRoundedIcon from "@mui/icons-material/ListAltRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import RoomRoundedIcon from "@mui/icons-material/RoomRounded";

import { useProjects } from "../../project/store/projectStore.js";
import { useWorkspace } from "../../workspace/context/WorkspaceContext.jsx";
import { loadRecentTodos } from "../../todo/utils/recentTodos.js";
import { getProjectIcon } from "../../project/projectIcons.js";
import { getTaskPath } from "../../todo/utils/taskView.js";
import { StatusTag } from "../../../shared/ui/common/Tags.jsx";
import { resolveImageUrl } from "../../../shared/utils/urlUtils.js";
import { formatTimeAgo } from "../../../shared/utils/formatters.js";
import { filterActivities, formatModifierName } from "../utils/dashboardUtils.js";
import { getMySettings, updateMySettings } from "../../settings/api/settingsApi.js";
import { APP_EVENTS } from "../../../shared/constants/events.js";
import UserAvatar from "../../../shared/ui/common/UserAvatar.jsx";
import TodayFocusHero from "../components/desktop/TodayFocusHero.jsx";
import CompletionRing from "../components/desktop/CompletionRing.jsx";
import TeamStatusList from "../components/desktop/TeamStatusList.jsx";
import ProjectCreateDialog from "../../project/components/ProjectCreateDialog.jsx";
import MiniMonthCalendar from "../../calendar/components/MiniMonthCalendar.jsx";
import { toCalendarEvent } from "../../calendar/utils/calendarUtils.js";
import { MemoCard, BookmarksCard, FavoritesCard, ADD_STICKY_EVENT, ADD_BOOKMARK_EVENT, ADD_FAVORITE_EVENT } from "./DashboardExtraCards.jsx";
import StickyNote2RoundedIcon from "@mui/icons-material/StickyNote2Rounded";
import BookmarkRoundedIcon from "@mui/icons-material/BookmarkRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import { isTodoDone } from "../../../shared/utils/todoStatus.js";

const GridLayout = WidthProvider(RGL);
const COLS = 4;        // 기본 2열 = w:2 (절반), 전체폭 = w:4
const ROW_H = 78;      // 행 높이(px) — h 단위 × ROW_H
const MARGIN = 10;     // 카드 사이/가장자리 여백

// 레이아웃은 유저 전역(워크스페이스 무관) — DB(UserSettings.dashboardLayout)와 동일하게 단일 키.
const LS_KEY = "plando.dashboardGrid";
const ALL_KEYS = ["list", "recent", "today", "quicklinks", "minical", "projects", "activity", "focus", "completion", "team", "memo", "bookmarks", "favorites"];
// {i,x,y,w,h} — w는 COLS(4) 기준.
// 기본 레이아웃은 "초점 하나 + 보조" 위계로 짠다.
//  1단 포커스 히어로(전체폭, 화면에서 가장 큰 덩어리) → 2단 오늘·미니캘린더(반반)
//  → 3단 할 일 목록·최근 활동(반반, 밀도 낮은 마감 밴드).
// "최근 본 항목"은 할 일 목록과 생김새·역할이 겹쳐 기본에서 뺐다(카드 추가로 언제든 복구).
const DEFAULT_LAYOUT = [
    { i: "focus",    x: 0, y: 0,  w: 4, h: 5, minW: 2, minH: 3 },
    { i: "today",    x: 0, y: 5,  w: 2, h: 5, minW: 1, minH: 2 },
    { i: "minical",  x: 2, y: 5,  w: 2, h: 5, minW: 1, minH: 4 },
    { i: "list",     x: 0, y: 10, w: 2, h: 4, minW: 1, minH: 2 },
    { i: "activity", x: 2, y: 10, w: 2, h: 4, minW: 1, minH: 2 },
];
const cloneDefaultLayout = () => DEFAULT_LAYOUT.map((l) => ({ ...l }));

const clampInt = (v, min, max, fallback) => {
    const n = Math.round(Number(v));
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
};

// 저장된 레이아웃 방어 — 모르는 카드 키/중복 키/깨진 좌표가 섞여도 그리드가 죽지 않게 정규화.
// (스키마는 그대로 {i,x,y,w,h,minW,minH} — 저장 포맷을 바꾸지 않는다)
function sanitizeLayout(raw) {
    if (!Array.isArray(raw)) return null;
    const seen = new Set();
    const out = [];
    for (const l of raw) {
        if (!l || typeof l !== "object") continue;
        if (!ALL_KEYS.includes(l.i) || seen.has(l.i)) continue;
        seen.add(l.i);
        const w = clampInt(l.w, 1, COLS, 2);
        out.push({
            i: l.i,
            x: clampInt(l.x, 0, COLS - w, 0),
            y: clampInt(l.y, 0, 999, 0),
            w,
            h: clampInt(l.h, 1, 99, 3),
            minW: clampInt(l.minW, 1, COLS, 1),
            minH: clampInt(l.minH, 1, 99, 2),
        });
    }
    return out.length ? out : null;
}

function loadLayout() {
    try {
        const stored = sanitizeLayout(JSON.parse(localStorage.getItem(LS_KEY)));
        if (stored) return stored;
    } catch { /* ignore */ }
    return cloneDefaultLayout();
}
function saveLayout(layout) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(layout)); } catch { /* ignore */ }
}

// ── 카드 셸 (정적 비주얼 — Sortable/DragOverlay 공용) ──────────────────────
// 편집 크롬(드래그 손잡이·숨기기)은 평소엔 감추고 hover/focus-within일 때만 드러낸다.
// opacity만 0으로 두므로 자리는 그대로 → 드러날 때 제목이 밀리지 않고, 키보드 Tab으로도 그대로 닿는다.
const CHROME_CLASS = "card-edit-chrome";
const CHROME_HIDDEN_SX = {
    opacity: 0,
    transition: "opacity 0.15s ease",
    "&:focus-visible": { opacity: 1 },
    "@media (hover: none)": { opacity: 1 }, // 터치 기기엔 hover가 없으므로 항상 노출
};

function CardShell({ title, icon, onRemove, onAddItem, addTooltip = "추가", handleProps, overlay = false, children }) {
    const { className: handleClassName, ...restHandleProps } = handleProps || {};
    return (
        <Box
            sx={{
                display: "flex", flexDirection: "column", minWidth: 0,
                height: "100%",
                borderRadius: "var(--plando-radius-card)",
                bgcolor: "background.paper",
                border: "1px solid",
                borderColor: overlay ? "primary.main" : "divider",
                boxShadow: overlay ? "0 16px 40px rgba(15,23,42,0.22)" : "var(--plando-shadow-card-ring, 0 1px 3px rgba(15,23,42,0.06))",
                overflow: "hidden",
                [`&:hover .${CHROME_CLASS}, &:focus-within .${CHROME_CLASS}`]: { opacity: 1 },
            }}
        >
            <Stack direction="row" alignItems="center" spacing={0.75} sx={{ px: 1.75, py: 1.25, borderBottom: "1px solid", borderColor: "divider" }}>
                <Box
                    {...restHandleProps}
                    className={[CHROME_CLASS, handleClassName].filter(Boolean).join(" ")}
                    sx={{ display: "flex", cursor: handleProps ? "grab" : "default", color: "text.disabled", touchAction: "none", "&:active": { cursor: "grabbing" }, ...CHROME_HIDDEN_SX }}
                    aria-label="카드 이동"
                >
                    <DragIndicatorRoundedIcon sx={{ fontSize: 18 }} />
                </Box>
                {icon}
                <Typography sx={{ flex: 1, fontSize: 14, fontWeight: 800, letterSpacing: "-0.01em", color: "text.primary" }} noWrap>
                    {title}
                </Typography>
                {onAddItem && (
                    <Tooltip title={addTooltip} placement="top">
                        <IconButton size="small" onClick={onAddItem} sx={{ color: "primary.main" }}>
                            <AddRoundedIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                    </Tooltip>
                )}
                {onRemove && (
                    <Tooltip title="카드 숨기기" placement="top">
                        <IconButton size="small" onClick={onRemove} className={CHROME_CLASS} aria-label={`${title} 카드 숨기기`} sx={{ color: "text.disabled", ...CHROME_HIDDEN_SX }}>
                            <CloseRoundedIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                    </Tooltip>
                )}
            </Stack>
            <Box className="plando-scroll" sx={{ flex: 1, minHeight: 0, overflowY: "auto", p: 1.75 }}>{children}</Box>
        </Box>
    );
}

function EmptyHint({ children, onAdd, addLabel = "추가하기" }) {
    return (
        <Stack alignItems="center" justifyContent="center" spacing={1.25} sx={{ height: "100%", minHeight: 80, py: 2, color: "text.disabled" }}>
            <Typography sx={{ fontSize: 13, textAlign: "center" }}>{children}</Typography>
            {onAdd && (
                <Box
                    component="button"
                    onClick={onAdd}
                    sx={{
                        display: "inline-flex", alignItems: "center", gap: 0.5,
                        px: 1.5, py: 0.75, borderRadius: "10px",
                        border: "1px dashed", borderColor: "divider", bgcolor: "transparent",
                        cursor: "pointer", color: "primary.main", fontSize: 12.5, fontWeight: 700, fontFamily: "inherit",
                        transition: "background 0.15s, border-color 0.15s",
                        "&:hover": { bgcolor: "action.hover", borderColor: "primary.main" },
                    }}
                >
                    <AddRoundedIcon sx={{ fontSize: 16 }} /> {addLabel}
                </Box>
            )}
        </Stack>
    );
}

function StatusDot({ status }) {
    return <StatusTag status={status} variant="dot" size="sm" />;
}

// 미니 캘린더 카드 — 월 이동/날짜 선택 + 카드를 아래로 넓히면 그 날 일정이 리스트로.
function MiniCalendarCard({ events, onOpenEvent }) {
    const [date, setDate] = useState(() => new Date());
    const [selected, setSelected] = useState(() => new Date());
    const navMonth = (delta) => setDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));

    const dayEvents = useMemo(() => {
        const sel = new Date(selected); sel.setHours(0, 0, 0, 0);
        const selT = sel.getTime();
        return (events || []).filter((e) => {
            const s = new Date(e.start); s.setHours(0, 0, 0, 0);
            let end = e.end ? new Date(e.end) : new Date(e.start);
            // all-day 종료가 다음날 자정으로 표기된 경우 inclusive로 보정
            if (e.end && end.getHours() === 0 && end.getMinutes() === 0) {
                const sd = new Date(e.start); sd.setHours(0, 0, 0, 0);
                if (end.getTime() !== sd.getTime()) end = new Date(end.getTime() - 60000);
            }
            end.setHours(0, 0, 0, 0);
            return selT >= s.getTime() && selT <= end.getTime();
        }).sort((a, b) => new Date(a.start) - new Date(b.start));
    }, [events, selected]);

    const pad = (n) => String(n).padStart(2, "0");
    const timeOf = (e) => (e.allDay ? null : `${pad(new Date(e.start).getHours())}:${pad(new Date(e.start).getMinutes())}`);

    return (
        <Stack sx={{ height: "100%", minHeight: 0 }}>
            <Box sx={{ flexShrink: 0 }}>
                <MiniMonthCalendar
                    date={date}
                    selectedDate={selected}
                    events={events}
                    onSelectDate={(d) => { setSelected(d); setDate(d); }}
                    onNavigatePrev={() => navMonth(-1)}
                    onNavigateNext={() => navMonth(1)}
                />
            </Box>
            <Box className="plando-scroll" sx={{ flex: 1, minHeight: 0, overflowY: "auto", mt: 1.25, pt: 1, borderTop: "1px solid", borderColor: "divider" }}>
                <Typography sx={{ fontSize: 11, fontWeight: 800, color: "text.disabled", px: 0.5, pb: 0.5 }}>
                    {selected.getMonth() + 1}월 {selected.getDate()}일 · {dayEvents.length}건
                </Typography>
                {dayEvents.length === 0 ? (
                    <Typography sx={{ fontSize: 12.5, color: "text.disabled", textAlign: "center", py: 1.5 }}>일정이 없어요</Typography>
                ) : (
                    <Stack spacing={0.25}>
                        {dayEvents.map((e) => (
                            <Stack key={e.id} direction="row" alignItems="center" spacing={1} onClick={() => onOpenEvent?.(e.id)}
                                sx={{ px: 0.75, py: 0.6, borderRadius: "8px", cursor: "pointer", "&:hover": { bgcolor: "action.hover" } }}>
                                <StatusDot status={e.resource?.status ?? "TODO"} />
                                <Typography sx={{ flex: 1, fontSize: 12.5, fontWeight: 600 }} noWrap>{e.title}</Typography>
                                {timeOf(e) && <Typography sx={{ fontSize: 11, color: "text.disabled", flexShrink: 0 }}>{timeOf(e)}</Typography>}
                            </Stack>
                        ))}
                    </Stack>
                )}
            </Box>
        </Stack>
    );
}

export default function OverviewDashboard({ data, onAddTask }) {
    const navigate = useNavigate();
    const projects = useProjects();
    const { currentWorkspace } = useWorkspace();
    const wsId = currentWorkspace?.workspaceId;
    const {
        allTasks, recentActivity, userImageMap, presenceMap,
        overdueTasks, todayTodos, openTaskDetail,
        weeklyCompletionRate, weeklyDelta, weeklyBarData, memberStats,
    } = data;

    // 최근 본 항목 — 워크스페이스별 키. 워크스페이스 변경/기록 변경/탭 복귀 시 재로드.
    const [recent, setRecent] = useState(loadRecentTodos);
    useEffect(() => {
        const reload = () => setRecent(loadRecentTodos());
        reload(); // 워크스페이스 전환 시 현재 ws 기준으로 다시 읽음
        window.addEventListener(APP_EVENTS.RECENT_TODOS_CHANGED, reload);
        window.addEventListener("visibilitychange", reload);
        return () => {
            window.removeEventListener(APP_EVENTS.RECENT_TODOS_CHANGED, reload);
            window.removeEventListener("visibilitychange", reload);
        };
    }, [wsId]);
    // 샘플(둘러보기 예시) 제외 플래그는 서버 필드명이 `isSample`이다.
    // `t.sample`은 항상 undefined라 이 필터가 아무것도 걸러내지 못했고, 둘러보기 첫 화면에
    // 예시 할 일이 그대로 섞여 나왔다 (앱의 다른 6곳은 처음부터 isSample을 쓰고 있었다).
    const focusedTask = useMemo(
        () => (allTasks || []).find((t) => t.focused && !isTodoDone(t) && !t.archived && !t.isSample),
        [allTasks]
    );
    const calendarEvents = useMemo(() => (allTasks || []).map(toCalendarEvent).filter(Boolean), [allTasks]);

    // ── 레이아웃(위치·크기) 상태 — DB + localStorage 하이브리드 ──
    // localStorage로 즉시 그리고, 서버(UserSettings.dashboardLayout)를 source of truth로 보정.
    const [layout, setLayout] = useState(loadLayout);
    const [addAnchor, setAddAnchor] = useState(null);
    const [projectDialogOpen, setProjectDialogOpen] = useState(false);
    /* 서버에 마지막으로 반영된 레이아웃(문자열).
       예전엔 "한 번만 건너뛰기" 플래그를 썼는데, react-grid-layout 이 **마운트 때
       onLayoutChange 를 한 번 쏘면서** 그 플래그가 먼저 소비됐다. 그래서 화면을 열기만 해도
       내용이 같은 레이아웃이 서버로 PUT 됐다.
       횟수를 세는 대신 **내용이 달라졌을 때만** 저장한다 — 어디서 바뀌든 한 번만 나간다. */
    const savedLayoutRef = useRef(JSON.stringify(loadLayout()));
    const saveTimer = useRef(null);

    // 서버에서 한 번 하이드레이션 (캐시와 다르면 서버값 적용)
    useEffect(() => {
        let alive = true;
        getMySettings()
            .then((res) => {
                if (!alive) return;
                const raw = res.data?.dashboardLayout;
                if (!raw) return;
                const filtered = sanitizeLayout(JSON.parse(raw));
                if (filtered && JSON.stringify(filtered) !== JSON.stringify(loadLayout())) {
                    // 서버에서 받은 값이므로 이미 서버에 있는 것 — 되돌려 보내지 않는다
                    savedLayoutRef.current = JSON.stringify(filtered);
                    setLayout(filtered);
                    saveLayout(filtered);
                }
            })
            .catch(() => { /* 서버 실패 시 localStorage 값 유지 */ });
        return () => { alive = false; };
    }, []);

    // 변경 시: localStorage 즉시 + 서버 디바운스 저장
    useEffect(() => {
        saveLayout(layout);
        const next = JSON.stringify(layout);
        if (next === savedLayoutRef.current) return; // 내용이 그대로면 보내지 않는다
        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
            savedLayoutRef.current = next;
            updateMySettings({ dashboardLayout: next }).catch(() => {});
        }, 600);
    }, [layout]);

    const removeCard = (key) => setLayout((l) => l.filter((x) => x.i !== key));
    const addCard = (key) => {
        setLayout((l) => {
            const maxY = l.reduce((m, x) => Math.max(m, x.y + x.h), 0);
            return [...l, { i: key, x: 0, y: maxY, w: 2, h: 3, minW: 1, minH: 2 }];
        });
        setAddAnchor(null);
    };
    const resetLayout = () => setLayout(cloneDefaultLayout());

    const visibleKeys = layout.map((l) => l.i);
    const hidden = ALL_KEYS.filter((k) => !visibleKeys.includes(k));

    // ── 카드 정의 ──
    const META = {
        list:        { title: "할 일 목록", icon: <ListAltRoundedIcon sx={{ fontSize: 18, color: "text.secondary" }} />, span: 1 },
        recent:      { title: "최근 본 항목", icon: <HistoryRoundedIcon sx={{ fontSize: 18, color: "text.secondary" }} />, span: 1 },
        today:       { title: "오늘 · 마감 임박", icon: <TodayRoundedIcon sx={{ fontSize: 18, color: "text.secondary" }} />, span: 1 },
        quicklinks:  { title: "빠른 이동", icon: <BoltRoundedIcon sx={{ fontSize: 18, color: "text.secondary" }} />, span: 1 },
        minical:     { title: "미니 캘린더", icon: <CalendarMonthRoundedIcon sx={{ fontSize: 18, color: "text.secondary" }} />, span: 1 },
        projects:    { title: "프로젝트", icon: <FolderRoundedIcon sx={{ fontSize: 18, color: "text.secondary" }} />, span: 2 },
        activity:    { title: "최근 활동", icon: <TimelineRoundedIcon sx={{ fontSize: 18, color: "text.secondary" }} />, span: 2 },
        focus:       { title: "오늘의 포커스", icon: <CenterFocusStrongRoundedIcon sx={{ fontSize: 18, color: "text.secondary" }} />, span: 2 },
        completion:  { title: "주간 완료율", icon: <DonutLargeRoundedIcon sx={{ fontSize: 18, color: "text.secondary" }} />, span: 1 },
        team:        { title: "팀 현황", icon: <GroupsRoundedIcon sx={{ fontSize: 18, color: "text.secondary" }} />, span: 1 },
        memo:        { title: "메모", icon: <StickyNote2RoundedIcon sx={{ fontSize: 18, color: "text.secondary" }} />, span: 1 },
        bookmarks:   { title: "북마크", icon: <BookmarkRoundedIcon sx={{ fontSize: 18, color: "text.secondary" }} />, span: 1 },
        favorites:   { title: "즐겨찾기", icon: <StarRoundedIcon sx={{ fontSize: 18, color: "text.secondary" }} />, span: 1 },
    };

    const renderBody = (key) => {
        switch (key) {
            case "list": {
                // 샘플 제외는 `isSample` (서버 필드명) — `t.sample`은 항상 undefined였다.
                /* 서브태스크는 뺀다.
                   [고치는 결함] parentId 를 안 걸러서 하위 항목이 최상위 할 일처럼 섞여 올라왔다.
                   할 일 페이지 카운트에는 안 잡히니 "목록에 없는 게 위젯엔 있는" 상태가 된다. */
                const items = (allTasks || [])
                    .filter((t) => !isTodoDone(t) && !t.archived && !t.isSample && t.parentId == null)
                    .slice(0, 14);
                return items.length === 0 ? <EmptyHint onAdd={onAddTask} addLabel="할 일 추가">아직 할 일이 없어요</EmptyHint> : (
                    <Stack spacing={0.25}>
                        {items.map((t) => (
                            <Stack key={t.id} direction="row" alignItems="center" spacing={1} onClick={() => openTaskDetail(t.id)}
                                sx={{ px: 1, py: 0.85, borderRadius: "8px", cursor: "pointer", "&:hover": { bgcolor: "action.hover" } }}>
                                <StatusDot status={t.status} />
                                <Typography sx={{ flex: 1, fontSize: 13, fontWeight: 600 }} noWrap>{t.title}</Typography>
                            </Stack>
                        ))}
                    </Stack>
                );
            }
            case "recent":
                return recent.length === 0 ? <EmptyHint>최근 연 할 일이 없어요</EmptyHint> : (
                    <Stack spacing={0.25}>
                        {recent.map((t) => (
                            <Stack key={t.id} direction="row" alignItems="center" spacing={1} onClick={() => openTaskDetail(t.id)}
                                sx={{ px: 1, py: 0.85, borderRadius: "8px", cursor: "pointer", "&:hover": { bgcolor: "action.hover" } }}>
                                <StatusDot status={t.status} />
                                <Typography sx={{ flex: 1, fontSize: 13, fontWeight: 600 }} noWrap>{t.title}</Typography>
                            </Stack>
                        ))}
                    </Stack>
                );
            case "today": {
                const items = [
                    ...(overdueTasks || []).map((t) => ({ ...t, _over: true })),
                    ...(todayTodos || []),
                ].slice(0, 7);
                return items.length === 0 ? <EmptyHint onAdd={onAddTask} addLabel="할 일 추가">오늘 마감이거나 지연된 일이 없어요</EmptyHint> : (
                    <Stack spacing={0.25}>
                        {items.map((t) => (
                            <Stack key={t.id} direction="row" alignItems="center" spacing={1} onClick={() => openTaskDetail(t.id)}
                                sx={{ px: 1, py: 0.85, borderRadius: "8px", cursor: "pointer", "&:hover": { bgcolor: "action.hover" } }}>
                                <StatusDot status={t.status} />
                                <Typography sx={{ flex: 1, fontSize: 13, fontWeight: 600 }} noWrap>{t.title}</Typography>
                                {t._over && <Typography sx={{ fontSize: 11, fontWeight: 800, color: "var(--plando-red)", flexShrink: 0 }}>지연</Typography>}
                            </Stack>
                        ))}
                    </Stack>
                );
            }
            case "quicklinks": {
                const links = [
                    // getTaskPath() 는 마지막으로 본 뷰(목록/보드)로 간다 — "보드"라고 적으면 목록으로 갈 때 거짓말이 된다
                    { label: "할 일", icon: <ListAltRoundedIcon sx={{ fontSize: 18 }} />, to: getTaskPath() },
                    { label: "캘린더", icon: <CalendarMonthRoundedIcon sx={{ fontSize: 18 }} />, to: "/calendar" },
                    { label: "지도", icon: <RoomRoundedIcon sx={{ fontSize: 18 }} />, to: "/map" },
                    { label: "메시지", icon: <GroupsRoundedIcon sx={{ fontSize: 18 }} />, to: "/dm" },
                ];
                return (
                    <Stack spacing={0.25}>
                        {links.map((l) => (
                            <Stack key={l.label} direction="row" alignItems="center" spacing={1.25} onClick={() => navigate(l.to)}
                                sx={{ px: 1, py: 0.9, borderRadius: "8px", cursor: "pointer", color: "text.secondary", "&:hover": { bgcolor: "action.hover", color: "text.primary" } }}>
                                {l.icon}
                                <Typography sx={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{l.label}</Typography>
                                <ChevronRightRoundedIcon sx={{ fontSize: 16, color: "text.disabled" }} />
                            </Stack>
                        ))}
                    </Stack>
                );
            }
            case "projects":
                return projects.length === 0 ? <EmptyHint onAdd={() => setProjectDialogOpen(true)} addLabel="프로젝트 만들기">프로젝트가 없어요</EmptyHint> : (
                    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 1 }}>
                        {projects.map((p) => {
                            const Icon = getProjectIcon(p.icon);
                            const pending = Math.max(0, (p.todoCount ?? 0) - (p.doneCount ?? 0));
                            return (
                                <Stack key={p.id} direction="row" alignItems="center" spacing={1.25} onClick={() => navigate(`/projects/${p.id}`)}
                                    sx={{ px: 1.5, py: 1.25, borderRadius: "12px", border: "1px solid", borderColor: "divider", cursor: "pointer", minWidth: 0, "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" } }}>
                                    <Box sx={{ width: 30, height: 30, borderRadius: "8px", flexShrink: 0, display: "grid", placeItems: "center", bgcolor: (p.color || "var(--plando-gray)") + "22", color: p.color || "var(--plando-gray)" }}>
                                        <Icon sx={{ fontSize: 17 }} />
                                    </Box>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography sx={{ fontSize: 13, fontWeight: 700 }} noWrap>{p.name}</Typography>
                                        <Typography sx={{ fontSize: 11, color: "text.disabled" }}>남은 {pending}</Typography>
                                    </Box>
                                </Stack>
                            );
                        })}
                    </Box>
                );
            case "activity": {
                const items = filterActivities(recentActivity || [], 6);
                return items.length === 0 ? <EmptyHint>최근 활동이 없어요</EmptyHint> : (
                    <Stack spacing={0.25}>
                        {items.map((a, i) => {
                            const info = userImageMap?.[a.modifier];
                            const name = info?.name || a.modifierName || formatModifierName(a.modifier);
                            const src = info?.profileImageUrl ? resolveImageUrl(info.profileImageUrl) : undefined;
                            const target = a.todoTitle || (a.todoId != null ? `#${a.todoId}` : "");
                            return (
                                <Stack key={i} direction="row" alignItems="center" spacing={1.25}
                                    onClick={() => a.todoId != null && openTaskDetail(a.todoId)}
                                    sx={{ px: 0.5, py: 0.6, borderRadius: "8px", cursor: a.todoId != null ? "pointer" : "default", "&:hover": a.todoId != null ? { bgcolor: "action.hover" } : undefined }}>
                                    <UserAvatar name={name} src={src} size={26} sx={{ flexShrink: 0 }} />
                                    <Typography sx={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "text.primary" }} noWrap>
                                        <b>{name}</b>{target ? ` · ${target}` : ""}
                                    </Typography>
                                    <Typography sx={{ fontSize: 11, color: "text.disabled", flexShrink: 0 }}>{formatTimeAgo(a.modifiedAt)}</Typography>
                                </Stack>
                            );
                        })}
                    </Stack>
                );
            }
            case "minical":
                return <MiniCalendarCard events={calendarEvents} onOpenEvent={(id) => openTaskDetail(id)} />;
            case "focus":
                return <TodayFocusHero task={focusedTask} onOpenDetail={openTaskDetail} onAddTask={() => navigate(getTaskPath())} />;
            case "completion":
                return <CompletionRing rate={weeklyCompletionRate} delta={weeklyDelta} weeklyBarData={weeklyBarData} />;
            case "team":
                return <TeamStatusList memberStats={memberStats} userImageMap={userImageMap} presenceMap={presenceMap} onViewAll={() => navigate("/settings", { state: { section: "workspace" } })} />;
            case "memo":
                return <MemoCard />;
            case "bookmarks":
                return <BookmarksCard />;
            case "favorites":
                return <FavoritesCard />;
            default:
                return null;
        }
    };

    // 카드 헤더 + 버튼이 트리거하는 "추가" 동작 (통일성: 리스트·메모·북마크·즐겨찾기·프로젝트)
    const ADD_ITEM_DISPATCH = {
        list: onAddTask,
        memo: () => window.dispatchEvent(new Event(ADD_STICKY_EVENT)),
        bookmarks: () => window.dispatchEvent(new Event(ADD_BOOKMARK_EVENT)),
        favorites: () => window.dispatchEvent(new Event(ADD_FAVORITE_EVENT)),
        projects: () => setProjectDialogOpen(true),
    };
    // + 버튼 툴팁 (카드별 — 기본 "할 일 추가"가 모든 카드에 뜨던 문제 해소)
    const ADD_ITEM_TOOLTIP = {
        list: "할 일 추가",
        memo: "메모 추가",
        bookmarks: "북마크 추가",
        favorites: "즐겨찾기 추가",
        projects: "프로젝트 만들기",
    };

    return (
        <Box>
            {/* 툴바 — 기본 레이아웃 / 카드 추가 (본문과 경쟁하지 않게 우측 상단에 조용히) */}
            <Stack direction="row" alignItems="center" justifyContent="flex-end" spacing={0.75} sx={{ mb: 1 }}>
                <Tooltip title="카드 위치·크기를 처음 상태로 되돌려요" placement="top">
                    <Box component="button" onClick={resetLayout}
                        sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, px: 1, py: 0.6, borderRadius: "10px",
                            border: "1px solid transparent", bgcolor: "transparent", cursor: "pointer",
                            color: "text.disabled", fontSize: 12.5, fontWeight: 700, fontFamily: "inherit",
                            transition: "color 0.15s, background 0.15s",
                            "&:hover": { bgcolor: "action.hover", color: "text.secondary" } }}>
                        <RestartAltRoundedIcon sx={{ fontSize: 16 }} /> 기본 레이아웃
                    </Box>
                </Tooltip>
                <Box component="button" onClick={(e) => setAddAnchor(e.currentTarget)} disabled={hidden.length === 0}
                    sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, px: 1.25, py: 0.6, borderRadius: "10px",
                        border: "1px solid", borderColor: "divider", bgcolor: "background.paper", cursor: hidden.length ? "pointer" : "not-allowed",
                        color: hidden.length ? "text.primary" : "text.disabled", fontSize: 12.5, fontWeight: 700, fontFamily: "inherit",
                        "&:hover": { bgcolor: hidden.length ? "action.hover" : undefined } }}>
                    <AddRoundedIcon sx={{ fontSize: 16 }} /> 카드 추가
                </Box>
                <Menu anchorEl={addAnchor} open={Boolean(addAnchor)} onClose={() => setAddAnchor(null)}>
                    {hidden.map((k) => (
                        <MenuItem key={k} onClick={() => addCard(k)} sx={{ fontSize: 13, fontWeight: 600 }}>
                            <ListItemIcon sx={{ minWidth: 30 }}>{META[k].icon}</ListItemIcon>
                            {META[k].title}
                        </MenuItem>
                    ))}
                </Menu>
            </Stack>

            {/* 카드 그리드 (react-grid-layout — 핸들 드래그 이동 + 핸들 리사이즈) */}
            <Box sx={{
                "& .react-grid-item.react-grid-placeholder": {
                    bgcolor: "primary.main", opacity: 0.16, borderRadius: "var(--plando-radius-card)",
                },
                // 리사이즈 핸들: 화살표/마커는 숨기고 기능만 유지
                "& .react-grid-item > .react-resizable-handle": { backgroundImage: "none" },
                "& .react-grid-item > .react-resizable-handle::after": { display: "none" },
            }}>
                <GridLayout
                    className="layout"
                    layout={layout}
                    cols={COLS}
                    rowHeight={ROW_H}
                    margin={[MARGIN, MARGIN]}
                    containerPadding={[0, 0]}
                    draggableHandle=".card-drag-handle"
                    resizeHandles={["s", "w", "e", "n", "sw", "nw", "se", "ne"]}
                    compactType="vertical"
                    onLayoutChange={(next) => setLayout(next)}
                >
                    {layout.map((item) => (
                        <div key={item.i}>
                            <CardShell
                                title={META[item.i].title}
                                icon={META[item.i].icon}
                                onRemove={() => removeCard(item.i)}
                                onAddItem={ADD_ITEM_DISPATCH[item.i]}
                                addTooltip={ADD_ITEM_TOOLTIP[item.i]}
                                handleProps={{ className: "card-drag-handle" }}
                            >
                                {renderBody(item.i)}
                            </CardShell>
                        </div>
                    ))}
                </GridLayout>
            </Box>

            <ProjectCreateDialog
                open={projectDialogOpen}
                onClose={() => setProjectDialogOpen(false)}
                onCreated={(p) => { setProjectDialogOpen(false); if (p?.id) navigate(`/projects/${p.id}`); }}
            />
        </Box>
    );
}
