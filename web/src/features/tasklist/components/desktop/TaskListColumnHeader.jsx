import React, { useRef, useState } from "react";
import { Box, IconButton, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import { buildGridCols, colMin, TITLE_MIN } from "./taskListColumns.js";

/**
 * Sticky 컬럼 헤더 (ClickUp식).
 * - 경계 드래그 = 인접 쌍 리사이즈: 왼쪽 늘면 오른쪽 줆(딱 두 컬럼만, 다른 컬럼/표 폭 그대로).
 *   제목은 유연(채움) — 제목|첫컬럼 경계는 제목이 흡수. 마지막 컬럼은 핸들 없음(앞 경계로 조절).
 *   드래그 중 CSS 변수만 갱신(라이브, 리렌더 X) + ↔ 커서.
 * - 컬럼 셀 드래그 → 순서 변경. 제목은 순서 고정.
 * - 맨 끝 "+" → 컬럼 표시 메뉴.
 */
export default function TaskListColumnHeader({ columns = [], onReorder, onResize, onOpenColumns }) {
    const theme = useTheme();
    const gridRef = useRef(null);
    const [dragKey, setDragKey] = useState(null);
    const [overKey, setOverKey] = useState(null);
    const [resizingKey, setResizingKey] = useState(null);

    // leftKey 우측 경계 드래그: leftKey↑ rightKey↓ (딱 두 컬럼만). leftKey="title"이면 제목(유연)이 흡수.
    const startResize = (e, leftKey, rightKey) => {
        e.preventDefault();
        e.stopPropagation();
        setResizingKey(leftKey);
        const startX = e.clientX;
        const leftFlexible = leftKey === "title";
        const leftCell = e.currentTarget.parentElement;
        const rightCell = leftCell?.nextElementSibling;
        const Lstart = leftCell?.getBoundingClientRect().width ?? 220;
        const Rstart = rightCell?.getBoundingClientRect().width ?? 120;
        const Lmin = leftFlexible ? TITLE_MIN : colMin(leftKey);
        const Rmin = colMin(rightKey);
        const table = gridRef.current?.closest(".tlc-table");
        const prevCursor = document.body.style.cursor;
        document.body.style.cursor = "col-resize";

        const compute = (clientX) => {
            let d = clientX - startX;
            d = Math.max(-(Lstart - Lmin), Math.min(Rstart - Rmin, d));
            return { left: Math.round(Lstart + d), right: Math.round(Rstart - d) };
        };
        const apply = (clientX) => {
            if (!table) return;
            const r = compute(clientX);
            if (!leftFlexible) table.style.setProperty(`--tlc-${leftKey}`, `${r.left}px`);
            table.style.setProperty(`--tlc-${rightKey}`, `${r.right}px`);
        };
        const onMove = (ev) => apply(ev.clientX);
        const onUp = (ev) => {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
            document.body.style.cursor = prevCursor;
            const r = compute(ev.clientX);
            if (!leftFlexible) onResize?.(leftKey, r.left);
            onResize?.(rightKey, r.right);
            setResizingKey(null);
        };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
    };

    const ResizeHandle = ({ leftKey, rightKey }) => (
        <Box
            draggable={false}
            onMouseDown={(e) => startResize(e, leftKey, rightKey)}
            sx={{ position: "absolute", right: -8, top: 0, bottom: 0, width: 16, display: "flex", justifyContent: "center", cursor: "col-resize", zIndex: 1, "&:hover .rz": { opacity: 1, bgcolor: "primary.main" } }}
        >
            <Box
                className="rz"
                sx={{
                    width: 2, height: 16, my: "auto", borderRadius: 1,
                    bgcolor: resizingKey === leftKey ? "primary.main" : "divider",
                    opacity: resizingKey === leftKey ? 1 : 0.6,
                    transition: "opacity 0.12s, background 0.12s",
                }}
            />
        </Box>
    );

    return (
        <Box
            ref={gridRef}
            sx={{
                position: "sticky",
                top: 0,
                zIndex: 3,
                display: "grid",
                gridTemplateColumns: buildGridCols(columns),
                alignItems: "center",
                gap: 1.75,
                px: 2.25,
                py: 1,
                bgcolor: "var(--plando-surface-alt)",
                borderBottom: "1px solid",
                borderColor: "divider",
            }}
        >
            <Box />

            {/* 제목 (유연, 순서 고정) */}
            <Box sx={{ position: "relative", display: "flex", alignItems: "center", height: "100%" }}>
                <ColLabel label="제목 · 메타" />
                {columns[0] && <ResizeHandle leftKey="title" rightKey={columns[0].key} />}
            </Box>

            {columns.map((col, i) => (
                <Box
                    key={col.key}
                    draggable={resizingKey === null}
                    onDragStart={(e) => { setDragKey(col.key); try { e.dataTransfer.effectAllowed = "move"; } catch { /* ignore */ } }}
                    onDragEnd={() => { setDragKey(null); setOverKey(null); }}
                    onDragOver={(e) => { if (dragKey && dragKey !== col.key) { e.preventDefault(); setOverKey(col.key); } }}
                    onDrop={(e) => { e.preventDefault(); if (dragKey && dragKey !== col.key) onReorder?.(dragKey, col.key); setDragKey(null); setOverKey(null); }}
                    sx={{
                        position: "relative",
                        display: "flex", alignItems: "center", height: "100%",
                        cursor: resizingKey ? "default" : "grab",
                        opacity: dragKey === col.key ? 0.4 : 1,
                        boxShadow: (overKey === col.key && dragKey) ? `inset 2px 0 0 ${theme.palette.primary.main}` : "none",
                        userSelect: "none",
                    }}
                >
                    <ColLabel label={col.label} />
                    {/* 마지막 컬럼은 핸들 없음(앞 경계로 조절) */}
                    {columns[i + 1] && <ResizeHandle leftKey={col.key} rightKey={columns[i + 1].key} />}
                </Box>
            ))}

            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <IconButton size="small" onClick={onOpenColumns} aria-label="열 설정" sx={{ p: 0.25, color: "text.disabled", "&:hover": { color: "primary.main", bgcolor: "var(--plando-primary-soft)" } }}>
                    <AddRoundedIcon sx={{ fontSize: 16 }} />
                </IconButton>
            </Box>
        </Box>
    );
}

function ColLabel({ label }) {
    return (
        <Typography
            sx={{
                fontSize: 10.5,
                fontWeight: 800,
                color: "text.disabled",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
            }}
        >
            {label}
        </Typography>
    );
}
