import React, { useMemo, useState, useEffect, useRef } from "react";
import { Box, Stack, Typography, useMediaQuery, useTheme, Drawer, Dialog, IconButton, SvgIcon } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";

/* SF Symbol `leaf.fill` 과 동형의 잎 아이콘 (네이티브 위젯 빈 상태와 매칭).
 * Material classic `eco` leaf path — 단일 잎. */
function LeafIcon(props) {
    return (
        <SvgIcon viewBox="0 0 24 24" {...props}>
            <path d="M6.05 8.05c-2.73 2.73-2.73 7.15-.02 9.88 1.47-3.4 4.09-6.24 7.36-7.93-2.77 2.34-4.71 5.61-5.39 9.32 2.6 1.23 5.8.78 7.95-1.37C19.43 14.47 20 4 20 4S9.53 4.57 6.05 8.05z" />
        </SvgIcon>
    );
}
import { buildWidgetData } from "../../../shared/native/widgetSync.js";
import { fetchTodos } from "../../todo/api/todoApi.js";
import { Z } from "../../../shared/ui/zIndex.js";

/* WidgetTokens.swift 와 동기 + 월간 위젯 목업 팔레트 */
function tokens(dark) {
    return {
        brand: "#1B6FF5",
        brandSoft: "rgba(27,111,245,0.10)",
        // 캘린더 today/plus 강조 — 라이트(Apple) 그린 / 다크(Plando) 블루
        accent: dark ? "#2F7BFF" : "#34C759",
        bg: dark ? "#131B2C" : "#ffffff",
        track: dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.07)",
        divider: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
        textPri: dark ? "#F8FAFC" : "#0F172A",
        textSec: dark ? "#94A3B8" : "#64748B",
        textTer: dark ? "rgba(255,255,255,0.22)" : "rgba(28,28,30,0.28)",
        sun: dark ? "#FF7A7A" : "#FF453A",
        sat: dark ? "#7FB0FF" : "#2F6BFF",
        overflow: dark ? "#7A7A84" : "#8A8A90",
        high: "#E11D48", medium: "#F59E0B", low: "#CBD5E1", done: "#10B981",
        // 일정 카테고리 칩 색 (목업과 동일)
        cats: dark ? {
            work: ["rgba(47,123,255,.28)", "#9cc0ff"], meet: ["rgba(124,58,237,.30)", "#c4a8ff"],
            meal: ["rgba(234,115,23,.30)", "#ffc48f"], fit: ["rgba(22,163,74,.30)", "#84e8aa"],
            hobby: ["rgba(219,39,119,.30)", "#ff9fcb"], etc: ["rgba(13,148,136,.30)", "#74ded4"],
        } : {
            work: ["rgba(37,99,235,.16)", "#1d4ed8"], meet: ["rgba(124,58,237,.16)", "#6d28d9"],
            meal: ["rgba(234,115,23,.18)", "#c2570a"], fit: ["rgba(22,163,74,.16)", "#15803d"],
            hobby: ["rgba(219,39,119,.16)", "#be185d"], etc: ["rgba(13,148,136,.16)", "#0f766e"],
        },
    };
}
const prioColor = (t, p) => (p === "HIGH" ? t.high : p === "MEDIUM" ? t.medium : t.low);
const CAT_KEYS = ["work", "meet", "meal", "fit", "hobby", "etc"];
const catOf = (todo) => CAT_KEYS[(todo.projectId != null ? Number(todo.projectId) : (Number(todo.id) || 0)) % CAT_KEYS.length];

/* 위젯 외형 — glass=true면 프로스트 글라스(목업: blur34 + 상단 글로우 + inset 하이라이트) */
function WidgetShell({ w, h, dark, glass = false, children }) {
    const cardTop = dark ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.45)";
    return (
        <Box sx={{
            width: w, height: h, borderRadius: glass ? "28px" : "22px", flexShrink: 0,
            overflow: "hidden", position: "relative",
            ...(glass ? {
                bgcolor: dark ? "rgba(22,22,30,0.45)" : "rgba(255,255,255,0.62)",
                backdropFilter: "blur(34px) saturate(150%)", WebkitBackdropFilter: "blur(34px) saturate(150%)",
                border: `1px solid ${dark ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.7)"}`,
                boxShadow: `0 24px 60px rgba(0,0,0,0.35), inset 0 1px 0 ${cardTop}`,
            } : {
                bgcolor: dark ? "#131B2C" : "#ffffff",
                boxShadow: dark ? "0 8px 28px rgba(0,0,0,0.45)" : "0 8px 28px rgba(15,23,42,0.10)",
            }),
        }}>
            {glass && (
                <Box sx={{ position: "absolute", top: 0, left: 0, right: 0, height: "40%", background: `linear-gradient(180deg, ${cardTop}, transparent)`, opacity: 0.6, pointerEvents: "none" }} />
            )}
            <Box sx={{ position: "relative", height: "100%" }}>{children}</Box>
        </Box>
    );
}

