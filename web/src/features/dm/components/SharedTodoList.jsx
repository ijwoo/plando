import React from "react";
import { Box, Typography, Stack } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import { statusColor } from "../../../shared/ui/tone.js";
import { PriorityTag } from "../../../shared/ui/common/Tags.jsx";

/**
 * DM 패널 / 프로필 모달에서 공통으로 쓰는 "함께하는 할 일" 목록
 *
 * @param {{ todos: Array, onTodoClick: (id:number)=>void, compact?: boolean }} props
 *   compact=true  → DmPage 오른쪽 패널 스타일 (폰트 더 작음)
 *   compact=false → DmPartnerProfileModal 스타일 (기본)
 */
export default function SharedTodoList({ todos = [], onTodoClick, compact = false }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const divider = isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.05)";

    if (!todos.length) {
        return (
            <Stack direction="row" alignItems="center" spacing={0.75} sx={{ py: 1, color: "text.disabled" }}>
                <AssignmentOutlinedIcon sx={{ fontSize: 15, flexShrink: 0 }} />
                <Typography sx={{ fontSize: compact ? 11.5 : 12 }}>함께 담당하는 할 일이 없어요</Typography>
            </Stack>
        );
    }

    return (
        <>
            {todos.map((t) => (
                <Box
                    key={t.id}
                    onClick={() => onTodoClick?.(t.id)}
                    sx={{
                        display: "flex", alignItems: "flex-start", gap: 1,
                        py: 0.75,
                        borderBottom: `1px solid ${divider}`,
                        cursor: "pointer", borderRadius: 1,
                        "&:last-child": { borderBottom: "none" },
                        "&:hover": { bgcolor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)" },
                    }}
                >
                    <Box sx={{ pt: "1px", flexShrink: 0, color: statusColor(theme, t.status) }}>
                        {t.status === "DONE"
                            ? <CheckCircleRoundedIcon sx={{ fontSize: compact ? 14 : 15 }} />
                            : <RadioButtonUncheckedRoundedIcon sx={{ fontSize: compact ? 14 : 15 }} />
                        }
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{
                            fontSize: compact ? 11.5 : 12.5,
                            fontWeight: 600,
                            color: "text.primary",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            textDecoration: t.status === "DONE" ? "line-through" : "none",
                            opacity: t.status === "DONE" ? (compact ? 0.5 : 0.55) : 1,
                        }}>
                            {t.title}
                        </Typography>
                        {t.dueDate && (
                            compact ? (
                                <Typography sx={{ fontSize: 10, color: "text.disabled", mt: 0.2 }}>
                                    {t.dueDate}
                                </Typography>
                            ) : (
                                <Stack direction="row" alignItems="center" spacing={0.4} sx={{ mt: 0.25 }}>
                                    <AccessTimeRoundedIcon sx={{ fontSize: 10, color: "text.secondary" }} />
                                    <Typography sx={{ fontSize: 10, color: "text.secondary" }}>{t.dueDate}</Typography>
                                </Stack>
                            )
                        )}
                    </Box>
                    {t.priority && (
                        <PriorityTag
                            priority={t.priority}
                            size="xs"
                            showDot={false}
                            sx={{ fontSize: 9, fontWeight: 800, flexShrink: 0, alignSelf: "center", px: 1, py: "2px" }}
                        />
                    )}
                </Box>
            ))}
        </>
    );
}
