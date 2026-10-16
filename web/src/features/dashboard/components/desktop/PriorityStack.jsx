import React from "react";
import { Box, Stack, Typography } from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import AlternateEmailRoundedIcon from "@mui/icons-material/AlternateEmailRounded";
import InboxRoundedIcon from "@mui/icons-material/InboxRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import { formatDueDate, formatTimeAgo } from "../../utils/dashboardUtils.js";

/**
 * 우선순위 카드 스택 — 3 카테고리:
 *  - 지연 위험 (overdueTasks 실데이터)
 *  - 멘션 (MENTION notifications 실데이터)
 *  - 새 작업 (TASK_ASSIGNED notifications 실데이터)
 *
 * 승인 도메인은 부재로 카드 제거됨.
 */
export default function PriorityStack({
    overdueTasks,
    assignNotifications = [],
    mentionNotifications = [],
    onTaskClick,
}) {
    const theme = useTheme();

    const overdueItem = overdueTasks?.[0];
    const overdueCount = overdueTasks?.length ?? 0;
    const mentionTop = mentionNotifications[0];
    const mentionCount = mentionNotifications.filter((n) => !n.read).length;
    const assignTop = assignNotifications[0];
    const assignCount = assignNotifications.filter((n) => !n.read).length;

    const totalCount = overdueCount + mentionNotifications.length + assignNotifications.length;

    return (
        <Stack spacing={1.25}>
            <Stack direction="row" alignItems="baseline" justifyContent="space-between" sx={{ px: 0.5 }}>
                <Typography sx={{ fontSize: 15, fontWeight: 800, color: "text.primary", letterSpacing: "-0.02em" }}>
                    지금 처리할 것
                </Typography>
                <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: "text.disabled" }}>
                    {totalCount}건
                </Typography>
            </Stack>

            {/* 지연 위험 */}
            {overdueItem ? (
                <PriorityCard
                    Icon={WarningAmberRoundedIcon}
                    color={theme.palette.error.main}
                    kind="지연 위험"
                    count={overdueCount > 1 ? overdueCount : null}
                    title={overdueItem.title || "(제목 없음)"}
                    sub={overdueItem.dueDate ? `${formatDueDate(overdueItem.dueDate)} 마감 · ${overdueItem.status === "IN_PROGRESS" ? "진행 중" : "미시작"}` : ""}
                    onClick={() => onTaskClick?.(overdueItem.id)}
                />
            ) : (
                <PriorityCard
                    Icon={WarningAmberRoundedIcon}
                    color={theme.palette.error.main}
                    kind="지연 위험"
                    title="지연된 할 일 없음"
                    sub="모두 일정 안에 있어요"
                    muted
                />
            )}

            {/* 멘션 */}
            {mentionTop ? (
                <PriorityCard
                    Icon={AlternateEmailRoundedIcon}
                    color={theme.palette.primary.main}
                    kind="멘션"
                    count={mentionCount > 1 ? mentionCount : null}
                    title={mentionTop.title || "댓글에서 멘션됨"}
                    sub={`${mentionTop.senderName ? mentionTop.senderName + " · " : ""}${mentionTop.createdAt ? formatTimeAgo(mentionTop.createdAt) : ""}`}
                    onClick={() => mentionTop.targetId && onTaskClick?.(mentionTop.targetId)}
                />
            ) : (
                <PriorityCard
                    Icon={AlternateEmailRoundedIcon}
                    color={theme.palette.primary.main}
                    kind="멘션"
                    title="새 멘션 없음"
                    sub="댓글에서 @멘션되면 여기 표시돼요"
                    muted
                />
            )}

            {/* 새 작업 */}
            {assignTop ? (
                <PriorityCard
                    Icon={InboxRoundedIcon}
                    color="#7C3AED"
                    kind="새 작업"
                    count={assignCount > 1 ? assignCount : null}
                    title={assignTop.title || "새 할 일 할당"}
                    sub={`${assignTop.senderName ? assignTop.senderName + "님 · " : ""}${assignTop.createdAt ? formatTimeAgo(assignTop.createdAt) : ""}`}
                    onClick={() => assignTop.targetId && onTaskClick?.(assignTop.targetId)}
                />
            ) : (
                <PriorityCard
                    Icon={InboxRoundedIcon}
                    color="#7C3AED"
                    kind="새 작업"
                    title="새 할당 없음"
                    sub="누군가 할 일을 맡기면 여기 표시돼요"
                    muted
                />
            )}
        </Stack>
    );
}

function PriorityCard(props) {
    const { color, kind, title, sub, count, muted, onClick } = props;
    const IconComp = props.Icon;
    const theme = useTheme();
    return (
        <Box
            onClick={onClick}
            sx={{
                bgcolor: "background.paper",
                borderRadius: "var(--plando-radius-card)",
                boxShadow: "var(--plando-elev-1)",
                px: 2,
                py: 1.75,
                display: "flex",
                alignItems: "center",
                gap: 1.75,
                cursor: onClick ? "pointer" : "default",
                opacity: muted ? 0.6 : 1,
                transition: "transform var(--plando-dur-fast) var(--plando-ease), box-shadow var(--plando-dur-fast) var(--plando-ease)",
                ...(onClick && {
                    "&:hover": {
                        boxShadow: "var(--plando-shadow-2)",
                    },
                }),
            }}
        >
            <Box
                sx={{
                    position: "relative",
                    width: 42,
                    height: 42,
                    borderRadius: "var(--plando-radius-md)",
                    bgcolor: alpha(color, theme.palette.mode === "dark" ? 0.18 : 0.10),
                    color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                }}
            >
                <IconComp sx={{ fontSize: 22 }} />
                {count && (
                    <Box
                        sx={{
                            position: "absolute",
                            top: -4,
                            right: -4,
                            minWidth: 18,
                            height: 18,
                            px: 0.5,
                            borderRadius: 999,
                            bgcolor: color,
                            color: "#fff",
                            fontSize: 10.5,
                            fontWeight: 800,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 0 0 2px var(--plando-surface)",
                        }}
                    >
                        {count}
                    </Box>
                )}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                    sx={{
                        fontSize: 10.5,
                        fontWeight: 800,
                        color,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        mb: 0.25,
                    }}
                >
                    {kind}
                </Typography>
                <Typography
                    sx={{
                        fontSize: 13.5,
                        fontWeight: 800,
                        color: "text.primary",
                        letterSpacing: "-0.02em",
                        lineHeight: 1.3,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                >
                    {title}
                </Typography>
                <Typography
                    sx={{
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: "text.disabled",
                        letterSpacing: "-0.01em",
                        mt: 0.25,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                >
                    {sub}
                </Typography>
            </Box>
            {onClick && (
                <ChevronRightRoundedIcon sx={{ color: "text.disabled", flexShrink: 0, fontSize: 18 }} />
            )}
        </Box>
    );
}