/* 슬림 progress 바 (점 5개 대신 — 토스식) */
function ProgressBar({ total, done, t, w = 40 }) {
    const ratio = total > 0 ? Math.min(1, done / total) : 0;
    return (
        <Box sx={{ width: w, height: 5, borderRadius: 5, bgcolor: t.track, overflow: "hidden" }}>
            <Box sx={{ width: `${ratio * 100}%`, height: "100%", bgcolor: t.brand, borderRadius: 5 }} />
        </Box>
    );
}

/* ＋ 추가 버튼 (네이티브 addButton 과 동일 — brandSoft 원형) */
function AddBtn({ t, big = false }) {
    const sz = big ? 24 : 22;
    return (
        <Box sx={{
            width: sz, height: sz, borderRadius: "50%", flexShrink: 0, ml: 0.75,
            bgcolor: t.brandSoft, display: "flex", alignItems: "center", justifyContent: "center",
        }}>
            <Box component="span" sx={{ fontSize: big ? 14 : 12, fontWeight: 900, color: t.brand, lineHeight: 1 }}>+</Box>
        </Box>
    );
}

/* 헤더 — "오늘" 작은 라벨 + 큰 볼드 숫자 + 슬림 progress (+ medium/large 만 ＋) */
function Header({ total, done, t, big = false, showAdd = false }) {
    return (
        <Stack direction="row" alignItems="center" spacing={0.75}>
            <Typography sx={{ fontSize: big ? 14 : 12.5, fontWeight: 700, color: t.textSec }}>오늘</Typography>
            <Typography sx={{ fontSize: big ? 22 : 18, fontWeight: 800, color: t.textPri, lineHeight: 1, letterSpacing: "-0.02em" }}>{total}</Typography>
            <Box sx={{ flex: 1 }} />
            {total > 0 && <ProgressBar total={total} done={done} t={t} w={big ? 52 : 40} />}
            {showAdd && <AddBtn t={t} big={big} />}
        </Stack>
    );
}

