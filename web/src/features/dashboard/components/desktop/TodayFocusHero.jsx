import React, { useEffect, useState } from "react";
import { Avatar, Box, Stack, Typography } from "@mui/material";
import HeaderActionButton from "../../../../shared/ui/common/HeaderActionButton.jsx";
import { useTheme, alpha } from "@mui/material/styles";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import { fetchComments } from "../../../todo/api/commentApi.js";
import { resolveAssigneeList } from "../../../../shared/utils/assigneeUtils.js";
import { resolveImageUrl } from "../../../../shared/utils/urlUtils.js";
import { getAvatarTone } from "../../../../shared/utils/avatarUtils.js";
import { PriorityPill } from "../../../../shared/ui/common/Chips.jsx";
import { formatDueDate, formatTimeAgo } from "../../utils/dashboardUtils.js";
import { stripMarkdown } from "../../../../shared/utils/markdownUtils.jsx";

/**
 * 포커스 task hero. focused === true && !DONE && !archived 인 task 중 첫 번째.
 * 0개면 EmptyHero 렌더.
 */
export default function TodayFocusHero({ task, onOpenDetail, onAddTask }) {
    if (!task) return <EmptyHero onAddTask={onAddTask} />;
    return <FocusedHero task={task} onOpenDetail={onOpenDetail} />;
}

function FocusedHero({ task, onOpenDetail }) {
    const theme = useTheme();
    const [latestComment, setLatestComment] = useState(null);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const { data } = await fetchComments(task.id);
                if (!mounted) return;
                const arr = Array.isArray(data) ? data : [];
                setLatestComment(arr.length > 0 ? arr[arr.length - 1] : null);
            } catch { /* ignore */ }
        })();
        return () => { mounted = false; };
    }, [task.id]);

    const participants = resolveAssigneeList(task);
    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date(new Date().toDateString());

    // 진행률 = 서브태스크(체크리스트 폐지 후 유일한 진행 단위). 서브태스크가 없으면 막대 자체를 안 그린다.
    const subtaskTotal = Math.max(0, Number(task.subtaskTotal) || 0);
    const subtaskDone = Math.min(Math.max(0, Number(task.subtaskDone) || 0), subtaskTotal);
    const hasSubtasks = subtaskTotal > 0;
    const subtaskPct = hasSubtasks ? Math.round((subtaskDone / subtaskTotal) * 100) : 0;
    const allSubtasksDone = hasSubtasks && subtaskDone === subtaskTotal;

    return (
        <Box
            sx={{
                // 히어로는 항상 대시보드 카드(CardShell) 안에 들어간다 —
                // 자체 배경/그림자/패딩을 두면 "카드 속 카드"가 되므로 표면은 바깥 카드에 맡긴다.
                position: "relative",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                gap: 2,
            }}
        >

            {/* 카드 헤더가 이미 "오늘의 포커스"를 달고 있어 라벨은 생략하고 ⚡ 표식만 남긴다 */}
            <Stack direction="row" alignItems="center" spacing={1}>
                <Box
                    sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 22,
                        height: 22,
                        borderRadius: 999,
                        bgcolor: "var(--plando-primary-soft)",
                        color: "primary.main",
                    }}
                    aria-label="포커스 표시"
                >
                    <BoltRoundedIcon sx={{ fontSize: 13 }} />
                </Box>
                {isOverdue && (
                    <Box
                        sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            px: 1.25,
                            py: 0.375,
                            borderRadius: 999,
                            bgcolor: alpha(theme.palette.error.main, 0.10),
                            color: "error.main",
                            fontSize: 11.5,
                            fontWeight: 800,
                            letterSpacing: "-0.01em",
                        }}
                    >
                        지연됨
                    </Box>
                )}
                <PriorityPill priority={task.priority} />
                <Box sx={{ flex: 1 }} />
                {task.dueDate && (
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: "text.disabled" }}>
                        {formatDueDate(task.dueDate)} 마감
                    </Typography>
                )}
            </Stack>

            <Stack direction="row" alignItems="flex-start" spacing={2}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                        sx={{
                            fontSize: 22,
                            fontWeight: 800,
                            letterSpacing: "-0.025em",
                            lineHeight: 1.3,
                            color: "text.primary",
                            mb: 0.5,
                            wordBreak: "keep-all",
                        }}
                    >
                        {task.title || "(제목 없음)"}
                    </Typography>
                    {task.content && (
                        <Typography
                            sx={{
                                fontSize: 13,
                                fontWeight: 500,
                                color: "text.secondary",
                                lineHeight: 1.55,
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                            }}
                        >
                            {stripMarkdown(task.content)}
                        </Typography>
                    )}
                </Box>
            </Stack>

            {hasSubtasks && (
                <Box>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.75 }}>
                        <Typography sx={{ fontSize: 11.5, fontWeight: 800, color: "text.disabled", letterSpacing: "-0.01em" }}>
                            서브태스크 {subtaskDone}/{subtaskTotal}
                        </Typography>
                        <Box sx={{ flex: 1 }} />
                        <Typography sx={{ fontSize: 11.5, fontWeight: 800, letterSpacing: "-0.01em", color: allSubtasksDone ? "success.main" : "primary.main" }}>
                            {allSubtasksDone ? "모두 끝냈어요" : `${subtaskPct}%`}
                        </Typography>
                    </Stack>
                    <Box
                        role="progressbar"
                        aria-valuenow={subtaskPct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label="서브태스크 진행률"
                        sx={{
                            height: 6,
                            borderRadius: "var(--plando-radius-pill)",
                            bgcolor: alpha(theme.palette.text.primary, 0.08),
                            overflow: "hidden",
                        }}
                    >
                        <Box
                            sx={{
                                width: `${subtaskPct}%`,
                                height: "100%",
                                borderRadius: "var(--plando-radius-pill)",
                                bgcolor: allSubtasksDone ? "success.main" : "primary.main",
                                transition: "width 0.35s ease",
                            }}
                        />
                    </Box>
                </Box>
            )}

            {latestComment && <LatestCommentMini comment={latestComment} />}

            <Stack direction="row" alignItems="center" spacing={1.25}>
                {participants.length > 0 && (
                    <Stack direction="row" sx={{ flexShrink: 0 }}>
                        {participants.slice(0, 3).map((p, i) => {
                            const name = typeof p === "string" ? p : (p?.name || p?.email || "");
                            const src = typeof p === "object" && p?.profileImageUrl ? resolveImageUrl(p.profileImageUrl) : undefined;
                            const tone = getAvatarTone(name);
                            return (
                                <Avatar
                                    key={i}
                                    src={src}
                                    sx={{
                                        width: 26, height: 26,
                                        fontSize: 11, fontWeight: 800,
                                        marginLeft: i === 0 ? 0 : "-8px",
                                        border: "2px solid",
                                        borderColor: "background.paper",
                                        bgcolor: tone.bg,
                                        color: tone.color,
                                    }}
                                >
                                    {name?.charAt?.(0)}
                                </Avatar>
                            );
                        })}
                    </Stack>
                )}
                {participants.length > 0 && (
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: "text.disabled" }}>
                        {participants.length}명 참여
                    </Typography>
                )}
                <Box sx={{ flex: 1 }} />
                <Stack
                    direction="row"
                    alignItems="center"
                    spacing={0.375}
                    onClick={() => onOpenDetail?.(task.id)}
                    sx={{
                        color: "primary.main",
                        fontSize: 12.5,
                        fontWeight: 800,
                        letterSpacing: "-0.01em",
                        cursor: "pointer",
                        userSelect: "none",
                        "&:hover": { textDecoration: "underline" },
                    }}
                >
                    자세히
                    <ArrowForwardRoundedIcon sx={{ fontSize: 13 }} />
                </Stack>
            </Stack>
        </Box>
    );
}

