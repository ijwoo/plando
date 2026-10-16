import React from "react";
import { Box, IconButton, Stack, Typography } from "@mui/material";
import EventRoundedIcon from "@mui/icons-material/EventRounded";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import RepeatRoundedIcon from "@mui/icons-material/RepeatRounded";
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import AssigneeStack from "../../../../../shared/ui/common/AssigneeStack.jsx";
import { resolveAssigneeList } from "../../../../../shared/utils/assigneeUtils.js";
import { formatAbsoluteDue } from "../../../../../shared/utils/formatters.js";
import { stripMarkdown } from "../../../../../shared/utils/markdownUtils.jsx";
import { useProjectPill } from "../../../../project/hooks/useProjectPill.js";
import { getProjectIcon } from "../../../../project/projectIcons.js";
import { isTodoDone } from "../../../../../shared/utils/todoStatus.js";
import TagChips from "../../../../../shared/ui/common/TagChips.jsx";
import { useWorkspacePermissions } from "../../../../workspace/hooks/useWorkspacePermissions.js";
import { projectIconColor } from "../../../../project/utils/projectOptions.js";
import { useTheme } from "@mui/material/styles";
import { priorityColor } from "../../../../../shared/ui/tone.js";
import { PriorityTag } from "../../../../../shared/ui/common/Tags.jsx";

/**
 * Props:
 *   todo
 *   isDragging
 *   onDragStart, onDragEnd, onClick, onDelete
 */
