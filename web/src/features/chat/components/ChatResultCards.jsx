import { useState } from "react";
import {
    Box,
    IconButton,
    Stack,
    Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";

import CardSection from "../../../shared/ui/common/CardSection.jsx";
import Press from "../../../shared/ui/primitives/Press.jsx";
import { priorityColor, statusColor } from "../../../shared/ui/tone.js";
import { TagChip, STATUS_LABEL, PRIORITY_LABEL } from "./ChatWidgetTokens.jsx";

/* 단일 task 행 */
function ResultTaskItem({ task, onOpen, isLast }) {
    const theme = useTheme();
    const prioColor = priorityColor(theme, task.priority);
    const statColor = statusColor(theme, task.status);

    return (
        /* 행 전체가 열기 버튼이다.
           예전엔 항목마다 전체 폭 "열기" 버튼이 따로 붙어, 5건이면 버튼만 5개가 세로를 먹고
           정작 제목·배지는 그 사이에 끼여 읽기 힘들었다. 목록에서 항목을 누르면 열리는 건
           이 앱의 다른 화면과도 같은 방식이다. */
        <Box
            onClick={task.numericId ? () => onOpen(task) : undefined}
            sx={{
                px: 2, py: 1.5,
                borderBottom: isLast ? "none" : 1,
                borderColor: "divider",
                cursor: task.numericId ? "pointer" : "default",
                transition: "background-color .14s",
                ...(task.numericId && { "&:hover": { bgcolor: "action.hover" } }),
            }}
        >
            <Stack direction="row" alignItems="flex-start" spacing={1}>
                <Typography
                    sx={{
                        flex: 1, minWidth: 0,
                        fontSize: 14.5,
                        fontWeight: 700,
                        color: "text.primary",
                        mb: 0.875,
                        lineHeight: 1.4,
                        wordBreak: "break-word",
                    }}
                >
                    {task.title}
                </Typography>
                {task.numericId && (
                    <OpenInNewRoundedIcon sx={{ fontSize: 14, color: "text.disabled", mt: 0.375, flex: "none" }} />
                )}
            </Stack>
            <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mb: 0 }} useFlexGap>
                <TagChip
                    label={PRIORITY_LABEL[task.priority] || task.priority}
                    bg={alpha(prioColor, 0.12)}
                    color={prioColor}
                    icon={<FlagRoundedIcon sx={{ fontSize: 11 }} />}
                />
                <TagChip
                    label={STATUS_LABEL[task.status] || task.status}
                    bg={alpha(statColor, 0.12)}
                    color={statColor}
                />
                {task.dueDate && (
                    <TagChip
                        label={`마감 ${task.dueDate}`}
                        bg={alpha(theme.palette.primary.main, 0.10)}
                        color={theme.palette.primary.main}
                        icon={<CalendarMonthRoundedIcon sx={{ fontSize: 11 }} />}
                    />
                )}
                {task.assignees?.length > 0 && (
                    <TagChip
                        label={task.assignees.join(", ")}
                        bg="var(--plando-input-bg-hover)"
                        color={theme.palette.text.secondary}
                        icon={<PersonRoundedIcon sx={{ fontSize: 11 }} />}
                    />
                )}
            </Stack>
        </Box>
    );
}

/* 조회 / 수정 결과 카드 */
/* 접었을 때 보여줄 개수. */
const COLLAPSED_COUNT = 3;

/* 웹은 **펼친 채로 시작한다.**
   조회 결과를 보려고 물어본 것이니 한 번 더 누르게 하는 건 군더더기다. 전체화면 폭이
   860px 이고 스크롤도 화면 전체 폭이 갖고 있어서, 다 펼쳐도 대화 흐름이 묻히지 않는다.
   길다 싶으면 접을 수 있다. 앱은 화면이 좁아 반대로(접은 채 시작) 둔다. */
const DEFAULT_EXPANDED = true;

