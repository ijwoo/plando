import React, { useEffect, useState } from "react";
import { Box, Card, CardContent, CircularProgress, Stack, Typography, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";

import { getGlassSx, getMobilePageBg } from "../../../shared/ui/glassSx.js";
import { FADE_IN } from "../../../shared/ui/primitives/motion.js";
import Press from "../../../shared/ui/primitives/Press.jsx";
import { getApiError } from "../../../shared/api/axiosInstance.js";
import { toast } from "../../../shared/utils/toast.js";
import { getWrapHistory } from "../api/wrapApi.js";

export default function WrapHistoryPage() {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));
    if (isMobile) return <WrapHistoryInner />;

    const isDark = theme.palette.mode === "dark";
    return (
        <Box
            sx={{
                width: "100%",
                minHeight: "100vh",
                display: "flex",
                justifyContent: "center",
                alignItems: "flex-start",
                py: 4,
                background: isDark ? "rgba(15,23,42,0.40)" : "rgba(241,243,245,0.55)",
            }}
        >
            <Box
                sx={{
                    width: "100%",
                    maxWidth: 480,
                    minHeight: "calc(100vh - 64px)",
                    borderRadius: 4,
                    overflow: "hidden",
                    position: "relative",
                    transform: "translateZ(0)",
                    boxShadow: isDark
                        ? "0 24px 60px rgba(0,0,0,0.50), 0 0 0 1px rgba(255,255,255,0.05)"
                        : "0 24px 60px rgba(15,23,42,0.10), 0 0 0 1px rgba(15,23,42,0.04)",
                    background: theme.palette.background.default,
                }}
            >
                <WrapHistoryInner />
            </Box>
        </Box>
    );
}

function WrapHistoryInner() {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const navigate = useNavigate();

    const [items, setItems] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        getWrapHistory(12)
            .then((res) => { if (!cancelled) setItems(res.data); })
            .catch((e) => {
                if (cancelled) return;
                toast.error(getApiError(e, "회고 기록을 불러오지 못했어요."));
            })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    return (
        <Box
            component={motion.div}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={FADE_IN}
            sx={{
                minHeight: "100vh",
                background: getMobilePageBg(theme),
                pb: "calc(40px + env(safe-area-inset-bottom))",
            }}
        >
            {/* 헤더 */}
            <Stack
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{
                    px: 1.5,
                    py: 1.25,
                    position: "sticky",
                    top: 0,
                    zIndex: 5,
                    backdropFilter: "blur(14px)",
                    WebkitBackdropFilter: "blur(14px)",
                    background: isDark ? "rgba(15, 23, 42, 0.55)" : "rgba(240, 242, 245, 0.55)",
                }}
            >
                <Press
                    as="span"
                    onClick={() => navigate(-1)}
                    haptic="light"
                    pressScale={0.9}
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 38,
                        height: 38,
                        borderRadius: 999,
                    }}
                >
                    <ArrowBackRoundedIcon
                        sx={{ fontSize: 22, color: isDark ? "#F1F5F9" : "var(--plando-text-primary)" }}
                    />
                </Press>
                <Typography
                    sx={{
                        fontSize: "var(--plando-type-title3-size)",
                        fontWeight: "var(--plando-type-title3-weight)",
                        color: "text.primary",
                        letterSpacing: "var(--plando-type-title3-ls)",
                    }}
                >
                    지난 회고
                </Typography>
            </Stack>

            <Stack sx={{ px: 2.5, pt: 1.5 }} spacing={2}>
                {loading ? (
                    <Stack alignItems="center" sx={{ py: 6 }}>
                        <CircularProgress size={24} />
                    </Stack>
                ) : !items || items.length === 0 ? (
                    <Stack alignItems="center" sx={{ py: 6 }}>
                        <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: "text.secondary" }}>
                            아직 기록이 없어요
                        </Typography>
                    </Stack>
                ) : (
                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: "repeat(2, 1fr)",
                            gap: 1.5,
                        }}
                    >
                        {items.map((it, i) => (
                            <motion.div
                                key={it.weekStart}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.35, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
                            >
                                <HistoryCard
                                    item={it}
                                    isDark={isDark}
                                    onClick={() => navigate(`/wrap?weekStart=${it.weekStart}`)}
                                />
                            </motion.div>
                        ))}
                    </Box>
                )}
            </Stack>
        </Box>
    );
}

function HistoryCard({ item, isDark, onClick }) {
    const theme = useTheme();
    return (
        <Press as="div" onClick={onClick} haptic="light" pressScale={0.98} style={{ display: "block" }}>
            <Card
                elevation={0}
                sx={{
                    width: "100%",
                    borderRadius: "var(--plando-radius-card)",
                    boxShadow: "var(--plando-elev-1)",
                    ...getGlassSx(theme),
                    borderColor: "transparent",
                }}
            >
                <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                    <Stack spacing={1}>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                            <Typography
                                sx={{
                                    fontSize: 12.5,
                                    fontWeight: 800,
                                    color: item.current ? "var(--plando-primary)" : (isDark ? "rgba(255,255,255,0.55)" : "var(--plando-text-secondary)"),
                                    letterSpacing: "-0.01em",
                                }}
                            >
                                {item.month}월 {item.weekIndex}주차
                            </Typography>
                            {item.current ? (
                                <Box
                                    sx={{
                                        fontSize: 9,
                                        fontWeight: 800,
                                        padding: "2px 6px",
                                        borderRadius: 999,
                                        background: "var(--plando-primary-soft)",
                                        color: "var(--plando-primary)",
                                        letterSpacing: "0.04em",
                                    }}
                                >
                                    이번 주
                                </Box>
                            ) : null}
                        </Stack>
                        <Typography
                            sx={{
                                fontSize: 11.5,
                                fontWeight: 600,
                                color: isDark ? "rgba(255,255,255,0.42)" : "var(--plando-text-tertiary)",
                            }}
                        >
                            {item.rangeLabel}
                        </Typography>
                        <Stack direction="row" alignItems="baseline" spacing={0.5} sx={{ mt: 0.5 }}>
                            <Typography
                                sx={{
                                    fontSize: 26,
                                    fontWeight: 800,
                                    letterSpacing: "-0.03em",
                                    lineHeight: 1,
                                    color: isDark ? "#F8FAFC" : "var(--plando-text-primary)",
                                }}
                            >
                                {item.totalCount}
                            </Typography>
                            <Typography sx={{ fontSize: 12, fontWeight: 700, color: isDark ? "rgba(255,255,255,0.55)" : "var(--plando-text-tertiary)" }}>
                                개
                            </Typography>
                        </Stack>
                        <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: isDark ? "rgba(255,255,255,0.5)" : "var(--plando-text-secondary)" }}>
                            소화 {item.pastCompletionRate}% · {item.pastDoneCount}/{item.pastCount}건
                        </Typography>
                    </Stack>
                </CardContent>
            </Card>
        </Press>
    );
}
