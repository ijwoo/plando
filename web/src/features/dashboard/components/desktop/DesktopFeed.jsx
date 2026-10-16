import React, { useState } from "react";
import { Avatar, Box, Stack, Typography } from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import AlternateEmailRoundedIcon from "@mui/icons-material/AlternateEmailRounded";
import InboxRoundedIcon from "@mui/icons-material/InboxRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import EventAvailableRoundedIcon from "@mui/icons-material/EventAvailableRounded";
import { resolveImageUrl } from "../../../../shared/utils/urlUtils.js";
import { filterActivities, formatTimeAgo, formatModifierName } from "../../utils/dashboardUtils.js";

/**
 * 활동 피드 — kind 분류 뱃지 추가 버전.
 * recentActivity (실데이터) + mentionNotifications (실데이터)를 시간순으로 머지.
 */
const TABS = [
    { key: "all", label: "전체" },
    { key: "mention", label: "내 멘션" },
    { key: "unread", label: "읽지 않음" },
];

export default function DesktopFeed({ recentActivity, mentionNotifications = [], userImageMap = {}, onTaskClick }) {
    const theme = useTheme();
    const [tab, setTab] = useState("all");

    const activityItems = filterActivities(recentActivity).slice(0, 10).map((a) => ({
        kind: fieldToKind(a),
        modifier: a.modifier,
        modifierName: a.modifierName,
        target: a.todoTitle || `#${a.todoId}`,
        text: fieldToText(a),
        when: a.modifiedAt ? formatTimeAgo(a.modifiedAt) : "",
        sortAt: a.modifiedAt ? new Date(a.modifiedAt).getTime() : 0,
        todoId: a.todoId,
        unread: false,
    }));

    const mentionItems = mentionNotifications.slice(0, 10).map((n) => ({
        kind: "mention",
        modifier: n.senderEmail,
        modifierName: n.senderName,
        target: n.title?.replace(/^.*님이 댓글에서 회원님을 멘션했어요$/, "댓글 멘션") || "댓글 멘션",
        text: n.message || "",
        when: n.createdAt ? formatTimeAgo(n.createdAt) : "",
        sortAt: n.createdAt ? new Date(n.createdAt).getTime() : 0,
        todoId: n.targetId,
        unread: !n.read,
    }));

    const baseItems = [...activityItems, ...mentionItems]
        .sort((a, b) => b.sortAt - a.sortAt)
        .slice(0, 12);

    const items = tab === "mention"
        ? baseItems.filter((i) => i.kind === "mention")
        : tab === "unread"
            ? baseItems.filter((i) => i.unread)
            : baseItems;

    return (
        <Box
            sx={{
                bgcolor: "background.paper",
                borderRadius: "var(--plando-radius-card)",
                boxShadow: "var(--plando-elev-1)",
                p: 2.5,
            }}
        >
            <Stack direction="row" alignItems="baseline" justifyContent="space-between" sx={{ mb: 1.5 }}>
                <Typography sx={{ fontSize: 15, fontWeight: 800, color: "text.primary", letterSpacing: "-0.02em" }}>
                    활동 피드
                </Typography>
                <Stack direction="row" spacing={0.375} sx={{ p: 0.375, bgcolor: "var(--plando-surface-low)", borderRadius: "var(--plando-radius-sm)" }}>
                    {TABS.map((t) => (
                        <Box
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            sx={{
                                height: 24,
                                px: 1.25,
                                display: "inline-flex",
                                alignItems: "center",
                                borderRadius: 6,
                                bgcolor: tab === t.key ? "background.paper" : "transparent",
                                color: tab === t.key ? "text.primary" : "text.disabled",
                                fontSize: 11,
                                fontWeight: 800,
                                letterSpacing: "-0.01em",
                                cursor: "pointer",
                                boxShadow: tab === t.key ? "var(--plando-shadow-1)" : "none",
                                transition: "background var(--plando-dur-fast) var(--plando-ease)",
                            }}
                        >
                            {t.label}
                        </Box>
                    ))}
                </Stack>
            </Stack>

            {items.length === 0 ? (
                <Box sx={{ py: 3, textAlign: "center", color: "text.disabled", fontSize: 13, fontWeight: 600 }}>
                    표시할 활동이 없어요
                </Box>
            ) : (
                <Stack>
                    {items.map((it, i) => {
                        const meta = KIND_META(theme)[it.kind] || KIND_META(theme).update;
                        const name = userImageMap?.[it.modifier]?.name || it.modifierName || formatModifierName(it.modifier);
                        const avatarSrc = userImageMap?.[it.modifier]?.profileImageUrl
                            ? resolveImageUrl(userImageMap[it.modifier].profileImageUrl)
                            : undefined;
                        return (
                            <Stack
                                key={i}
                                direction="row"
                                spacing={1.5}
                                sx={{
                                    py: 1.25,
                                    borderTop: i > 0 ? "1px solid" : "none",
                                    borderColor: "divider",
                                    cursor: it.todoId ? "pointer" : "default",
                                    "&:hover": it.todoId ? { bgcolor: "var(--plando-surface-faint)" } : undefined,
                                    transition: "background var(--plando-dur-fast) var(--plando-ease)",
                                    mx: -1,
                                    px: 1,
                                    borderRadius: "var(--plando-radius-sm)",
                                }}
                                onClick={() => it.todoId && onTaskClick?.(it.todoId)}
                            >
                                <Box sx={{ position: "relative", flexShrink: 0 }}>
                                    <Avatar
                                        src={avatarSrc}
                                        sx={{
                                            width: 32, height: 32, fontSize: 12, fontWeight: 800,
                                            bgcolor: alpha(meta.color, 0.18),
                                            color: meta.color,
                                        }}
                                    >
                                        {name?.charAt?.(0)}
                                    </Avatar>
                                    <Box
                                        sx={{
                                            position: "absolute",
                                            bottom: -2,
                                            right: -2,
                                            width: 18,
                                            height: 18,
                                            borderRadius: 999,
                                            bgcolor: "background.paper",
                                            color: meta.color,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            boxShadow: "0 1px 3px rgba(0,0,0,0.10)",
                                        }}
                                    >
                                        <meta.Icon sx={{ fontSize: 10 }} />
                                    </Box>
                                </Box>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.25 }}>
                                        <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: "text.primary", letterSpacing: "-0.01em" }}>
                                            {name}
                                        </Typography>
                                        <Box
                                            sx={{
                                                px: 0.75,
                                                py: 0.125,
                                                borderRadius: 999,
                                                bgcolor: alpha(meta.color, 0.10),
                                                color: meta.color,
                                                fontSize: 10,
                                                fontWeight: 800,
                                                letterSpacing: "-0.01em",
                                            }}
                                        >
                                            {meta.label}
                                        </Box>
                                        <Typography sx={{ fontSize: 11, fontWeight: 700, color: "text.disabled" }}>
                                            {it.when}
                                        </Typography>
                                    </Stack>
                                    <Typography
                                        sx={{
                                            fontSize: 12.5,
                                            fontWeight: 600,
                                            color: "text.secondary",
                                            letterSpacing: "-0.01em",
                                            lineHeight: 1.4,
                                            overflow: "hidden",
                                            display: "-webkit-box",
                                            WebkitLineClamp: 1,
                                            WebkitBoxOrient: "vertical",
                                        }}
                                    >
                                        <Box component="span" sx={{ fontWeight: 800, color: "text.primary" }}>{it.target}</Box> · {it.text}
                                    </Typography>
                                </Box>
                            </Stack>
                        );
                    })}
                </Stack>
            )}
        </Box>
    );
}