function Checkbox({ task, t }) {
    if (task.status === "DONE") {
        return <Box sx={{ width: 18, height: 18, borderRadius: "50%", bgcolor: t.done, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 900 }}>✓</Box>;
    }
    return <Box sx={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${prioColor(t, task.priority)}`, flexShrink: 0 }} />;
}

function MetaChips({ task, t }) {
    return (
        <Stack direction="row" alignItems="center" spacing={0.5}>
            {task.starred && <Box sx={{ fontSize: 11, color: t.brand }}>⚡</Box>}
            {task.dDay && (
                <Box sx={{ fontSize: 9.5, fontWeight: 800, color: t.brand, bgcolor: t.brandSoft, borderRadius: "6px", px: "6px", py: "2px" }}>
                    {task.dDay}
                </Box>
            )}
        </Stack>
    );
}

function EmptyToss({ t, big }) {
    return (
        <Stack alignItems="flex-start" spacing={0.75} sx={{ flex: 1, justifyContent: "center" }}>
            <LeafIcon sx={{ fontSize: big ? 30 : 26, color: t.done, transform: "scaleX(-1)" }} />
            <Box>
                <Typography sx={{ fontSize: big ? 16 : 13.5, fontWeight: 800, color: t.textPri, lineHeight: 1.35, letterSpacing: "-0.01em", whiteSpace: "pre-line" }}>
                    오늘은 여유로운{big ? " " : "\n"}하루예요
                </Typography>
                {big && (
                    <Typography sx={{ fontSize: 12.5, fontWeight: 500, color: t.textSec, mt: 0.25 }}>새 할 일을 추가해보세요</Typography>
                )}
            </Box>
        </Stack>
    );
}

/* Medium 전용 빈 상태 — 가로 배치(잎 + 문구). 네이티브 MediumWidgetView.emptyView 와 매칭. */
function MediumEmpty({ t }) {
    return (
        <Stack direction="row" alignItems="center" spacing={1.25} sx={{ flex: 1 }}>
            <LeafIcon sx={{ fontSize: 30, color: t.done, transform: "scaleX(-1)", flexShrink: 0 }} />
            <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 800, color: t.textPri, letterSpacing: "-0.01em" }}>오늘은 여유로운 하루예요</Typography>
                <Typography sx={{ fontSize: 12, fontWeight: 500, color: t.textSec, mt: 0.25 }}>새 할 일을 추가해보세요</Typography>
            </Box>
        </Stack>
    );
}

/* ── Small ── */
function SmallWidget({ data, t, dark }) {
    const featured = data.todos.find((x) => x.starred) ?? data.todos[0];
    const remaining = Math.max(0, data.total - 1);
    return (
        <WidgetShell w={158} h={158} dark={dark}>
            <Box sx={{ p: "16px", height: "100%", display: "flex", flexDirection: "column" }}>
                <Header total={data.total} done={data.done} t={t} />
                {data.total === 0 ? (
                    <EmptyToss t={t} />
                ) : (
                    <>
                        <Box sx={{ flex: 1 }} />
                        {featured && (
                            <Stack direction="row" spacing={1.25} alignItems="flex-start">
                                <Checkbox task={featured} t={t} />
                                <Box sx={{ minWidth: 0 }}>
                                    <MetaChips task={featured} t={t} />
                                    <Typography sx={{
                                        fontSize: 14, fontWeight: 700, mt: 0.5, lineHeight: 1.3, letterSpacing: "-0.01em",
                                        color: featured.status === "DONE" ? t.textTer : t.textPri,
                                        textDecoration: featured.status === "DONE" ? "line-through" : "none",
                                        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                                    }}>
                                        {featured.title}
                                    </Typography>
                                </Box>
                            </Stack>
                        )}
                        <Box sx={{ flex: 1 }} />
                        {remaining > 0 && (
                            <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: t.textTer }}>외 {remaining}개 더 있어요</Typography>
                        )}
                    </>
                )}
            </Box>
        </WidgetShell>
    );
}

/* ── Medium ── (구분선 없이 여백으로 — 토스식) */
function MediumWidget({ data, t, dark }) {
    const rows = [...data.todos.filter((x) => x.starred), ...data.todos.filter((x) => !x.starred)].slice(0, 3);
    return (
        <WidgetShell w={338} h={158} dark={dark}>
            <Box sx={{ px: "18px", py: "16px", height: "100%", display: "flex", flexDirection: "column" }}>
                <Header total={data.total} done={data.done} t={t} showAdd />
                {data.total === 0 ? (
                    <MediumEmpty t={t} />
                ) : (
                    <Stack spacing={0} sx={{ mt: 1.25 }}>
                        {rows.map((task) => (
                            <Stack key={task.id} direction="row" spacing={1.25} alignItems="center" sx={{ py: 0.7 }}>
                                <Checkbox task={task} t={t} />
                                <Typography sx={{
                                    flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, letterSpacing: "-0.01em",
                                    color: task.status === "DONE" ? t.textTer : t.textPri,
                                    textDecoration: task.status === "DONE" ? "line-through" : "none",
                                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                }}>
                                    {task.title}
                                </Typography>
                                <MetaChips task={task} t={t} />
                            </Stack>
                        ))}
                        {data.total > rows.length && (
                            <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: t.textTer, mt: 0.5 }}>외 {data.total - rows.length}개 더 있어요</Typography>
                        )}
                    </Stack>
                )}
            </Box>
        </WidgetShell>
    );
}

/* ── Large (달력) ── 네이버 캘린더식 "주간 + 일정 라벨" (Plando 블루) */
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const mdLabel = (d) => `${d.getMonth() + 1}.${d.getDate()}`;

function LargeCalendarWidget({ todos, t, dark }) {
    const { week, rangeLabel, byDate, todayKey, weekItems } = useMemo(() => {
        const now = new Date();
        const start = new Date(now);
        start.setDate(now.getDate() - now.getDay()); // 일요일 시작 (현재 주 고정 — 위젯은 네비 없음)
        start.setHours(0, 0, 0, 0);
        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            days.push(d);
        }
        const end = new Date(days[6]); end.setHours(23, 59, 59, 999);
        const map = {};
        const inWeek = [];
        (todos || []).forEach((td) => {
            const raw = td.dueDate || td.due_date;
            if (!raw) return;
            const d = new Date(raw);
            (map[ymd(d)] ||= []).push(td);
            if (d >= start && d <= end) inWeek.push(td);
        });
        inWeek.sort((a, b) => new Date(a.dueDate || a.due_date) - new Date(b.dueDate || b.due_date));
        return {
            week: days,
            rangeLabel: `${mdLabel(days[0])} – ${mdLabel(days[6])}`,
            byDate: map,
            todayKey: ymd(now),
            weekItems: inWeek.slice(0, 2),
        };
    }, [todos]);

    const weekendColor = (i) => (i === 0 ? t.sun : i === 6 ? t.sat : t.textSec);
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const dayLabel = (raw) => {
        const d = new Date(raw); d.setHours(0, 0, 0, 0);
        const diff = Math.round((d - todayStart) / 86400000);
        if (diff === 0) return "오늘";
        if (diff === 1) return "내일";
        return `${d.getMonth() + 1}.${d.getDate()} ${WEEKDAYS[d.getDay()]}`;
    };

    return (
        <WidgetShell w={338} h={158} dark={dark} glass>
            <Box sx={{ p: "12px 14px", height: "100%", display: "flex", flexDirection: "column" }}>
                {/* 헤더: 범위 + (위젯은 현재 주 고정 — ‹› 없음) */}
                <Stack direction="row" alignItems="center" sx={{ mb: 0.5, px: "2px" }}>
                    <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: t.textPri, letterSpacing: "-0.2px" }}>{rangeLabel}</Typography>
                    <Box sx={{ flex: 1 }} />
                    <Typography sx={{ fontSize: 17, fontWeight: 400, color: t.accent, lineHeight: 1 }}>+</Typography>
                </Stack>

                {/* 상단: 주간 스트립 (요일+날짜, 오늘 강조, 일정 있는 날 점) */}
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
                    {week.map((d, i) => {
                        const key = ymd(d);
                        const isToday = key === todayKey;
                        const hasEv = (byDate[key] || []).length > 0;
                        return (
                            <Box key={key} sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                <Typography sx={{ fontSize: 8.5, fontWeight: 700, color: weekendColor(i) }}>{WEEKDAYS[i]}</Typography>
                                <Box sx={{ width: 19, height: 19, borderRadius: "50%", my: "2px", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: isToday ? t.accent : "transparent" }}>
                                    <Typography sx={{ fontSize: 11, fontWeight: isToday ? 800 : 600, color: isToday ? "#fff" : weekendColor(i) }}>{d.getDate()}</Typography>
                                </Box>
                                <Box sx={{ width: 4, height: 4, borderRadius: "50%", bgcolor: hasEv && !isToday ? t.accent : "transparent" }} />
                            </Box>
                        );
                    })}
                </Box>

                <Box sx={{ height: "1px", bgcolor: t.divider, my: "8px" }} />

                {/* 하단: 그 주 일정 리스트 (최대 2개) */}
                <Stack spacing={0.75} sx={{ flex: 1, minHeight: 0, justifyContent: "center" }}>
                    {weekItems.length ? weekItems.map((it) => {
                        const [, tx] = t.cats[catOf(it)];
                        return (
                            <Stack key={it.id} direction="row" alignItems="center" spacing={1}>
                                <Typography sx={{ fontSize: 10, fontWeight: 700, color: t.textSec, minWidth: 44, flexShrink: 0 }}>{dayLabel(it.dueDate || it.due_date)}</Typography>
                                <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: it.status === "DONE" ? t.overflow : tx, flexShrink: 0 }} />
                                <Typography sx={{
                                    flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600,
                                    color: it.status === "DONE" ? t.overflow : t.textPri,
                                    textDecoration: it.status === "DONE" ? "line-through" : "none",
                                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                }}>{it.title}</Typography>
                            </Stack>
                        );
                    }) : (
                        <Typography sx={{ fontSize: 11.5, color: t.textSec, textAlign: "center" }}>이 주에는 일정이 없어요</Typography>
                    )}
                </Stack>
            </Box>
        </WidgetShell>
    );
}

/* 월 그리드 셀 빌더 — 월간 위젯 / 잠금 큰 캘린더 공용 */
function buildMonthCells(todos, offset = 0) {
    const now = new Date();
    const base = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const y = base.getFullYear(), m = base.getMonth();
    const startWeekday = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const map = {};
    (todos || []).forEach((td) => {
        const raw = td.dueDate || td.due_date;
        if (!raw) return;
        const d = new Date(raw);
        if (d.getFullYear() === y && d.getMonth() === m) (map[d.getDate()] ||= []).push(td);
    });
    const list = [];
    for (let i = 0; i < startWeekday; i++) list.push(null);
    for (let d = 1; d <= daysInMonth; d++) list.push(d);
    while (list.length % 7) list.push(null);
    const isCurMonth = y === now.getFullYear() && m === now.getMonth();
    return { cells: list, monthLabel: `${y}.${String(m + 1).padStart(2, "0")}`, todayDay: isCurMonth ? now.getDate() : -1, byDay: map, rows: list.length / 7 };
}

/* ── Large (월간 달력) ── 네이버 캘린더식 월 그리드 + 색상 이벤트 바 */
function MonthlyCalendarWidget({ todos, t, dark }) {
    const { cells, monthLabel, todayDay, byDay, rows } = useMemo(() => buildMonthCells(todos), [todos]);

    const MAX = rows >= 6 ? 1 : 2;
    const dcolor = (idx, isOut) => (isOut ? t.textTer : (idx % 7 === 0 ? t.sun : idx % 7 === 6 ? t.sat : t.textPri));

    return (
        <WidgetShell w={338} h={354} dark={dark} glass>
            <Box sx={{ p: "16px 16px 12px", height: "100%", display: "flex", flexDirection: "column" }}>
                {/* 헤더: 월 + (위젯은 현재 달 고정 — ‹› 없음) */}
                <Stack direction="row" alignItems="center" sx={{ mb: 0.75, px: "2px" }}>
                    <Typography sx={{ fontSize: 19, fontWeight: 800, color: t.textPri, letterSpacing: "-0.3px" }}>{monthLabel}</Typography>
                    <Box sx={{ flex: 1 }} />
                    <Typography sx={{ fontSize: 22, fontWeight: 400, color: t.accent, lineHeight: 1 }}>+</Typography>
                </Stack>
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", mb: "2px" }}>
                    {WEEKDAYS.map((w, i) => (
                        <Typography key={w} sx={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: i === 0 ? t.sun : i === 6 ? t.sat : t.textSec }}>{w}</Typography>
                    ))}
                </Box>
                <Box sx={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}>
                    {cells.map((day, idx) => {
                        const isOut = day == null;
                        const isToday = !isOut && day === todayDay;
                        const items = isOut ? [] : (byDay[day] || []);
                        return (
                            <Box key={idx} sx={{ minWidth: 0, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", gap: "1px", px: "1px", pt: "2px" }}>
                                {isToday ? (
                                    <Box sx={{ width: 14, height: 14, borderRadius: "999px", bgcolor: t.accent, mx: "auto", mb: "1px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
                                        <Typography sx={{ fontSize: 10, fontWeight: 700, color: "#fff", lineHeight: 1 }}>{day}</Typography>
                                    </Box>
                                ) : (
                                    <Typography sx={{ textAlign: "center", fontSize: 11, fontWeight: 600, height: 14, lineHeight: "14px", mb: "1px", color: dcolor(idx, isOut) }}>{isOut ? "" : day}</Typography>
                                )}
                                {items.slice(0, MAX).map((it, k) => {
                                    const [bg, tx] = t.cats[catOf(it)];
                                    return (
                                        <Box key={k} component="div" sx={{
                                            bgcolor: it.status === "DONE" ? t.track : bg,
                                            color: it.status === "DONE" ? t.overflow : tx,
                                            fontSize: 8.5, fontWeight: 600, lineHeight: 1.25, letterSpacing: "-0.2px",
                                            px: "4px", py: "1px", borderRadius: "4px",
                                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                            textDecoration: it.status === "DONE" ? "line-through" : "none",
                                        }}>
                                            {it.title}
                                        </Box>
                                    );
                                })}
                                {items.length > MAX && (
                                    <Typography sx={{ fontSize: 8, fontWeight: 700, color: t.overflow, px: "4px", lineHeight: 1.1 }}>+{items.length - MAX}</Typography>
                                )}
                            </Box>
                        );
                    })}
                </Box>
            </Box>
        </WidgetShell>
    );
}

/* ── Large (오늘) ── 오늘 할 일 전체를 한 화면에 (체크박스 리스트) */
function TodayLargeWidget({ data, t, dark }) {
    const rows = [...data.todos.filter((x) => x.starred), ...data.todos.filter((x) => !x.starred)].slice(0, 8);
    return (
        <WidgetShell w={338} h={354} dark={dark}>
            <Box sx={{ p: "20px 20px 18px", height: "100%", display: "flex", flexDirection: "column" }}>
                <Header total={data.total} done={data.done} t={t} big showAdd />
                {data.total === 0 ? (
                    <EmptyToss t={t} big />
                ) : (
                    <Stack spacing={0} sx={{ mt: 1.25, flex: 1, minHeight: 0 }}>
                        {rows.map((task) => (
                            <Stack key={task.id} direction="row" spacing={1.25} alignItems="center"
                                sx={{ py: 0.85, borderBottom: `1px solid ${t.divider}`, "&:last-of-type": { borderBottom: "none" } }}>
                                <Checkbox task={task} t={t} />
                                <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: t.cats[catOf(task)][1], flexShrink: 0 }} />
                                <Typography sx={{
                                    flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em",
                                    color: task.status === "DONE" ? t.textTer : t.textPri,
                                    textDecoration: task.status === "DONE" ? "line-through" : "none",
                                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                }}>{task.title}</Typography>
                                <MetaChips task={task} t={t} />
                            </Stack>
                        ))}
                        {data.total > rows.length && (
                            <Typography sx={{ fontSize: 12, fontWeight: 600, color: t.textTer, mt: 1 }}>외 {data.total - rows.length}개 더 있어요</Typography>
                        )}
                    </Stack>
                )}
            </Box>
        </WidgetShell>
    );
}

/* 위젯 갤러리 — 좌우 스와이프, 가운데 온 위젯이 선택(적용).
 * 위젯은 실제 크기(px) 그대로 렌더. 모바일에선 실제 크기(최대 338px)가 카드 내부
 * 폭보다 넓어 잘리므로 full-bleed(화면 전체 폭)로 빼서 잘리지 않게 함. */
function Carousel({ items, isDark, fullBleed }) {
    const ref = useRef(null);
    const slideRefs = useRef([]);
    const [active, setActive] = useState(0);
    const [rowH, setRowH] = useState(0);

    const centerTo = (i, smooth) => {
        const c = ref.current, s = slideRefs.current[i];
        if (!c || !s) return;
        c.scrollTo({ left: s.offsetLeft + s.offsetWidth / 2 - c.clientWidth / 2, behavior: smooth ? "smooth" : "auto" });
    };
    useEffect(() => { centerTo(0, false); }, []);
    // 컨테이너 높이를 가장 큰 위젯(월간)에 맞춰 고정 — 스크롤 중 높이 변화로 인한 snap 튕김 방지
    useEffect(() => {
        const hs = slideRefs.current.filter(Boolean).map((s) => s.offsetHeight);
        if (hs.length) setRowH(Math.max(...hs));
    }, [items]);

    const onScroll = () => {
        const c = ref.current; if (!c) return;
        const center = c.scrollLeft + c.clientWidth / 2;
        let best = 0, bd = Infinity;
        slideRefs.current.forEach((s, i) => {
            if (!s) return;
            const d = Math.abs(s.offsetLeft + s.offsetWidth / 2 - center);
            if (d < bd) { bd = d; best = i; }
        });
        setActive(best);
    };

    const cur = items[active] || items[0];

    return (
        <Box sx={fullBleed ? { width: "100vw", position: "relative", left: "50%", ml: "-50vw" } : { width: "100%" }}>
            <Box ref={ref} onScroll={onScroll} sx={{
                display: "flex", alignItems: "center", gap: 2.25, overflowX: "auto", overflowY: "hidden", position: "relative",
                scrollSnapType: "x mandatory", px: "50%", py: 3,
                height: rowH ? rowH + 48 : "auto",
                "&::-webkit-scrollbar": { display: "none" }, scrollbarWidth: "none",
            }}>
                {items.map((it, i) => (
                    <Box
                        key={it.key}
                        ref={(el) => { slideRefs.current[i] = el; }}
                        onClick={() => centerTo(i, true)}
                        sx={{
                            flex: "none", scrollSnapAlign: "center",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            transform: active === i ? "scale(1)" : "scale(0.86)",
                            opacity: active === i ? 1 : 0.35,
                            filter: active === i ? "none" : "saturate(0.85)",
                            transition: "transform .35s cubic-bezier(.34,1.1,.4,1), opacity .35s, filter .35s",
                            cursor: active === i ? "default" : "pointer",
                        }}
                    >
                        {it.node}
                    </Box>
                ))}
            </Box>

            <Box sx={{ textAlign: "center", mt: 1.5 }}>
                <Typography sx={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em" }}>{cur.label}</Typography>
                <Typography sx={{ fontSize: 12.5, color: "text.secondary", mt: 0.5 }}>{cur.desc}</Typography>
                <Stack direction="row" spacing={0.75} justifyContent="center" sx={{ mt: 1.5 }}>
                    {items.map((_, i) => (
                        <Box key={i} sx={{ width: active === i ? 18 : 6, height: 6, borderRadius: 3, bgcolor: active === i ? "primary.main" : (isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.14)"), transition: "all .25s" }} />
                    ))}
                </Stack>
            </Box>
        </Box>
    );
}

/* 위젯 추가 방법 안내 — 여기서 적용되는 게 아니라 iOS에서 추가하는 것임을 명확히 */
function SetupGuide({ isDark }) {
    const steps = [
        { k: "1", v: "홈 화면 빈 곳을 길게 누르세요" },
        { k: "2", v: "좌측 상단 + 를 누르고 ‘Plando’ 검색" },
        { k: "3", v: "원하는 크기의 위젯을 선택해 추가" },
    ];
    return (
        <Box sx={{
            borderRadius: "14px", p: "14px 16px",
            bgcolor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
            border: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)"}`,
        }}>
            <Typography sx={{ fontSize: 13, fontWeight: 800, mb: 1, color: "text.primary" }}>위젯 추가 방법</Typography>
            <Stack spacing={0.85}>
                {steps.map((s) => (
                    <Box key={s.k} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Box sx={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0, bgcolor: "primary.main", color: "#fff", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{s.k}</Box>
                        <Typography sx={{ fontSize: 12.5, color: "text.secondary", lineHeight: 1.4 }}>{s.v}</Typography>
                    </Box>
                ))}
            </Stack>
            <Typography sx={{ fontSize: 11.5, color: "text.disabled", mt: 1.25, lineHeight: 1.5 }}>
                위젯 내용(오늘 할 일·일정)은 앱과 자동으로 동기화돼요. 이 화면은 미리보기예요.
            </Typography>
        </Box>
    );
}