export default function BoardCard({
    todo,
    isDragging,
    onDragStart,
    onDragEnd,
    onClick,
    onDelete,
}) {
    const theme = useTheme();
    const perms = useWorkspacePermissions();
    const isDone = isTodoDone(todo);
    const isOverdue = !isDone && todo.dueDate && new Date(todo.dueDate) < new Date(new Date().toDateString());
    const priority = todo.priority || "MEDIUM";
    const priorityHex = priorityColor(theme, priority);
    const { project, show: showProjectPill } = useProjectPill(todo);

    const isRecurring = !!(todo.hasRecurrence || todo.recurrenceSourceId);
    const isFocused = !!todo.focused;
    const assignees = resolveAssigneeList(todo);
    const commentCount = todo.commentCount ?? 0;
    // 서브태스크(parentId 기반 실제 할 일) 배지 — 서버 집계 필드 사용
    const subtaskTotal = todo.subtaskTotal ?? 0;
    const subtaskDone = todo.subtaskDone ?? 0;
    const hasSubtasks = subtaskTotal > 0;

    return (
        <Box
            draggable
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onClick={onClick}
            sx={{
                position: "relative",
                bgcolor: "background.paper",
                borderRadius: "var(--plando-radius-card)",
                boxShadow: "var(--plando-elev-1)",
                px: 1.75,
                py: 1.5,
                pl: 2,
                cursor: "grab",
                opacity: isDragging ? 0.55 : 1,
                transition: "transform var(--plando-dur-fast) var(--plando-ease), box-shadow var(--plando-dur-fast) var(--plando-ease)",
                "&:hover": {
                    transform: "translateY(-2px)",
                    boxShadow: "var(--plando-shadow-2)",
                },
                "&:hover .card-actions": { opacity: 1 },
                "&:active": { cursor: "grabbing" },
            }}
        >
            {/* 좌측 priority 막대 — 기존 그대로 */}
            <Box
                sx={{
                    position: "absolute",
                    left: 0,
                    top: 12,
                    bottom: 12,
                    width: 3,
                    borderRadius: 999,
                    bgcolor: priorityHex,
                    opacity: isDone ? 0.35 : 1,
                }}
            />

            {/* Top row: pills + hover actions. 한 줄 유지 + 긴 항목은 말줄임(세로 깨짐 방지). */}
            <Stack direction="row" alignItems="center" spacing={0.625} sx={{ mb: 1, minWidth: 0, overflow: "hidden" }}>
                {showProjectPill && (() => {
                    const ProjIcon = getProjectIcon(project.icon);
                    return (
                        <MiniPill
                            bg="rgba(15, 23, 42, 0.04)"
                            color="text.secondary"
                            maxWidth={150}
                            icon={<ProjIcon sx={{ fontSize: 12, color: projectIconColor(project.color) ?? "text.secondary", flexShrink: 0 }} />}
                            label={project.name}
                        />
                    );
                })()}
                <Box sx={{ flexShrink: 0, display: "inline-flex" }}>
                    <PriorityTag priority={priority} size="xs" />
                </Box>
                {isFocused && (
                    <MiniPill
                        bg="var(--plando-primary-soft)"
                        color="primary.main"
                        icon={<BoltRoundedIcon sx={{ fontSize: 11 }} />}
                        label="포커스"
                    />
                )}
                {isRecurring && (
                    <MiniPill
                        bg="var(--plando-primary-soft)"
                        color="primary.main"
                        icon={<RepeatRoundedIcon sx={{ fontSize: 11 }} />}
                        label="반복"
                    />
                )}
                <TagChips tags={todo.tags} max={2} />
                <Box sx={{ flex: 1 }} />
                <Stack direction="row" className="card-actions" sx={{ opacity: 0, transition: "opacity var(--plando-dur-fast) var(--plando-ease)" }}>
                    {perms.canDeleteTodo(todo) && <IconButton
                        size="small"
                        onClick={(e) => { e.stopPropagation(); onDelete?.(e, todo); }}
                        sx={{ p: 0.375, color: "text.disabled", "&:hover": { color: "error.main" } }}
                    >
                        <DeleteOutlineRoundedIcon sx={{ fontSize: 15 }} />
                    </IconButton>}
                </Stack>
            </Stack>

            {/* Title (2-line clamp) */}
            <Typography
                sx={{
                    fontSize: 14,
                    fontWeight: 800,
                    letterSpacing: "-0.02em",
                    lineHeight: 1.4,
                    color: isDone ? "text.disabled" : "text.primary",
                    textDecoration: isDone ? "line-through" : "none",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    mb: todo.content ? 0.875 : 1.25,
                    wordBreak: "keep-all",
                }}
            >
                {todo.title || "(제목 없음)"}
            </Typography>

            {/* Description (2-line clamp) */}
            {todo.content && (
                <Typography
                    sx={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "text.disabled",
                        letterSpacing: "-0.01em",
                        lineHeight: 1.45,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        mb: 1.25,
                    }}
                >
                    {stripMarkdown(todo.content)}
                </Typography>
            )}

            {/* Meta row */}
            <Stack direction="row" alignItems="center" spacing={1.25} sx={{ flexWrap: "wrap", rowGap: 0.5 }}>
                {todo.dueDate && (
                    <Stack
                        direction="row"
                        alignItems="center"
                        spacing={0.5}
                        sx={{
                            fontSize: 11.5,
                            fontWeight: 800,
                            color: isOverdue ? "error.main" : isDone ? "text.disabled" : "text.secondary",
                            letterSpacing: "-0.01em",
                        }}
                    >
                        <EventRoundedIcon sx={{ fontSize: 13 }} />
                        {formatAbsoluteDue(todo.dueDate)}
                    </Stack>
                )}
                {hasSubtasks && (
                    <Stack
                        direction="row"
                        alignItems="center"
                        spacing={0.375}
                        sx={{
                            fontSize: 11,
                            fontWeight: 800,
                            color: subtaskDone === subtaskTotal ? "success.main" : "text.disabled",
                            fontVariantNumeric: "tabular-nums",
                        }}
                    >
                        <AccountTreeRoundedIcon sx={{ fontSize: 12 }} />
                        {subtaskDone}/{subtaskTotal}
                    </Stack>
                )}
                {commentCount > 0 && (
                    <Stack direction="row" alignItems="center" spacing={0.375} sx={{ fontSize: 11, fontWeight: 700, color: "text.disabled" }}>
                        <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 12 }} />
                        {commentCount}
                    </Stack>
                )}
                <Box sx={{ flex: 1 }} />
                {assignees.length > 0 && <AssigneeStack assignees={assignees} size={20} max={3} overlap={-6} />}
            </Stack>
        </Box>
    );
}

function MiniPill({ bg, color, dot, icon, label, maxWidth }) {
    return (
        <Box
            sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.375,
                px: 0.875,
                py: 0.125,
                borderRadius: 999,
                bgcolor: bg,
                color,
                fontSize: 10.5,
                fontWeight: 800,
                letterSpacing: "-0.01em",
                lineHeight: 1.4,
                whiteSpace: "nowrap",
                minWidth: 0,
                ...(maxWidth ? { maxWidth } : {}),
            }}
        >
            {dot && <Box sx={{ width: 4, height: 4, borderRadius: 999, bgcolor: dot, flexShrink: 0 }} />}
            {icon}
            {/* 긴 라벨(프로젝트명 등)은 세로로 깨지지 않게 한 줄 말줄임 */}
            <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                {label}
            </Box>
        </Box>
    );
}
