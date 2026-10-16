import React from "react";
import { Avatar, Box, Stack, Typography } from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import { resolveImageUrl } from "../../../../shared/utils/urlUtils.js";
import { getRateColor } from "../../utils/dashboardUtils.js";

/**
 * 멤버별 진행률 + presence dot. memberStats / presenceMap 모두 실데이터.
 * presence는 STOMP 세션 기반 ONLINE/OFFLINE 이진값. (자리비움/미팅중은 v2)
 */
export default function TeamStatusList({ memberStats, userImageMap, presenceMap, onViewAll }) {
    const theme = useTheme();
    const onlineColor = theme.palette.success.main;
    const offlineColor = theme.palette.text.disabled;

    return (
        <Box
            sx={{
                bgcolor: "background.paper",
                borderRadius: "var(--plando-radius-card)",
                boxShadow: "var(--plando-elev-1)",
                p: 2.5,
            }}
        >
            <Stack direction="row" alignItems="baseline" justifyContent="space-between" sx={{ mb: 0.25 }}>
                <Typography sx={{ fontSize: 15, fontWeight: 800, color: "text.primary", letterSpacing: "-0.02em" }}>
                    팀원 진행 현황
                </Typography>
                {onViewAll && (
                    <Typography
                        onClick={onViewAll}
                        sx={{ fontSize: 12, fontWeight: 700, color: "primary.main", cursor: "pointer" }}
                    >
                        전체 보기
                    </Typography>
                )}
            </Stack>

            {/* 목록과 집계 기준이 달라 헷갈리지 않도록 명시 — 통계는 보관된 완료 항목까지 포함 */}
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: "text.disabled", letterSpacing: "-0.01em", mb: 1.5 }}>
                이번 주 마감 기준 · 완료(보관) 포함
            </Typography>

            {(memberStats ?? []).length === 0 ? (
                <Box sx={{ py: 3, textAlign: "center", color: "text.disabled", fontSize: 13, fontWeight: 600 }}>
                    멤버가 없어요
                </Box>
            ) : (
                <Stack spacing={1.75}>
                    {memberStats.slice(0, 5).map((m) => {
                        const presence = presenceMap?.[m.email];
                        const isOnline = !!presence?.online;
                        const dot = isOnline ? onlineColor : offlineColor;
                        const presenceLabel = isOnline ? "온라인" : "오프라인";
                        const rateColor = getRateColor(m.rate);
                        const avatarSrc = userImageMap?.[m.email]?.profileImageUrl
                            ? resolveImageUrl(userImageMap[m.email].profileImageUrl)
                            : undefined;
                        return (
                            <Stack key={m.email} direction="row" alignItems="center" spacing={1.5}>
                                <Box sx={{ position: "relative", flexShrink: 0 }}>
                                    <Avatar
                                        src={avatarSrc}
                                        sx={{
                                            width: 36, height: 36, fontSize: 14, fontWeight: 800,
                                            bgcolor: alpha(rateColor, theme.palette.mode === "dark" ? 0.22 : 0.15),
                                            color: rateColor,
                                        }}
                                    >
                                        {m.name?.charAt?.(0)}
                                    </Avatar>
                                    <Box
                                        sx={{
                                            position: "absolute",
                                            bottom: -1,
                                            right: -1,
                                            width: 11,
                                            height: 11,
                                            borderRadius: 999,
                                            bgcolor: dot,
                                            border: "2px solid",
                                            borderColor: "background.paper",
                                        }}
                                    />
                                </Box>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Stack direction="row" alignItems="baseline" justifyContent="space-between" sx={{ mb: 0.5 }}>
                                        <Stack direction="row" alignItems="baseline" spacing={0.75}>
                                            <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: "text.primary", letterSpacing: "-0.02em" }}>
                                                {m.name}
                                            </Typography>
                                            <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: "text.disabled" }}>
                                                {presenceLabel}
                                            </Typography>
                                        </Stack>
                                        <Typography
                                            sx={{
                                                fontSize: 12,
                                                fontWeight: 800,
                                                color: m.rate === 100 ? "success.main" : "text.secondary",
                                                fontVariantNumeric: "tabular-nums",
                                            }}
                                        >
                                            {m.done}/{m.total}
                                        </Typography>
                                    </Stack>
                                    <Box sx={{ height: 5, borderRadius: 999, bgcolor: alpha(rateColor, 0.12), overflow: "hidden" }}>
                                        <Box
                                            sx={{
                                                height: "100%",
                                                width: `${m.rate}%`,
                                                bgcolor: m.rate === 100 ? theme.palette.success.main : rateColor,
                                                borderRadius: 999,
                                                transition: "width var(--plando-dur-slow) var(--plando-ease)",
                                            }}
                                        />
                                    </Box>
                                </Box>
                            </Stack>
                        );
                    })}
                </Stack>
            )}
        </Box>
    );
}