export function TaskResultCard({ tasks, actionType, onOpen, onDismiss }) {
    const theme = useTheme();
    const isUpdate = actionType === "TASK_UPDATED";
    const label    = isUpdate ? "수정 완료" : "조회 결과";

    const [expanded, setExpanded] = useState(DEFAULT_EXPANDED);
    const collapsible = tasks.length > COLLAPSED_COUNT;
    const visible = collapsible && !expanded ? tasks.slice(0, COLLAPSED_COUNT) : tasks;
    const hiddenCount = tasks.length - visible.length;

    /* 수정 완료는 green→primary 그라데이션, 조회는 AI 그라데이션 */
    const headerBg = isUpdate
        ? `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.10)} 0%, ${alpha(theme.palette.primary.main, 0.10)} 100%)`
        : "var(--plando-ai-grad-dim)";
    const iconBg = isUpdate
        ? `linear-gradient(135deg, ${theme.palette.success.main} 0%, ${theme.palette.primary.main} 100%)`
        : "var(--plando-ai-grad)";
    const titleGrad = iconBg;

    return (
        <CardSection padding={0} sx={{ overflow: "hidden" }}>
            <Box
                sx={{
                    background: headerBg,
                    px: 2,
                    py: 1.25,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderBottom: 1,
                    borderColor: "divider",
                }}
            >
                <Stack direction="row" alignItems="center" spacing={1}>
                    <Box
                        sx={{
                            width: 26,
                            height: 26,
                            borderRadius: 1,
                            background: iconBg,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#fff",
                        }}
                    >
                        <AutoAwesomeRoundedIcon sx={{ fontSize: 15 }} />
                    </Box>
                    <Typography
                        sx={{
                            fontSize: 12.5,
                            fontWeight: 800,
                            background: titleGrad,
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                        }}
                    >
                        {label}
                    </Typography>
                    {tasks.length > 1 && (
                        <Box
                            component="span"
                            sx={{
                                fontSize: 11.5,
                                fontWeight: 700,
                                color: "text.disabled",
                                background: "background.paper",
                                boxShadow: "var(--plando-shadow-card-ring)",
                                borderRadius: 999,
                                px: 1,
                                py: 0.125,
                            }}
                        >
                            {tasks.length}개
                        </Box>
                    )}
                </Stack>
                <IconButton
                    onClick={onDismiss}
                    aria-label="닫기"
                    size="small"
                    sx={{ color: "text.disabled" }}
                >
                    <CloseRoundedIcon sx={{ fontSize: 18 }} />
                </IconButton>
            </Box>

            {visible.map((task, i) => (
                <ResultTaskItem
                    key={task.id ?? i}
                    task={task}
                    onOpen={onOpen}
                    isLast={i === visible.length - 1 && !collapsible}
                />
            ))}

            {collapsible && (
                /* 몇 개가 숨어 있는지 숫자로 말한다 — "더 보기" 만 있으면 몇 개가 남았는지
                   몰라서 누를지 말지 판단이 안 된다. */
                <Press
                    onClick={() => setExpanded((v) => !v)}
                    haptic="light"
                    pressScale={0.995}
                    activeBg={theme.palette.action.hover}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 4,
                        width: "100%",
                        padding: "10px 16px",
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: theme.palette.primary.main,
                        backgroundColor: "transparent",
                    }}
                    aria-expanded={expanded}
                >
                    {expanded ? "접기" : `${hiddenCount}개 더 보기`}
                    <ExpandMoreRoundedIcon
                        sx={{
                            fontSize: 16,
                            transition: "transform .18s",
                            transform: expanded ? "rotate(180deg)" : "none",
                        }}
                    />
                </Press>
            )}
        </CardSection>
    );
}

/* 삭제 완료 카드 */
export function DeletedCard({ message, onDismiss }) {
    const theme = useTheme();
    return (
        <CardSection padding={0} sx={{ overflow: "hidden" }}>
            <Box
                sx={{
                    background: alpha(theme.palette.error.main, 0.10),
                    px: 2,
                    py: 1.25,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderBottom: 1,
                    borderColor: "divider",
                }}
            >
                <Stack direction="row" alignItems="center" spacing={1}>
                    <Box
                        sx={{
                            width: 26,
                            height: 26,
                            borderRadius: 1,
                            bgcolor: "error.main",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#fff",
                        }}
                    >
                        <CheckRoundedIcon sx={{ fontSize: 15 }} />
                    </Box>
                    <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: "error.main" }}>
                        삭제 완료
                    </Typography>
                </Stack>
                <IconButton
                    onClick={onDismiss}
                    aria-label="닫기"
                    size="small"
                    sx={{ color: "text.disabled" }}
                >
                    <CloseRoundedIcon sx={{ fontSize: 18 }} />
                </IconButton>
            </Box>
            <Box sx={{ px: 2.25, py: 1.75 }}>
                <Typography sx={{ fontSize: 14, color: "text.secondary", lineHeight: 1.6 }}>
                    {message || "태스크가 삭제됐어요."}
                </Typography>
            </Box>
        </CardSection>
    );
}

/* 텍스트 응답 카드 (태스크 없는 AI 응답) */
export function TextResponseCard({ message, onDismiss }) {
    return (
        <CardSection padding={0} sx={{ overflow: "hidden" }}>
            <Box
                sx={{
                    background: "var(--plando-ai-grad-dim)",
                    px: 2,
                    py: 1.25,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderBottom: 1,
                    borderColor: "divider",
                }}
            >
                <Stack direction="row" alignItems="center" spacing={1}>
                    <Box
                        sx={{
                            width: 26,
                            height: 26,
                            borderRadius: 1,
                            background: "var(--plando-ai-grad)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#fff",
                        }}
                    >
                        <AutoAwesomeRoundedIcon sx={{ fontSize: 15 }} />
                    </Box>
                    <Typography
                        sx={{
                            fontSize: 12.5,
                            fontWeight: 800,
                            background: "var(--plando-ai-grad)",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                        }}
                    >
                        AI 응답
                    </Typography>
                </Stack>
                <IconButton
                    onClick={onDismiss}
                    aria-label="닫기"
                    size="small"
                    sx={{ color: "text.disabled" }}
                >
                    <CloseRoundedIcon sx={{ fontSize: 18 }} />
                </IconButton>
            </Box>
            <Box sx={{ px: 2.25, py: 1.75 }}>
                <Typography
                    sx={{
                        fontSize: 14,
                        color: "text.primary",
                        lineHeight: 1.65,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                    }}
                >
                    {message}
                </Typography>
            </Box>
        </CardSection>
    );
}