function LatestCommentMini({ comment }) {
    const tone = getAvatarTone(comment.writerName || comment.writerEmail || "");
    return (
        <Stack
            direction="row"
            spacing={1.5}
            sx={{
                p: 1.75,
                borderRadius: "var(--plando-radius-md)",
                bgcolor: "var(--plando-surface-alt)",
            }}
        >
            <Avatar
                sx={{
                    width: 32, height: 32, fontSize: 12, fontWeight: 800,
                    bgcolor: tone.bg, color: tone.color, flexShrink: 0,
                }}
            >
                {(comment.writerName || comment.writerEmail || "?").charAt(0)}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.25 }}>
                    <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: "text.primary", letterSpacing: "-0.01em" }}>
                        {comment.writerName || comment.writerEmail || "익명"}
                    </Typography>
                    <Typography sx={{ fontSize: 11, fontWeight: 700, color: "text.disabled" }}>
                        · {comment.createdAt ? formatTimeAgo(comment.createdAt) : "방금"} 댓글
                    </Typography>
                </Stack>
                <Typography
                    sx={{
                        fontSize: 12.5,
                        fontWeight: 500,
                        color: "text.secondary",
                        letterSpacing: "-0.01em",
                        lineHeight: 1.45,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        // @mention 강조용 — 텍스트 내 @패턴은 별도 처리하지 않음 (단순 표시)
                    }}
                >
                    {comment.content}
                </Typography>
            </Box>
        </Stack>
    );
}

function EmptyHero({ onAddTask }) {
    return (
        <Box
            sx={{
                // 빈 상태만 점선 테두리로 "여기 채우면 돼요"를 알린다 (배경/그림자는 바깥 카드 것)
                height: "100%",
                borderRadius: "var(--plando-radius-md)",
                border: "1px dashed",
                borderColor: "divider",
                p: 3,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 1.5,
                minHeight: 200,
            }}
        >
            <Box
                sx={{
                    width: 52,
                    height: 52,
                    borderRadius: "var(--plando-radius-md)",
                    bgcolor: "var(--plando-primary-soft)",
                    color: "primary.main",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <BoltRoundedIcon sx={{ fontSize: 28 }} />
            </Box>
            <Typography sx={{ fontSize: 16, fontWeight: 800, color: "text.primary", letterSpacing: "-0.02em" }}>
                오늘의 포커스가 비어 있어요
            </Typography>
            <Typography sx={{ fontSize: 12.5, fontWeight: 500, color: "text.secondary", textAlign: "center", maxWidth: 320 }}>
                할 일 상세에서 ⚡ 버튼으로 가장 중요한 일을 포커스로 표시하면 여기 크게 보입니다.
            </Typography>
            {onAddTask && (
                <HeaderActionButton variant="ghost" onClick={onAddTask} sx={{ mt: 0.5 }}>
                    새 할 일 만들기
                </HeaderActionButton>
            )}
        </Box>
    );
}

