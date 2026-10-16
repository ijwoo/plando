import React from "react";
import { Box, Stack, Tooltip, Typography } from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";

/**
 * 사이드바 nav 항목.
 *
 * Expanded: accent-tint 배경 + 굵은 텍스트 + (optional) trailing/badge.
 * Collapsed: 아이콘 only + 우측 상단 dot 뱃지.
 */
export function NavItem({ icon, label, active, badge, badgeTone, trailing, collapsed, onClick }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const accentSoft = isDark ? alpha(theme.palette.primary.main, 0.18) : "var(--plando-primary-soft)";
    const badgeColor = badgeTone === "danger" ? "var(--plando-red)"
        : badgeTone === "purple" ? "var(--plando-purple)"
        : theme.palette.primary.main;

    // ── Collapsed: 아이콘 + 아래 작은 라벨 (ClickUp식) ──
    if (collapsed) {
        return (
            <Box
                component="button"
                onClick={onClick}
                sx={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: "3px",
                    width: "100%", py: 0.5, border: "none", background: "transparent",
                    cursor: "pointer", fontFamily: "var(--plando-font)",
                }}
            >
                <Box sx={{
                    position: "relative",
                    width: 44, height: 32, borderRadius: "10px",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: active ? accentSoft : "transparent",
                    color: active ? theme.palette.primary.main : theme.palette.text.disabled,
                    transition: "background 120ms ease, color 120ms ease",
                    "& > svg": { fontSize: 20 },
                    "&:hover": { background: active ? accentSoft : theme.palette.action.hover },
                }}>
                    {icon}
                    {badge != null && badge !== 0 && (
                        <Box component="span" sx={{
                            position: "absolute", top: 2, right: 5,
                            minWidth: 8, height: 8, borderRadius: 999,
                            background: badgeColor,
                            boxShadow: `0 0 0 2px ${theme.palette.background.paper}`,
                        }} />
                    )}
                </Box>
                <Box component="span" sx={{
                    fontSize: 9.5, fontWeight: active ? 800 : 600, lineHeight: 1.1,
                    letterSpacing: "-0.02em",
                    color: active ? theme.palette.primary.main : theme.palette.text.secondary,
                    maxWidth: "100%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                    {label}
                </Box>
            </Box>
        );
    }

    // ── Expanded ──
    return (
        <Box
            component="button"
            onClick={onClick}
            sx={{
                position: "relative",
                display: "flex", alignItems: "center", gap: 1.25, justifyContent: "flex-start",
                width: "100%", height: 36, px: 1.5,
                borderRadius: "10px", border: "none", cursor: "pointer",
                background: active ? accentSoft : "transparent",
                color: active ? theme.palette.primary.main : theme.palette.text.secondary,
                fontFamily: "var(--plando-font)", fontSize: 13, fontWeight: active ? 800 : 700,
                letterSpacing: "-0.015em", textAlign: "left",
                transition: "background 120ms ease, color 120ms ease",
                "&:hover": { background: active ? accentSoft : theme.palette.action.hover },
            }}
        >
            <Box sx={{ width: 18, display: "flex", alignItems: "center", justifyContent: "center", color: active ? theme.palette.primary.main : theme.palette.text.disabled, "& > svg": { fontSize: 18 } }}>
                {icon}
            </Box>
            <Box component="span" sx={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {label}
            </Box>
            {trailing && (
                <Box component="span" sx={{ fontSize: 10.5, fontWeight: 800, color: badgeTone === "danger" ? "var(--plando-red)" : theme.palette.text.disabled, letterSpacing: "-0.005em", fontVariantNumeric: "tabular-nums" }}>
                    {trailing}
                </Box>
            )}
            {badge != null && badge !== 0 && (
                <Box component="span" sx={{
                    fontSize: 10.5, fontWeight: 800, lineHeight: 1,
                    background: active ? theme.palette.background.paper : (isDark ? "rgba(255,255,255,0.06)" : "#fff"),
                    color: active ? theme.palette.primary.main : theme.palette.text.disabled,
                    boxShadow: active ? "none" : `inset 0 0 0 1px ${theme.palette.divider}`,
                    px: "7px", py: "2px", borderRadius: 999, minWidth: 18, textAlign: "center", fontVariantNumeric: "tabular-nums",
                }}>
                    {badge}
                </Box>
            )}
        </Box>
    );
}

/**
 * UPPERCASE 그룹 라벨 + (optional) 우측 "+" 버튼.
 * Collapsed 일 때는 얇은 1px divider 로 대체.
 */
export function SectionLabel({ children, onAdd, addLabel, collapsed }) {
    const theme = useTheme();
    if (collapsed) {
        return <Box sx={{ height: "1px", bgcolor: "divider", mx: 1, my: 1.25 }} />;
    }
    return (
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ px: 1.5, pt: 1.75, pb: 0.75 }}>
            <Typography sx={{
                fontSize: 10.5,
                fontWeight: 800,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: theme.palette.text.disabled,
            }}>
                {children}
            </Typography>
            <Box sx={{ flex: 1, height: "1px", bgcolor: "divider" }} />
            {onAdd && (
                <Tooltip title={addLabel || "추가"} placement="top">
                    <Box
                        component="button"
                        onClick={onAdd}
                        aria-label={addLabel || "추가"}
                        sx={{
                            width: 16, height: 16,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            borderRadius: "5px",
                            color: theme.palette.text.disabled,
                            transition: "background 120ms ease, color 120ms ease",
                            "&:hover": {
                                background: theme.palette.action.hover,
                                color: theme.palette.text.secondary,
                            },
                        }}
                    >
                        <AddIcon sx={{ fontSize: 14 }} />
                    </Box>
                </Tooltip>
            )}
        </Stack>
    );
}
