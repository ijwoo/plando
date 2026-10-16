/**
 * Shared primitives for the recruitment create modal:
 * - STEP_LABELS, createInitialForm
 * - FieldLabel, CountStepper, StepBar
 */
import React from "react";
import { Box, IconButton, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import RemoveRoundedIcon from "@mui/icons-material/RemoveRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";

export const scrollInputIntoView = (e) => {
    setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 350);
};

export const STEP_LABELS = ["워크스페이스", "기본 정보", "모집 역할", "진행 방식"];

export const createInitialForm = (workspaceMemberCount = 1) => ({
    category: "토이프로젝트",
    title: "",
    desc: "",
    stacks: [],
    roles: [],
    currentMembers: workspaceMemberCount,
    maxMembers: Math.max(workspaceMemberCount + 1, 3),
    meetType: "online",
    location: null,   // { locationLat, locationLng, locationName, locationAddress } | null
    frequency: "주 2회",
    duration: "3개월",
    deadline: "",
    tools: [],
    requirements: "",
});

export function FieldLabel({ children, required, hint }) {
    return (
        <Stack
            direction="row"
            alignItems="baseline"
            justifyContent="space-between"
            sx={{ mb: 1, gap: 0.75 }}
        >
            <Typography sx={{
                fontSize: 13.5,
                fontWeight: 700,
                color: "text.primary",
                letterSpacing: "-0.015em",
            }}>
                {children}
                {required && (
                    <Box component="span" sx={{ color: "primary.main", ml: "1px" }}>*</Box>
                )}
            </Typography>
            {hint != null && (
                <Typography sx={{
                    fontSize: 11.5,
                    color: "text.disabled",
                    fontWeight: 500,
                    fontVariantNumeric: "tabular-nums",
                }}>
                    {hint}
                </Typography>
            )}
        </Stack>
    );
}

/**
 * CountStepper — pill 형태의 -/숫자/+ 컨트롤
 * @param {"sm"|"md"} size  sm: 28px 버튼 (role item), md: 36px 버튼 (headcount card)
 */
export function CountStepper({ value, min = 1, max = 20, onChange, size = "sm" }) {
    const theme = useTheme();
    const btn = size === "md" ? 36 : 28;
    const radius = size === "md" ? 2.5 : 1.75;
    const inner = size === "md" ? 1.5 : 1.25;
    const valWidth = size === "md" ? 32 : 26;
    const fontSize = size === "md" ? 15 : 13;
    return (
        <Stack
            direction="row"
            alignItems="center"
            sx={{
                bgcolor: size === "md" ? "background.paper" : alpha(theme.palette.text.primary, 0.05),
                border: size === "md" ? "1px solid" : "0",
                borderColor: "divider",
                borderRadius: radius,
                p: "3px",
                flexShrink: 0,
            }}
        >
            <IconButton
                size="small"
                disabled={value <= min}
                onClick={() => onChange(Math.max(min, value - 1))}
                sx={{
                    width: btn, height: btn,
                    borderRadius: inner,
                    color: "text.primary",
                    "&:hover": { bgcolor: alpha(theme.palette.text.primary, 0.06) },
                    "&.Mui-disabled": { color: "text.disabled" },
                }}
            >
                <RemoveRoundedIcon sx={{ fontSize: size === "md" ? 18 : 14 }} />
            </IconButton>
            <Typography sx={{
                width: valWidth,
                textAlign: "center",
                fontSize,
                fontWeight: 800,
                color: "text.primary",
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "-0.02em",
            }}>
                {value}
            </Typography>
            <IconButton
                size="small"
                disabled={value >= max}
                onClick={() => onChange(Math.min(max, value + 1))}
                sx={{
                    width: btn, height: btn,
                    borderRadius: inner,
                    color: "text.primary",
                    "&:hover": { bgcolor: alpha(theme.palette.text.primary, 0.06) },
                    "&.Mui-disabled": { color: "text.disabled" },
                }}
            >
                <AddRoundedIcon sx={{ fontSize: size === "md" ? 18 : 14 }} />
            </IconButton>
        </Stack>
    );
}

/**
 * StepBar — slim numbered dots + connecting line + labels under
 * step: 1-based index of current step (0이면 워크스페이스 단계). 완료된 dot은 체크.
 */
export function StepBar({ step }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const trackBg = alpha(theme.palette.text.primary, 0.07);
    // active dot: 라이트에서는 dark ink, 다크에서는 light surface로 자동 inversion
    const activeBg = isDark ? theme.palette.common.white : theme.palette.text.primary;
    const activeColor = isDark ? theme.palette.grey[900] : theme.palette.common.white;

    return (
        <Box sx={{ width: "100%" }}>
            {/* dots + lines */}
            <Stack direction="row" alignItems="center" spacing={0.75}>
                {STEP_LABELS.map((label, i) => {
                    const idx = i + 1;
                    const done = idx < step;
                    const active = idx === step;
                    return (
                        <React.Fragment key={label}>
                            <Box sx={{
                                width: 24, height: 24, borderRadius: "50%",
                                bgcolor: done
                                    ? "primary.main"
                                    : active
                                        ? activeBg
                                        : trackBg,
                                color: done
                                    ? "primary.contrastText"
                                    : active
                                        ? activeColor
                                        : "text.disabled",
                                display: "grid",
                                placeItems: "center",
                                fontSize: 11.5,
                                fontWeight: 700,
                                fontVariantNumeric: "tabular-nums",
                                flexShrink: 0,
                                transition: "all 0.2s ease",
                                boxShadow: active ? `0 0 0 4px ${trackBg}` : "none",
                            }}>
                                {done
                                    ? <CheckRoundedIcon sx={{ fontSize: 14 }} />
                                    : idx}
                            </Box>
                            {i < STEP_LABELS.length - 1 && (
                                <Box sx={{
                                    flex: 1, height: 2, borderRadius: 1,
                                    bgcolor: done ? "primary.main" : trackBg,
                                    transition: "background 0.25s",
                                }} />
                            )}
                        </React.Fragment>
                    );
                })}
            </Stack>

            {/* labels */}
            <Stack direction="row" sx={{ mt: 1 }}>
                {STEP_LABELS.map((label, i) => {
                    const idx = i + 1;
                    const active = idx === step;
                    return (
                        <Typography
                            key={label}
                            sx={{
                                flex: 1,
                                textAlign: "center",
                                fontSize: 11,
                                fontWeight: active ? 700 : 600,
                                color: active ? "text.primary" : "text.disabled",
                                letterSpacing: "-0.005em",
                                whiteSpace: "nowrap",
                            }}
                        >
                            {label}
                        </Typography>
                    );
                })}
            </Stack>
        </Box>
    );
}