function fieldToKind(a) {
    if (a.field === "status" && (a.newValue === "DONE" || a.newValue === "done")) return "complete";
    if (a.field === "assignees" || a.field === "assignee") return "assign";
    if (a.field === "dueDate" || a.field === "startAt") return "schedule";
    if (a.field === "priority") return "priority";
    return "update";
}

function fieldToText(a) {
    if (!a.field) return "활동";
    if (a.field === "status") {
        const status = labelStatus(a.afterValue);
        const particle = status === "진행 중" ? "으로" : "로";

        return `상태를 ${status}${particle} 변경`;
    }    if (a.field === "assignees" || a.field === "assignee") return "담당자 변경";
    if (a.field === "dueDate") return "마감일 수정";
    if (a.field === "startAt") return "시작일 수정";
    if (a.field === "priority") return "우선순위 변경";
    if (a.field === "title") return "제목 수정";
    return `${a.field} 수정`;
}

function labelStatus(v) {
    if (v === "DONE") return "완료";
    if (v === "IN_PROGRESS") return "진행 중";
    if (v === "TODO") return "할 일";
    return v || "";
}

function KIND_META(theme) {
    return {
        complete: { label: "완료", color: theme.palette.success.main, Icon: CheckRoundedIcon },
        assign: { label: "할당", color: theme.palette.warning.main, Icon: InboxRoundedIcon },
        schedule: { label: "일정", color: theme.palette.primary.main, Icon: EventAvailableRoundedIcon },
        priority: { label: "우선순위", color: theme.palette.error.main, Icon: FlagRoundedIcon },
        mention: { label: "멘션", color: "#7C3AED", Icon: AlternateEmailRoundedIcon },
        update: { label: "변경", color: theme.palette.primary.main, Icon: ChatBubbleOutlineRoundedIcon },
    };
}
