import React, { useEffect, useState } from "react";
import { Box, Stack, Typography } from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";

/**
 * 사이드바 상단 "오늘 포커스 카드".
 *
 * Expanded: 날짜 칩 + "오늘 N건 마감" + 완료/진행/남은 + 진행률 바 + "대시보드 →".
 * Collapsed: 44×44 conic-gradient 진행률 링 (가운데 N%).
 */
export default function SidebarFocusCard({
    collapsed,
    todayTotal,
    todayDone,
    todayPending,
    todayInProgress,
    todayProgress,
    overdueCount,
    onMobileClose,
}) {
    const theme = useTheme();
    const navigate = useNavigate();
    const isDark = theme.palette.mode === "dark";
    const accent = theme.palette.primary.main;

    // 라이브 시계 — 30초 마다 갱신 + 탭 visibility 복귀 시 즉시 보정.
    // setInterval 만으로는 백그라운드 탭 throttle/스로틀 후 분 단위 이상 어긋날 수 있어
    // visibilitychange 핸들러를 함께 둠.
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const tick = () => setNow(new Date());
        const t = setInterval(tick, 30_000);
        const onVis = () => { if (document.visibilityState === "visible") tick(); };
        document.addEventListener("visibilitychange", onVis);
        return () => {
            clearInterval(t);
            document.removeEventListener("visibilitychange", onVis);
        };
    }, []);

    const dateLabel = (() => {
        const d = now;
        const days = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
        return `${d.getMonth() + 1}월 ${d.getDate()}일 ${days[d.getDay()]}`;
    })();
    const timeLabel = (() => {
        const h = String(now.getHours()).padStart(2, "0");
        const m = String(now.getMinutes()).padStart(2, "0");
        return `${h}:${m}`;
    })();

    const goDashboard = () => {
        navigate("/dashboard");
        onMobileClose?.();
    };

    // Collapsed: conic-gradient ring
    if (collapsed) {
        if (todayTotal === 0) return null;
        return (
            <Box
                title={`오늘 진행률 ${todayProgress}% · 완료 ${todayDone} / ${todayTotal}`}
                sx={{
                    margin: "2px auto 12px",
                    width: 44, height: 44,
                    borderRadius: "50%",
                    background: `conic-gradient(${accent} 0% ${todayProgress}%, ${isDark ? "rgba(255,255,255,0.08)" : "#EEF1F5"} ${todayProgress}% 100%)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer",
                }}
                onClick={goDashboard}
            >
                <Box sx={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: theme.palette.background.paper,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10.5, fontWeight: 800,
                    color: accent,
                    letterSpacing: "-0.02em",
                    fontVariantNumeric: "tabular-nums",
                }}>
                    {todayProgress}%
                </Box>
            </Box>
        );
    }

    // Expanded card
    if (todayTotal === 0) {
        return (
            <Box sx={{
                m: "8px 0 12px",
                p: "12px 14px",
                borderRadius: "14px",
                bgcolor: isDark ? alpha(accent, 0.06) : alpha(accent, 0.04),
            }}>
                <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.75 }}>
                    <Box sx={{
                        display: "inline-flex", alignItems: "center",
                        px: "8px", py: "2px",
                        borderRadius: 999,
                        background: theme.palette.background.paper,
                        color: accent,
                        fontSize: 10.5, fontWeight: 800,
                        letterSpacing: "-0.005em",
                    }}>
                        {dateLabel}
                    </Box>
                    <Typography sx={{
                        fontSize: 10, fontWeight: 700,
                        color: "text.secondary",
                        fontVariantNumeric: "tabular-nums",
                    }}>
                        {timeLabel}
                    </Typography>
                </Stack>
                <Typography sx={{
                    fontSize: 13, fontWeight: 800,
                    color: "text.primary",
                    letterSpacing: "-0.01em",
                    lineHeight: 1.4,
                }}>
                    오늘 마감 작업이 없어요
                </Typography>
                <Typography sx={{
                    fontSize: 11, fontWeight: 700,
                    color: "text.secondary",
                    mt: 0.25,
                }}>
                    {overdueCount > 0 ? `지연된 작업 ${overdueCount}건` : "여유로운 하루입니다 !"}
                </Typography>
            </Box>
        );
    }

    const trackBg = isDark ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.6)";

    return (
        <Box sx={{
            position: "relative",
            m: "8px 0 12px",
            p: "12px 14px",
            borderRadius: "14px",
            overflow: "hidden",
            bgcolor: isDark ? alpha(accent, 0.10) : alpha(accent, 0.06),
        }}>

            <Box sx={{ position: "relative" }}>
                <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.75 }}>
                    <Box sx={{
                        display: "inline-flex", alignItems: "center",
                        px: "8px", py: "2px",
                        borderRadius: 999,
                        background: theme.palette.background.paper,
                        color: accent,
                        fontSize: 10.5, fontWeight: 800,
                        letterSpacing: "-0.005em",
                    }}>
                        {dateLabel}
                    </Box>
                    <Typography sx={{
                        fontSize: 10, fontWeight: 700,
                        color: "text.secondary",
                        fontVariantNumeric: "tabular-nums",
                    }}>
                        {timeLabel}
                    </Typography>
                </Stack>

                <Typography sx={{
                    fontSize: 13, fontWeight: 800,
                    color: "text.primary",
                    letterSpacing: "-0.01em",
                    lineHeight: 1.4,
                }}>
                    오늘{" "}
                    <Box component="span" sx={{ color: todayPending > 0 ? "var(--plando-red)" : accent }}>
                        {todayPending}건
                    </Box>
                    {" "}마감
                </Typography>

                <Typography sx={{
                    fontSize: 11, fontWeight: 700,
                    color: "text.secondary",
                    mt: 0.25,
                    mb: 1,
                    fontVariantNumeric: "tabular-nums",
                }}>
                    완료 {todayDone} · 진행 {todayInProgress} · 남은 {todayPending}
                </Typography>

                {/* 진행률 바 */}
                <Box sx={{
                    height: 5,
                    borderRadius: 999,
                    background: trackBg,
                    overflow: "hidden",
                }}>
                    <Box sx={{
                        width: `${todayProgress}%`,
                        height: "100%",
                        background: accent,
                        borderRadius: 999,
                        transition: "width 320ms ease",
                    }} />
                </Box>

                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 0.75 }}>
                    <Typography sx={{
                        fontSize: 10.5, fontWeight: 800,
                        color: "text.secondary",
                        letterSpacing: "-0.005em",
                        fontVariantNumeric: "tabular-nums",
                    }}>
                        오늘 진행률 {todayProgress}%
                    </Typography>
                    <Box
                        component="button"
                        onClick={goDashboard}
                        sx={{
                            display: "inline-flex", alignItems: "center", gap: 0.5,
                            fontSize: 10.5, fontWeight: 800,
                            color: accent,
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            padding: 0,
                            letterSpacing: "-0.005em",
                            "&:hover": { textDecoration: "underline" },
                        }}
                    >
                        대시보드
                        <ArrowForwardRoundedIcon sx={{ fontSize: 12 }} />
                    </Box>
                </Stack>
            </Box>
        </Box>
    );
}
