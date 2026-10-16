import React from "react";
import { Box, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import DashboardCard from "./DashboardCard.jsx";
import { fadeDividerSx } from "../../../shared/ui/glassSx.js";
import Press from "../../../shared/ui/primitives/Press.jsx";
import { PriorityPill } from "../../../shared/ui/common/Chips.jsx";
import CircleCheckbox from "../../../shared/ui/common/CircleCheckbox.jsx";
import { formatDueDate } from "../utils/dashboardUtils.js";
import { isTodoDone } from "../../../shared/utils/todoStatus.js";

/**
 * 이번 주 할 일 카드. mock의 TodayList 스타일.
 * props 시그니처 동일 (Desktop / Mobile 둘 다 사용).
 *
 * onCheckToggle에는 task 객체를 그대로 넘긴다 — status만 넘기던 시절엔 상위가 문자열로 완료를 판정해
 * 체크 표시(isTodoDone, doneAt 우선)와 어긋났고, 커스텀 완료 상태 항목은 체크가 해제되지 않았다.
 *
 * isDone: 완료 판정기(선택). 목록의 출처에 doneAt이 없을 수 있어(예: /dashboard/period-tasks)
 * 상위가 판정 방식을 주입할 수 있게 열어 둔다. 체크 표시와 onCheckToggle이 같은 기준을 쓰도록,
 * 상위도 반드시 같은 판정기를 쓸 것.
 */
export default function WeeklyTasksCard({
    tasks,
    onTaskClick,
    onCheckToggle,
    onViewAll,
    onAddTask,  // Desktop만 사용 — 보존
    isDone: isDoneProp = isTodoDone,
    sx,
    hideHeader = false,
}) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const primary = theme.palette.primary.main;

    return (
        <DashboardCard
            title="이번 주 할 일"
            actionText="전체보기"
            onAction={onViewAll}
            sx={sx}
            hideHeader={hideHeader}
        >
            {tasks.length === 0 ? (
                <Box
                    sx={{
                        py: 2.5,
                        textAlign: "center",
                        color: "text.disabled",
                        fontSize: 13,
                        fontWeight: 500,
                    }}
                >
                    이번 주 할 일이 없어요
                </Box>
            ) : (
                <Stack spacing={0}>
                    {tasks.slice(0, 10).map((task, i) => {
                        const isDone = isDoneProp(task);
                        return (
                            <Press
                                key={task.id}
                                onClick={() => onTaskClick?.(task.id)}
                                style={{
                                    ...(i > 0 ? fadeDividerSx(theme.palette.divider) : {}),
                                }}
                            >
                                <Stack
                                    direction="row"
                                    alignItems="center"
                                    spacing={1.25}
                                    sx={{ py: 1.25, px: 0.5 }}
                                >
                                    <CircleCheckbox
                                        checked={isDone}
                                        onToggle={() => onCheckToggle?.(task)}
                                        size={22}
                                    />

                                    {/* Title + meta */}
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography
                                            sx={{
                                                fontSize: 14,
                                                fontWeight: 600,
                                                letterSpacing: "-0.01em",
                                                color: isDone ? "text.disabled" : "text.primary",
                                                textDecoration: isDone ? "line-through" : "none",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {task.title}
                                        </Typography>
                                        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 0.4 }}>
                                            {task.priority && <PriorityPill priority={task.priority} />}
                                            {task.dueDate && (
                                                <Typography
                                                    sx={{
                                                        fontSize: 11,
                                                        fontWeight: 500,
                                                        color: "text.disabled",
                                                    }}
                                                >
                                                    · {formatDueDate(task.dueDate)}
                                                </Typography>
                                            )}
                                        </Stack>
                                    </Box>

                                    <ChevronRightRoundedIcon sx={{ fontSize: 16, color: "text.disabled", flexShrink: 0 }} />
                                </Stack>
                            </Press>
                        );
                    })}
                </Stack>
            )}

            {/* Desktop의 onAddTask가 전달된 경우만 노출 (모바일은 별도 QuickAddCard 사용) */}
            {onAddTask && tasks.length === 0 && (
                <Box sx={{ mt: 1.5, textAlign: "center" }}>
                    <Press
                        onClick={onAddTask}
                        style={{
                            display: "inline-flex",
                            padding: "8px 16px",
                            borderRadius: 999,
                            background: alpha(primary, isDark ? 0.18 : 0.10),
                            color: primary,
                            fontSize: 12,
                            fontWeight: 700,
                        }}
                    >
                        + 새 할 일
                    </Press>
                </Box>
            )}
        </DashboardCard>
    );
}
