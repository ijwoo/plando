import React from "react";
import { Box, Card, CardContent, Stack, Typography, Divider } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import NotificationsActiveRoundedIcon from "@mui/icons-material/NotificationsActiveRounded";
import Press from "../../../shared/ui/primitives/Press.jsx";
import { getGlassSx } from "../../../shared/ui/glassSx.js";

function ActionRow({ icon, iconBg, iconColor, label, sub, onClick, isDark }) {
    return (
        <Press
            as="div"
            onClick={onClick}
            haptic="light"
            pressScale={0.99}
            style={{ display: "block", width: "100%" }}
        >
            <Stack direction="row" alignItems="center" spacing={1.75} sx={{ py: 1.25 }}>
                <Box
                    sx={{
                        width: 36,
                        height: 36,
                        borderRadius: "var(--plando-radius-sm)",
                        background: iconBg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                    }}
                >
                    <Box sx={{ display: "flex", color: iconColor }}>{icon}</Box>
                </Box>
                <Stack spacing={0.25} sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                        sx={{
                            fontSize: "var(--plando-type-title3-size)",
                            fontWeight: "var(--plando-type-title3-weight)",
                            color: "text.primary",
                            letterSpacing: "var(--plando-type-title3-ls)",
                        }}
                    >
                        {label}
                    </Typography>
                    {sub ? (
                        <Typography
                            sx={{
                                fontSize: "var(--plando-type-caption-size)",
                                fontWeight: "var(--plando-type-caption-weight)",
                                color: "text.secondary",
                            }}
                        >
                            {sub}
                        </Typography>
                    ) : null}
                </Stack>
                <ChevronRightRoundedIcon
                    sx={{
                        fontSize: 22,
                        color: "text.secondary",
                        flexShrink: 0,
                        opacity: 0.6,
                    }}
                />
            </Stack>
        </Press>
    );
}

/**
 * 회고 다음 액션 카드 — 토스의 "더 보기" row 패턴.
 * 하나의 카드 안에 액션 row 들을 divider로 나눈 구성.
 */
export default function WrapNextActions() {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const navigate = useNavigate();

    const dividerColor = isDark ? "rgba(255,255,255,0.06)" : "var(--plando-divider)";

    return (
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
            <CardContent sx={{ p: 1, "&:last-child": { pb: 1 } }}>
                <Box sx={{ px: 1.25 }}>
                    <ActionRow
                        isDark={isDark}
                        icon={<HistoryRoundedIcon sx={{ fontSize: 19 }} />}
                        iconBg={isDark ? "rgba(124,92,255,0.16)" : "#F1ECFF"}
                        iconColor="#7C5CFF"
                        label="지난 회고 보기"
                        sub="이전 주차 기록을 살펴봐요"
                        onClick={() => navigate("/wrap/history")}
                    />
                    <Divider sx={{ borderColor: dividerColor }} />
                    <ActionRow
                        isDark={isDark}
                        icon={<FlagRoundedIcon sx={{ fontSize: 19 }} />}
                        iconBg={isDark ? "rgba(16,185,129,0.16)" : "#E7F8F1"}
                        iconColor="#10B981"
                        label="다음 주 목표 정하기"
                        sub="이번 주 인사이트로 다음 주를"
                        onClick={() => navigate("/todos")}
                    />
                    <Divider sx={{ borderColor: dividerColor }} />
                    <ActionRow
                        isDark={isDark}
                        icon={<NotificationsActiveRoundedIcon sx={{ fontSize: 19 }} />}
                        iconBg={isDark ? "rgba(45,110,245,0.18)" : "var(--plando-primary-soft)"}
                        iconColor="var(--plando-primary)"
                        label="회고 알림 설정"
                        sub="일요일 밤 9시에 받고 있어요"
                        onClick={() => navigate("/settings")}
                    />
                </Box>
            </CardContent>
        </Card>
    );
}
