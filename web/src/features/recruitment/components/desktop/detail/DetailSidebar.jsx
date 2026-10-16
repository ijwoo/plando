import React from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import MessageRoundedIcon from "@mui/icons-material/MessageRounded";
import { sideCardSx, SHADOW } from "../../common/recruitmentSx";
import { SidebarEyebrow } from "./detailHelpers";
import useUserQaStats, { formatLatencyKor } from "../../../hooks/useUserQaStats";
import { getDueText } from "../../../utils/recruitmentUtils";
import { MEET_TYPE_CFG, inferMeetType } from "../../../constants/recruitmentConfig";

/**
 * DetailSidebar — 작성자 카드 + 프로젝트 메타 + 비슷한 프로젝트
 */
export default function DetailSidebar({
    item,
    authorName,
    authorInitial,
    toolsStr,
    deadlineStr,
    relatedProjects,
    onOpenProject,
    onAskQuestion,
}) {
    const theme = useTheme();

    // 작성자 Q&A 응답 통계 — totalQuestionCount > 0일 때만 stats 반환
    const { stats: authorQaStats } = useUserQaStats(item.leaderId);

    return (
        <Box sx={{ position: "sticky", top: 20, alignSelf: "start" }}>

            {/* ── 작성자 카드 ─────────────────────────────── */}
            <Box sx={{ ...sideCardSx(), p: 2.5, mb: 1.5 }}>
                <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 2 }}>
                    <Box sx={{
                        width: 48, height: 48,
                        borderRadius: "50%",
                        flexShrink: 0,
                        bgcolor: "#FF8A65",
                        display: "grid",
                        placeItems: "center",
                        color: "common.white",
                        fontWeight: 700,
                        fontSize: 18,
                        overflow: "hidden",
                    }}>
                        {authorInitial}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{
                            fontSize: 15.5,
                            fontWeight: 700,
                            letterSpacing: "-0.02em",
                            color: "text.primary",
                            mb: 0.25,
                        }}>
                            {authorName}
                        </Typography>
                        <Typography sx={{
                            fontSize: 11.5,
                            color: "text.disabled",
                            fontWeight: 500,
                        }}>
                            {item.leader?.role || item.leaderRole || "프로젝트 작성자 · 리더"}
                        </Typography>
                    </Box>
                </Stack>

                {/* 작성자 Q&A 응답 신뢰도 — totalQuestionCount > 0일 때만 (Phase 5) */}
                {authorQaStats && (
                    <Typography sx={{
                        mb: 1.5,
                        fontSize: 11.5,
                        fontWeight: 500,
                        color: "text.secondary",
                        letterSpacing: "-0.005em",
                    }}>
                        Q&amp;A 응답 · 평균 {formatLatencyKor(authorQaStats.avgAnswerLatencyMinutes) ?? "-"}
                        {" · "}응답률 {authorQaStats.answerRate ?? "-"}%
                        {" · "}응답 {authorQaStats.answeredCount}건
                    </Typography>
                )}

                {/* 작성자 stats — TODO: 실제 작성자 통계 API 연동 후 노출 (프로젝트 수 / 함께한 팀원 수 / 평점)
                <Box sx={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    borderTop: "1px solid",
                    borderBottom: "1px solid",
                    borderColor: alpha(theme.palette.text.primary, 0.06),
                    py: 1.5,
                    mb: 1.75,
                }}>
                    {[
                        { num: "-", lbl: "프로젝트" },
                        { num: "-", lbl: "함께한 팀원" },
                        { num: "-", lbl: "평점" },
                    ].map(({ num, lbl }, idx) => (
                        <Box key={lbl} sx={{
                            textAlign: "center",
                            position: "relative",
                            ...(idx > 0 ? {
                                "&::before": {
                                    content: '""',
                                    position: "absolute",
                                    left: 0, top: 2, bottom: 2,
                                    width: 1,
                                    bgcolor: alpha(theme.palette.text.primary, 0.06),
                                },
                            } : {}),
                        }}>
                            <Typography sx={{
                                fontSize: 17,
                                fontWeight: 700,
                                letterSpacing: "-0.02em",
                                color: "text.primary",
                            }}>
                                {num}
                            </Typography>
                            <Typography sx={{
                                fontSize: 10.5,
                                color: "text.disabled",
                                fontWeight: 600,
                                mt: 0.25,
                            }}>
                                {lbl}
                            </Typography>
                        </Box>
                    ))}
                </Box>
                */}

                {/* 작성자에게 비공개 질문하기 — Q&A 탭으로 이동 + 비공개 자동 ON */}
                {!item.isAuthor && (
                    <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<MessageRoundedIcon sx={{ fontSize: 14 }} />}
                        onClick={onAskQuestion}
                        sx={{
                            py: 1.375,
                            borderRadius: 1.25,
                            bgcolor: alpha(theme.palette.text.primary, 0.04),
                            borderColor: "transparent",
                            color: "text.secondary",
                            fontSize: 13,
                            fontWeight: 700,
                            textTransform: "none",
                            boxShadow: "none",
                            "&:hover": {
                                bgcolor: alpha(theme.palette.text.primary, 0.07),
                                borderColor: "transparent",
                                color: "text.primary",
                            },
                        }}
                    >
                        작성자에게 비공개 질문하기
                    </Button>
                )}
            </Box>

            {/* ── 프로젝트 메타 ─────────────────────────────── */}
            <Box sx={{ ...sideCardSx(), p: 2.5, mb: 1.5 }}>
                <SidebarEyebrow>프로젝트 정보</SidebarEyebrow>
                {[
                    { k: "진행 주기", v: item.frequency || "-" },
                    { k: "예상 기간", v: item.duration  || "-" },
                    { k: "협업 도구", v: toolsStr       || "-" },
                    { k: "마감일",   v: deadlineStr     || (item.deadline ? String(item.deadline).slice(0, 10) : "-") },
                ].map(({ k, v }, idx) => (
                    <Box key={k} sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        py: 1.125,
                        ...(idx > 0 ? {
                            borderTop: "1px solid",
                            borderColor: alpha(theme.palette.text.primary, 0.06),
                        } : {}),
                    }}>
                        <Typography sx={{
                            fontSize: 12,
                            color: "text.disabled",
                            fontWeight: 600,
                        }}>
                            {k}
                        </Typography>
                        <Typography sx={{
                            fontSize: 13,
                            color: v === "-" ? "text.disabled" : "text.primary",
                            fontWeight: 700,
                            letterSpacing: "-0.01em",
                        }}>
                            {v}
                        </Typography>
                    </Box>
                ))}
            </Box>

            {/* ── 비슷한 프로젝트 ───────────────────────────── */}
            <Box sx={{ ...sideCardSx(), p: 2.5, mb: 0 }}>
                <SidebarEyebrow>비슷한 프로젝트</SidebarEyebrow>

                {relatedProjects.length === 0 ? (
                    <Typography sx={{
                        fontSize: 13,
                        color: "text.disabled",
                        textAlign: "center",
                        py: 2,
                    }}>
                        비슷한 프로젝트가 없어요
                    </Typography>
                ) : relatedProjects.map((p, idx) => (
                    <Box
                        key={p.id}
                        onClick={() => onOpenProject?.(p)}
                        sx={{
                            py: 1.5,
                            mx: -1.25,
                            px: 1.25,
                            borderRadius: 0.875,
                            cursor: "pointer",
                            ...(idx > 0 ? {
                                borderTop: "1px solid",
                                borderColor: alpha(theme.palette.text.primary, 0.06),
                            } : {}),
                            "&:hover": {
                                bgcolor: alpha(theme.palette.text.primary, 0.03),
                            },
                        }}
                    >
                        <Typography sx={{
                            fontSize: 13.5,
                            fontWeight: 700,
                            letterSpacing: "-0.015em",
                            color: "text.primary",
                            lineHeight: 1.4,
                            mb: 0.75,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                        }}>
                            {p.title}
                        </Typography>
                        <Stack direction="row" gap={1} sx={{
                            fontSize: 10.5,
                            color: "text.disabled",
                            fontWeight: 500,
                        }}>
                            <span>👥 {p.members || "-"}</span>
                            <span>📅 {getDueText(p)}</span>
                            <span>{MEET_TYPE_CFG[inferMeetType(p)].icon} {MEET_TYPE_CFG[inferMeetType(p)].label}</span>
                        </Stack>
                        {(p.tags || p.techStacks || []).slice(0, 4).length > 0 && (
                            <Stack direction="row" gap={0.5} sx={{ mt: 0.75 }} flexWrap="wrap">
                                {(p.tags || p.techStacks || []).slice(0, 4).map((s) => (
                                    <Box key={s} sx={{
                                        px: 0.875,
                                        py: 0.125,
                                        bgcolor: alpha(theme.palette.text.primary, 0.05),
                                        borderRadius: 0.5,
                                        fontSize: 9.5,
                                        fontWeight: 600,
                                        color: "text.secondary",
                                    }}>
                                        {s}
                                    </Box>
                                ))}
                            </Stack>
                        )}
                    </Box>
                ))}
            </Box>
        </Box>
    );
}
