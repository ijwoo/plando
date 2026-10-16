import React from "react";
import { Avatar, Box, Card, CardContent, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { getGlassSx } from "../../../../shared/ui/glassSx.js";
import { resolveImageUrl } from "../../../../shared/utils/urlUtils.js";
import { getRateColor } from "../../utils/dashboardUtils.js";

/* 카드 공통 컨테이너 — 슬라이드 안에서 일관된 패딩/높이/glass */
function MemberCardShell({ children }) {
    const theme = useTheme();
    return (
        <Card
            elevation={0}
            sx={{
                borderRadius: "var(--plando-radius-card)",
                boxShadow: "var(--plando-elev-1)",
                height: "100%",
                ...getGlassSx(theme),
                borderColor: "transparent",
            }}
        >
            <CardContent sx={{ p: 2, "&:last-child": { pb: 2 }, height: "100%", display: "flex", flexDirection: "column" }}>
                {children}
            </CardContent>
        </Card>
    );
}

/** 개인 멤버 카드 (슬라이드 안 1장). props 시그니처 동일. */
export function MemberCard({ member, profileImageUrl }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const primary = theme.palette.primary.main;
    const rateColor = getRateColor(member.rate);
    const avatarSrc = profileImageUrl ? resolveImageUrl(profileImageUrl) : undefined;

    return (
        <MemberCardShell>
            <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: "auto" }}>
                <Avatar
                    src={avatarSrc}
                    sx={{
                        width: 36, height: 36,
                        fontSize: 14, fontWeight: 700,
                        flexShrink: 0,
                        bgcolor: alpha(rateColor, isDark ? 0.20 : 0.15),
                        color: rateColor,
                    }}
                >
                    {member.name.charAt(0)}
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                    <Typography
                        sx={{
                            fontSize: 14,
                            fontWeight: 700,
                            letterSpacing: "-0.01em",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        }}
                    >
                        {member.name}
                    </Typography>
                    <Box
                        sx={{
                            fontSize: 10, fontWeight: 700,
                            px: 0.875, py: 0.25,
                            borderRadius: 999,
                            bgcolor: alpha(primary, isDark ? 0.18 : 0.10),
                            color: "primary.main",
                            display: "inline-block",
                            mt: 0.25,
                        }}
                    >
                        멤버
                    </Box>
                </Box>
            </Stack>

            <Box sx={{ mt: 2 }}>
                <Stack direction="row" alignItems="baseline" spacing={0.5} sx={{ mb: 0.75 }}>
                    <Typography
                        sx={{
                            fontSize: 28,
                            fontWeight: 800,
                            lineHeight: 1,
                            color: rateColor,
                            letterSpacing: "-0.02em",
                            fontVariantNumeric: "tabular-nums",
                        }}
                    >
                        {member.rate}
                    </Typography>
                    <Typography sx={{ fontSize: 14, fontWeight: 700, color: rateColor }}>%</Typography>
                    <Typography sx={{ fontSize: 11, color: "text.disabled", ml: 0.5 }}>완료율</Typography>
                </Stack>

                <Box sx={{ height: 5, bgcolor: alpha(rateColor, 0.12), borderRadius: 999, overflow: "hidden" }}>
                    <Box
                        sx={{
                            height: "100%",
                            width: `${member.rate}%`,
                            bgcolor: rateColor,
                            borderRadius: 999,
                            transition: "width 0.5s ease",
                        }}
                    />
                </Box>
                <Typography sx={{ fontSize: 10, color: "text.disabled", mt: 0.75, fontWeight: 500 }}>
                    {member.done}개 완료 · 이번 주
                </Typography>
            </Box>
        </MemberCardShell>
    );
}

/** 전체 평균 카드. props 시그니처 동일. */
export function MemberAverageCard({ members, workspaceImageUrl }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const primary = theme.palette.primary.main;
    const total = members.reduce((s, m) => s + m.done, 0);
    const avgRate = members.length > 0
        ? Math.round(members.reduce((s, m) => s + m.rate, 0) / members.length)
        : 0;
    const avatarSrc = workspaceImageUrl ? resolveImageUrl(workspaceImageUrl) : undefined;

    return (
        <MemberCardShell>
            <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: "auto" }}>
                <Avatar
                    src={avatarSrc}
                    sx={{
                        width: 36, height: 36,
                        fontSize: 14, fontWeight: 700,
                        flexShrink: 0,
                        bgcolor: alpha(primary, isDark ? 0.18 : 0.12),
                        color: "primary.main",
                    }}
                >
                    WS
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em" }}>
                        전체 평균
                    </Typography>
                    <Box
                        sx={{
                            fontSize: 10, fontWeight: 700,
                            px: 0.875, py: 0.25,
                            borderRadius: 999,
                            bgcolor: alpha(primary, isDark ? 0.18 : 0.10),
                            color: "primary.main",
                            display: "inline-block",
                            mt: 0.25,
                        }}
                    >
                        {members.length}명
                    </Box>
                </Box>
            </Stack>

            <Box sx={{ mt: 2 }}>
                <Stack direction="row" alignItems="baseline" spacing={0.5} sx={{ mb: 0.75 }}>
                    <Typography
                        sx={{
                            fontSize: 28,
                            fontWeight: 800,
                            lineHeight: 1,
                            letterSpacing: "-0.02em",
                            fontVariantNumeric: "tabular-nums",
                        }}
                    >
                        {avgRate}
                    </Typography>
                    <Typography sx={{ fontSize: 14, fontWeight: 700 }}>%</Typography>
                    <Typography sx={{ fontSize: 11, color: "text.disabled", ml: 0.5 }}>완료율</Typography>
                </Stack>

                <Box sx={{ height: 5, bgcolor: alpha(primary, 0.10), borderRadius: 999, overflow: "hidden" }}>
                    <Box
                        sx={{
                            height: "100%",
                            width: `${avgRate}%`,
                            background: `linear-gradient(90deg, ${primary}, ${alpha(primary, 0.7)})`,
                            borderRadius: 999,
                            transition: "width 0.5s ease",
                        }}
                    />
                </Box>
                <Typography sx={{ fontSize: 10, color: "text.disabled", mt: 0.75, fontWeight: 500 }}>
                    {total}개 합산
                </Typography>
            </Box>
        </MemberCardShell>
    );
}
