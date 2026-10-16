import React from "react";
import { Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import { formatTimeAgo } from "../../../../../shared/utils/formatters";
import { SHADOW } from "../../common/recruitmentSx";
import { ModeBadge } from "../../common/RecruitmentUI";

// ── meta strip item ──────────────────────────────────────────
function HmsItem({ label, divider, children }) {
    const theme = useTheme();
    return (
        <Box
            sx={{
                px: 2.5,
                position: "relative",
                "&:first-of-type": { pl: 0 },
                "&:last-of-type": { pr: 0 },
                ...(divider ? {
                    "&::before": {
                        content: '""', position: "absolute",
                        left: 0, top: 4, bottom: 4,
                        width: "1px",
                        bgcolor: alpha(theme.palette.text.primary, 0.07),
                    },
                } : {}),
            }}
        >
            <Typography sx={{
                fontSize: 10,
                color: "text.disabled",
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                mb: 0.75,
            }}>
                {label}
            </Typography>
            {children}
        </Box>
    );
}

/**
 * DetailHero — back bar + status row + 큰 타이틀 + 4-col meta strip
 */
export default function DetailHero({
    item,
    cat,
    detailLoading,
    onBack,
    curM,
    maxM,
    memberPct,
    dueText,
    isUrgent,
    meetLabel,
    locationText,
    deadlineStr,
    toolsStr,
    isOpen,
}) {
    const theme = useTheme();

    return (
        <>
            {/* ── Back bar ─────────────────────────────────────── */}
            <Box sx={{
                maxWidth: 1100,
                mx: "auto",
                px: 4,
                py: 2,
                display: "flex",
                alignItems: "center",
                gap: 1,
            }}>
                <Button
                    startIcon={<ArrowBackRoundedIcon sx={{ fontSize: 14 }} />}
                    onClick={onBack}
                    sx={{
                        color: "text.secondary",
                        fontWeight: 600,
                        fontSize: 13,
                        px: 1.5,
                        py: 0.875,
                        borderRadius: 1,
                        textTransform: "none",
                        minWidth: 0,
                        "&:hover": {
                            bgcolor: alpha(theme.palette.text.primary, 0.04),
                            color: "text.primary",
                        },
                    }}
                >
                    팀 모집 목록
                </Button>
                <Typography sx={{ fontSize: 12, color: "text.disabled" }}>·</Typography>
                <Typography sx={{ fontSize: 12, color: "text.secondary", fontWeight: 600 }}>
                    {item.typeLabel || "모집"}
                </Typography>
                {detailLoading && <CircularProgress size={12} sx={{ ml: 1 }} />}
            </Box>

            {/* ── Hero ─────────────────────────────────────────── */}
            <Box sx={{ maxWidth: 1100, mx: "auto", px: 4, pt: 1, pb: 3 }}>
                {/* Status row */}
                <Stack
                    direction="row"
                    alignItems="center"
                    gap={1}
                    sx={{ mb: 1.75, flexWrap: "wrap" }}
                >
                    {/* 모집중 / 마감됨 — pulse dot */}
                    <Box sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 0.75,
                        px: 1.5,
                        py: 0.625,
                        borderRadius: 99,
                        fontSize: 12,
                        fontWeight: 700,
                        bgcolor: isOpen
                            ? alpha(theme.palette.error.main, 0.10)
                            : alpha(theme.palette.text.primary, 0.05),
                        color: isOpen ? "error.main" : "text.disabled",
                    }}>
                        <Box sx={{
                            width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                            bgcolor: isOpen ? "error.main" : "text.disabled",
                            ...(isOpen ? {
                                "@keyframes recruitPulse": {
                                    "0%, 100%": { boxShadow: `0 0 0 3px ${alpha(theme.palette.error.main, 0.15)}` },
                                    "50%":       { boxShadow: `0 0 0 6px ${alpha(theme.palette.error.main, 0.05)}` },
                                },
                                animation: "recruitPulse 2s ease-in-out infinite",
                            } : {}),
                        }} />
                        {isOpen ? "모집 중" : "마감됨"}
                    </Box>

                    {/* 카테고리 */}
                    <Box sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 0.5,
                        px: 1.25,
                        py: 0.625,
                        borderRadius: 99,
                        fontSize: 11.5,
                        fontWeight: 600,
                        bgcolor: alpha(cat.color, 0.10),
                        color: cat.color,
                    }}>
                        <span>{cat.icon}</span>
                        <span>{item.typeLabel}</span>
                    </Box>

                    {/* 진행 방식 */}
                    <ModeBadge meetType={item.meetType} item={item} />


                    {(item.createdAt || item.updatedAt) && (
                        <Typography sx={{
                            ml: "auto",
                            fontSize: 11.5,
                            color: "text.disabled",
                            fontWeight: 500,
                        }}>
                            업데이트 · {formatTimeAgo(item.updatedAt || item.createdAt)}
                        </Typography>
                    )}
                </Stack>

                {/* 제목 */}
                <Typography component="h1" sx={{
                    fontSize: 32,
                    fontWeight: 700,
                    letterSpacing: "-0.035em",
                    lineHeight: 1.2,
                    color: "text.primary",
                    mb: 1.25,
                    wordBreak: "break-all",
                }}>
                    {item.title}
                </Typography>

                {/* 4-col meta strip */}
                <Box sx={{
                    mt: 2.75,
                    p: "20px 24px",
                    bgcolor: "background.paper",
                    border: 0,
                    borderRadius: 2,
                    boxShadow: SHADOW.card,
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
                }}>
                    {/* 모집 현황 */}
                    <HmsItem label="모집 현황">
                        <Stack direction="row" alignItems="baseline" gap={0.5}>
                            <Typography sx={{
                                fontSize: 22,
                                fontWeight: 700,
                                letterSpacing: "-0.03em",
                                lineHeight: 1.1,
                                color: "text.primary",
                            }}>
                                {curM}
                            </Typography>
                            <Typography sx={{
                                fontSize: 13,
                                color: "text.disabled",
                                fontWeight: 600,
                            }}>
                                / {maxM}명
                            </Typography>
                        </Stack>
                        <Box sx={{
                            mt: 1,
                            height: 4,
                            bgcolor: alpha(theme.palette.text.primary, 0.06),
                            borderRadius: 99,
                            overflow: "hidden",
                        }}>
                            <Box sx={{
                                height: "100%",
                                width: `${memberPct}%`,
                                bgcolor: "primary.main",
                                borderRadius: 99,
                            }} />
                        </Box>
                    </HmsItem>

                    {/* 마감까지 */}
                    <HmsItem label="마감까지" divider>
                        <Typography sx={{
                            fontSize: 22,
                            fontWeight: 700,
                            letterSpacing: "-0.03em",
                            lineHeight: 1.1,
                            color: isUrgent ? "error.main" : "text.primary",
                        }}>
                            {dueText}
                        </Typography>
                        {deadlineStr && (
                            <Typography sx={{
                                fontSize: 11.5,
                                color: "text.disabled",
                                fontWeight: 500,
                                mt: 0.5,
                            }}>
                                {deadlineStr} 마감
                            </Typography>
                        )}
                    </HmsItem>

                    {/* 진행 방식 */}
                    <HmsItem label="진행 방식" divider>
                        <Typography sx={{
                            fontSize: 22,
                            fontWeight: 700,
                            letterSpacing: "-0.03em",
                            lineHeight: 1.1,
                            color: "text.primary",
                        }}>
                            {meetLabel}
                        </Typography>
                        {toolsStr && (
                            <Typography sx={{
                                fontSize: 11.5,
                                color: "text.disabled",
                                fontWeight: 500,
                                mt: 0.5,
                            }}>
                                {toolsStr}
                            </Typography>
                        )}
                    </HmsItem>

                    {/* 주요 위치 */}
                    <HmsItem label="주요 위치" divider>
                        <Typography sx={{
                            fontSize: 22,
                            fontWeight: 700,
                            letterSpacing: "-0.03em",
                            lineHeight: 1.1,
                            color: "text.primary",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        }}>
                            {locationText}
                        </Typography>
                        {item.locationText && item.locationText !== locationText && (
                            <Typography sx={{
                                fontSize: 11.5,
                                color: "text.disabled",
                                fontWeight: 500,
                                mt: 0.5,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                            }}>
                                {item.locationText}
                            </Typography>
                        )}
                    </HmsItem>
                </Box>
            </Box>
        </>
    );
}
