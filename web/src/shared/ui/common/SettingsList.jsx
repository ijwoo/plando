import React from "react";
import { Box, Typography, TextField, Switch } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import { fadeDividerSx } from "../glassSx.js";

/**
 * 모바일 설정·더보기 공용 리스트 카드 컴포넌트.
 * 설정/더보기가 같은 카드 문법을 쓰도록 추출 (SectionLabel / SettingsCard / SettingsRow).
 */

export function SectionLabel({ children, sx }) {
    return (
        <Typography sx={{
            px: 2, pt: 2.5, pb: 0.75,
            fontSize: 12, fontWeight: 600,
            color: "text.secondary",
            textTransform: "uppercase",
            letterSpacing: 0.6,
            ...sx,
        }}>
            {children}
        </Typography>
    );
}

export function SettingsCard({ children }) {
    return (
        <Box sx={{
            mx: 2,
            borderRadius: "var(--plando-radius-card)",
            overflow: "hidden",
            bgcolor: "var(--plando-surface-card)",
            boxShadow: "var(--plando-elev-1)",
        }}>
            {children}
        </Box>
    );
}

/**
 * 리스트 행.
 *   iconEl: 아이콘 노드 (없으면 타일 자체 생략 — 계정 행 등)
 *   iconColor: 지정 시 유색 타일(틴트 배경 + 색 아이콘), 미지정 시 무채색 타일
 *   value / valueColor: 우측 보조 텍스트
 *   desc: 라벨 아래 한 줄 설명
 *   isDestructive: 빨강 라벨(로그아웃/탈퇴)
 */
export function SettingsRow({
    iconEl, iconColor, label, value, valueColor, desc,
    onClick, isDestructive, isLast,
}) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const border = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";

    return (
        <Box
            onClick={onClick}
            sx={{
                display: "flex", alignItems: "center", gap: 1.5,
                px: 2, py: 1.5,
                cursor: onClick ? "pointer" : "default",
                ...(isLast ? {} : fadeDividerSx(border, "bottom")),
                transition: "background 0.1s",
                "&:active": onClick ? { bgcolor: "var(--plando-surface-low)" } : undefined,
            }}
        >
            {iconEl && (
                <Box sx={{
                    width: 32, height: 32, borderRadius: "10px",
                    // 타일 배경은 항상 무채색, 아이콘 글리프만 색상 (토스식)
                    bgcolor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.045)",
                    color: iconColor || "text.secondary",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                }}>
                    {iconEl}
                </Box>
            )}
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{
                    fontSize: 15.5, fontWeight: 500,
                    color: isDestructive ? "error.main" : "text.primary",
                }} noWrap>
                    {label}
                </Typography>
                {desc && (
                    <Typography sx={{ fontSize: 12.5, color: "text.disabled" }} noWrap>
                        {desc}
                    </Typography>
                )}
            </Box>
            {value && (
                <Typography sx={{ fontSize: 14, color: valueColor ?? "text.secondary", mr: 0.5, flexShrink: 0 }}>
                    {value}
                </Typography>
            )}
            {onClick && !isDestructive && (
                <ChevronRightRoundedIcon sx={{ fontSize: 20, color: "text.disabled", flexShrink: 0 }} />
            )}
        </Box>
    );
}

/**
 * 라벨/설명 + 우측 스위치 한 줄. (설정·더보기가 각자 만들던 토글 행 공통화)
 *   checked / onChange(boolean): 값은 즉시 적용된다는 전제(저장 버튼 없음)
 *   disabled: 스위치만 비활성 (행 텍스트는 그대로 읽히게)
 */
export function SettingsToggleRow({
    iconEl, iconColor, label, desc, checked, onChange, disabled, isLast,
}) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const border = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";

    return (
        <Box sx={{
            display: "flex", alignItems: "center", gap: 1.5,
            px: 2, py: 1.5,
            ...(isLast ? {} : fadeDividerSx(border, "bottom")),
        }}>
            {iconEl && (
                <Box sx={{
                    width: 32, height: 32, borderRadius: "10px",
                    bgcolor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.045)",
                    color: iconColor || "text.secondary",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                }}>
                    {iconEl}
                </Box>
            )}
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 15.5, fontWeight: 500 }} noWrap>{label}</Typography>
                {desc && (
                    <Typography sx={{ fontSize: 12.5, color: "text.disabled" }}>{desc}</Typography>
                )}
            </Box>
            <Switch
                checked={!!checked}
                disabled={!!disabled}
                onChange={(e) => onChange?.(e.target.checked)}
                sx={{ flexShrink: 0 }}
            />
        </Box>
    );
}

/**
 * 라벨/설명 + 우측 standard select 한 줄. (설정 화면의 select 행 공통화)
 *   value / onChange: TextField에 그대로 전달
 *   children: <MenuItem> 목록
 */
export function SettingSelectRow({ label, desc, value, onChange, children, isLast }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const border = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";
    return (
        <Box sx={{
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5,
            px: 2, py: 1.5,
            ...(isLast ? {} : fadeDividerSx(border, "bottom")),
        }}>
            <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 15, fontWeight: 600 }}>{label}</Typography>
                {desc && <Typography variant="caption" color="text.secondary">{desc}</Typography>}
            </Box>
            <TextField
                size="small" select variant="standard" value={value} onChange={onChange}
                sx={{ minWidth: 116, flexShrink: 0, "& .MuiInput-underline:before": { borderColor: "divider" } }}
            >
                {children}
            </TextField>
        </Box>
    );
}