/**
 * 위젯 미리보기 시트 — 설정의 "위젯 미리보기" 행에서 열림(controlled).
 * 여기서 적용되는 게 아니라 실제 모습 미리보기 + iOS 추가 방법 안내.
 */
export default function WidgetPreview({ isDark = false, open = false, onClose }) {
    const theme = useTheme();
    const [todos, setTodos] = useState([]);
    const [loaded, setLoaded] = useState(false);
    const t = tokens(isDark);
    // 모바일에선 실제 크기(최대 338px) 위젯이 카드 폭보다 넓어 잘리므로 full-bleed 로 표시
    const isMobile = useMediaQuery("(max-width:600px)");

    // 핸들/헤더를 아래로 끌면 닫힘 (본문은 별도 스크롤 유지)
    const [dragY, setDragY] = useState(0);
    const [dragging, setDragging] = useState(false);
    const dragStart = useRef(null);
    useEffect(() => { if (!open) { setDragY(0); setDragging(false); } }, [open]);
    const onDragStart = (e) => { dragStart.current = e.touches[0].clientY; setDragging(true); };
    const onDragMove = (e) => {
        if (dragStart.current == null) return;
        const dy = e.touches[0].clientY - dragStart.current;
        setDragY(dy > 0 ? dy : 0);
    };
    const onDragEnd = () => {
        if (dragY > 110) onClose?.();
        setDragY(0);
        setDragging(false);
        dragStart.current = null;
    };

    // 시트가 처음 열릴 때만 로드
    useEffect(() => {
        if (!open || loaded) return;
        let alive = true;
        fetchTodos()
            .then((res) => { if (alive) { setTodos(Array.isArray(res?.data) ? res.data : []); setLoaded(true); } })
            .catch(() => {});
        return () => { alive = false; };
    }, [open, loaded]);

    const data = useMemo(() => buildWidgetData(todos), [todos]);

    const homeItems = [
        { key: "small", label: "작은 위젯", desc: "오늘 할 일 개수와 D-day를 한눈에", node: <SmallWidget data={data} t={t} dark={isDark} /> },
        { key: "medium", label: "중간 위젯", desc: "오늘 할 일 목록을 카테고리별로", node: <MediumWidget data={data} t={t} dark={isDark} /> },
        { key: "today", label: "오늘 (큰 위젯)", desc: "오늘 할 일 전체를 한 화면에", node: <TodayLargeWidget data={data} t={t} dark={isDark} /> },
        { key: "week", label: "주간 달력", desc: "이번 주 일정과 진행 상태를", node: <LargeCalendarWidget todos={todos} t={t} dark={isDark} /> },
        { key: "month", label: "월간 달력", desc: "한 달 일정을 캘린더 그대로", node: <MonthlyCalendarWidget todos={todos} t={t} dark={isDark} /> },
    ];
    const head = (
        <Box sx={{ px: 2.5, pt: isMobile ? 0.5 : 0, pb: 1.5, display: "flex", alignItems: "flex-start" }}>
            <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.01em" }}>위젯 미리보기</Typography>
                <Typography sx={{ fontSize: 12.5, color: "text.secondary", mt: 0.25 }}>추가하면 이렇게 보여요 · 좌우로 넘겨보세요</Typography>
            </Box>
            {!isMobile && (
                <IconButton onClick={onClose} size="small" sx={{ mt: -0.5, mr: -1 }}><CloseRoundedIcon /></IconButton>
            )}
        </Box>
    );

    const content = (
        <Box sx={{ pb: isMobile ? "calc(20px + env(safe-area-inset-bottom))" : 1, overflowX: "hidden" }}>
            <Carousel items={homeItems} isDark={isDark} fullBleed={isMobile} />

            <Box sx={{ mx: 2.5, mt: 2.5 }}>
                <SetupGuide isDark={isDark} />
            </Box>
        </Box>
    );

    if (isMobile) {
        return (
            <Drawer
                anchor="bottom"
                open={open}
                onClose={onClose}
                sx={{ zIndex: Z.SHEET }}
                // Paper 는 Slide 컨테이너로만 두고(투명), 실제 카드/드래그 변형은 내부 Box 에서 처리
                // (MUI Slide 가 Paper transform 을 직접 제어해 sx transform 이 덮이는 문제 회피)
                PaperProps={{ sx: { bgcolor: "transparent", boxShadow: "none", overflow: "visible", maxHeight: "88vh", borderRadius: 0 } }}
            >
                <Box sx={{
                    bgcolor: theme.palette.background.paper,
                    borderTopLeftRadius: 20, borderTopRightRadius: 20,
                    maxHeight: "88vh", display: "flex", flexDirection: "column", overflow: "hidden",
                    transform: dragY ? `translateY(${dragY}px)` : "none",
                    transition: dragging ? "none" : "transform .28s cubic-bezier(.4,0,.2,1)",
                }}>
                    {/* 드래그 존(핸들+헤더) — 아래로 끌면 닫힘 */}
                    <Box
                        onTouchStart={onDragStart}
                        onTouchMove={onDragMove}
                        onTouchEnd={onDragEnd}
                        sx={{ flexShrink: 0, touchAction: "none", cursor: "grab" }}
                    >
                        <Box sx={{ display: "flex", justifyContent: "center", pt: 1.5, pb: 0.5 }}>
                            <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: "text.disabled", opacity: 0.4 }} />
                        </Box>
                        {head}
                    </Box>
                    {/* 스크롤 영역 */}
                    <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
                        {content}
                    </Box>
                </Box>
            </Drawer>
        );
    }

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth sx={{ zIndex: Z.SHEET }}
            PaperProps={{ sx: { borderRadius: "20px", bgcolor: theme.palette.background.paper } }}>
            <Box sx={{ pt: 2 }}>{head}{content}</Box>
        </Dialog>
    );
}
