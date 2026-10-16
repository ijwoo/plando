import React from "react";
import { Box, Stack } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { getStatusLabel, softOn, statusColor } from "../tone.js";

/**
 * 상태 키 → { color, soft }.
 * 워크스페이스 커스텀 상태는 colorOf(key)가 준 hex를 쓰고, 없으면 tone.js statusColor 폴백.
 */
function statusTokens(theme, statusKey, colorOf) {
    const color = (typeof colorOf === "function" ? colorOf(statusKey) : null) ?? statusColor(theme, statusKey);
    return { color, soft: softOn(theme, color, 1.1) };
}

function StatChip({ label, count, dotColor, activeBg, selected, clickable, dimmed, onClick }) {
    return (
        <Box
            onClick={onClick}
            sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                height: 30,
                px: "12px",
                borderRadius: "9999px",
                border: "1px solid",
                borderColor: selected ? "transparent" : "var(--plando-divider)",
                bgcolor: selected ? activeBg : "transparent",
                cursor: clickable ? "pointer" : "default",
                userSelect: "none",
                opacity: dimmed ? 0.4 : 1,
                flexShrink: 0,
                whiteSpace: "nowrap",
                transition: "opacity 0.15s, background 0.15s",
                "&:hover": clickable ? { opacity: 1 } : {},
            }}
        >
            {dotColor && (
                <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: dotColor, flexShrink: 0 }} />
            )}
            <Box sx={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1, color: "text.primary", whiteSpace: "nowrap" }}>
                {label}{" "}
                <Box component="span" sx={{ opacity: 0.65 }}>{count}</Box>
            </Box>
        </Box>
    );
}

export default function StatusStatChips({
    stats,
    total,
    statuses = ["TODO", "IN_PROGRESS", "DONE"],
    labelOf, // 워크스페이스 커스텀 상태 라벨 resolver (없으면 getStatusLabel 폴백)
    colorOf, // 워크스페이스 커스텀 상태 색 resolver (기본 토큰에 없는 키에 사용)
    showTotal = true,
    statusSet,
    onToggleStatus,
    onClearStatus,
    sx,
}) {
    const theme = useTheme();
    const safeStats = stats ?? {};
    const safeTotal =
        typeof total === "number"
            ? total
            : statuses.reduce((acc, s) => acc + Number(safeStats?.[s] ?? 0), 0);

    const clickable = typeof onToggleStatus === "function";
    const hasSelection = statusSet instanceof Set && statusSet.size > 0;
    const isSelected = (st) => (statusSet instanceof Set ? statusSet.has(st) : false);

    return (
        <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", ...sx }}>
            {statuses.map((st) => {
                const tokens = statusTokens(theme, st, colorOf);
                const selected = isSelected(st);
                return (
                    <StatChip
                        key={st}
                        label={typeof labelOf === "function" ? labelOf(st) : getStatusLabel(st)}
                        count={Number(safeStats?.[st] ?? 0)}
                        dotColor={tokens.color}
                        activeBg={tokens.soft}
                        selected={selected}
                        clickable={clickable}
                        dimmed={hasSelection && !selected}
                        onClick={clickable ? () => onToggleStatus(st) : undefined}
                    />
                );
            })}

            {showTotal && (
                <StatChip
                    label="전체"
                    count={safeTotal}
                    dotColor={null}
                    activeBg="var(--plando-gray-soft)"
                    selected={!hasSelection}
                    clickable={typeof onClearStatus === "function"}
                    dimmed={false}
                    onClick={typeof onClearStatus === "function" ? onClearStatus : undefined}
                />
            )}
        </Stack>
    );
}
