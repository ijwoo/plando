import React from "react";
import { Box, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { STACK_COLORS } from "../../../constants/recruitmentConfig";
import { detailCardSx, SectionEyebrow } from "./detailHelpers";
import EmptyState from "../../../../../shared/ui/common/EmptyState.jsx";

/**
 * DetailRoles — 모집 역할 카드 (좌측 accent bar) + 기술 스택 chips
 */
export default function DetailRoles({ item, stacks }) {
    const theme = useTheme();

    return (
        <Box sx={detailCardSx}>
            <SectionEyebrow
                eyebrow="Roles & Stack"
                title="모집 역할과 기술 스택"
                hint={item.roles?.length > 0 ? `총 ${item.roles.length}개 역할 모집` : null}
            />

            {/* 역할이 없으면 제목 카드만 본문 없이 남아 있었다(모바일은 섹션 자체를 숨김) */}
            {(item.roles || []).length === 0 && (
                <EmptyState
                    emoji="🧑‍💻"
                    title="등록된 모집 역할이 없어요"
                    desc="작성자가 아직 역할을 정하지 않았어요."
                    size="sm"
                />
            )}

            {/* 역할 카드 — Toss role-card 톤 (4px primary accent bar) */}
            {(item.roles || []).map((role, idx) => {
                const roleName = typeof role === "string" ? role : role.name;
                const roleDesc = role.description || null;
                const roleCount = role.count ?? null;
                const accepted = role.acceptedCount ?? 0;
                const isFull = roleCount != null && accepted >= roleCount;
                return (
                    <Box key={role.id || idx} sx={{
                        position: "relative",
                        bgcolor: isFull
                            ? alpha(theme.palette.text.primary, 0.03)
                            : alpha(theme.palette.primary.main, 0.04),
                        border: 0,
                        borderRadius: 1.5,
                        p: "20px 22px",
                        mb: 1.5,
                        overflow: "hidden",
                        "&::before": {
                            content: '""',
                            position: "absolute",
                            left: 0, top: 0, bottom: 0,
                            width: 4,
                            bgcolor: isFull ? alpha(theme.palette.text.primary, 0.15) : "primary.main",
                        },
                        "&:last-child": { mb: 0 },
                    }}>
                        <Stack
                            direction="row"
                            alignItems="center"
                            justifyContent="space-between"
                            sx={{ mb: roleDesc ? 1 : 0 }}
                        >
                            <Stack direction="row" alignItems="center" gap={0.75}>
                                <Typography sx={{
                                    fontSize: 15.5,
                                    fontWeight: 700,
                                    letterSpacing: "-0.02em",
                                    color: isFull ? "text.disabled" : "text.primary",
                                }}>
                                    {roleName}
                                </Typography>
                                {isFull && (
                                    <Box sx={{
                                        fontSize: 10.5,
                                        fontWeight: 700,
                                        px: 0.75,
                                        py: 0.125,
                                        borderRadius: 0.75,
                                        bgcolor: alpha(theme.palette.text.primary, 0.08),
                                        color: "text.disabled",
                                    }}>
                                        모집 완료
                                    </Box>
                                )}
                            </Stack>
                            {roleCount != null && (
                                <Box sx={{
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                    px: 1,
                                    py: 0.375,
                                    borderRadius: 99,
                                    bgcolor: "background.paper",
                                    color: isFull ? "text.disabled" : "primary.main",
                                }}>
                                    {accepted}/{roleCount}명
                                </Box>
                            )}
                        </Stack>
                        {roleDesc && (
                            <Typography sx={{
                                fontSize: 13.5,
                                color: "text.secondary",
                                lineHeight: 1.6,
                                fontWeight: 500,
                                whiteSpace: "pre-wrap",
                            }}>
                                {roleDesc}
                            </Typography>
                        )}
                    </Box>
                );
            })}

            {/* 기술 스택 */}
            {stacks.length > 0 && (
                <Box sx={{ mt: 2.25 }}>
                    <Typography sx={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: "text.disabled",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        mb: 1.25,
                    }}>
                        기술 스택
                    </Typography>
                    <Stack direction="row" flexWrap="wrap" gap={0.875}>
                        {stacks.map((s) => {
                            const color = STACK_COLORS[s];
                            return (
                                <Box key={s} sx={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 0.625,
                                    px: 1.5,
                                    py: 0.75,
                                    bgcolor: color
                                        ? alpha(color, 0.10)
                                        : alpha(theme.palette.text.primary, 0.05),
                                    border: 0,
                                    borderRadius: 0.875,
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: color || "text.secondary",
                                    letterSpacing: "-0.005em",
                                }}>
                                    {color && (
                                        <Box sx={{
                                            width: 6, height: 6,
                                            borderRadius: "50%",
                                            bgcolor: color,
                                            flexShrink: 0,
                                        }} />
                                    )}
                                    {s}
                                </Box>
                            );
                        })}
                    </Stack>
                </Box>
            )}
        </Box>
    );
}
