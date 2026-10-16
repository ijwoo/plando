import React from "react";
import { Box, Stack, Tooltip, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { updateTodoFocus } from "../features/todo/api/todoApi.js";
import { useOpenTodoDetail } from "../features/todo/hooks/useOpenTodoDetail.jsx";
import { APP_EVENTS } from "../shared/constants/events.js";
import { getApiError } from "../shared/api/axiosInstance.js";
import { toast } from "../shared/utils/toast.js";
import { PriorityTag } from "../shared/ui/common/Tags.jsx";
import { toDateFromYmd } from "../features/calendar/utils/calendarUtils.js";

const MAX_VISIBLE = 5;

/**
 * dueDate 기준 상대 라벨 + tone. (지연/오늘=danger, 내일=warning, 그 외=default)
 */
function relativeDueLabel(ymd) {
    if (!ymd) return null;
    const due = toDateFromYmd(ymd);
    if (!due) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.round((due - today) / 86400000);
    if (diff < 0) return { text: "지연", tone: "danger" };
    if (diff === 0) return { text: "오늘", tone: "danger" };
    if (diff === 1) return { text: "내일", tone: "warning" };
    if (diff < 7) return { text: `+${diff}일`, tone: "default" };
    if (diff < 30) return { text: `${Math.floor(diff / 7)}주 후`, tone: "default" };
    return { text: `${due.getMonth() + 1}.${due.getDate()}`, tone: "default" };
}

function PriorityDot({ priority }) {
    return <PriorityTag priority={priority} variant="dot" size="md" sx={{ width: 8, height: 8 }} />;
}

function FocusItem({ task, onClick, onUnfocus }) {
    const theme = useTheme();
    const label = relativeDueLabel(task.dueDate);
    const labelColor = label?.tone === "danger" ? "var(--plando-red)"
        : label?.tone === "warning" ? "var(--plando-orange)"
        : theme.palette.text.disabled;

    return (
        <Box sx={{
            position: "relative",
            "&:hover .focus-item-remove": { opacity: 1, pointerEvents: "auto" },
            "&:hover .focus-item-meta": { opacity: 0 },
        }}>
            <Box
                component="button"
                onClick={onClick}
                sx={{
                    width: "100%",
                    height: 32,
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    px: 1.25,
                    borderRadius: "8px",
                    border: "none",
                    cursor: "pointer",
                    background: "transparent",
                    fontFamily: "var(--plando-font)",
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: theme.palette.text.secondary,
                    textAlign: "left",
                    transition: "background 120ms ease",
                    "&:hover": { background: theme.palette.action.hover },
                }}
            >
                <PriorityDot priority={task.priority} />
                <Box component="span" sx={{
                    flex: 1, minWidth: 0,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    pr: 3,
                }}>
                    {task.title || "(제목 없음)"}
                </Box>
                {label && (
                    <Box
                        component="span"
                        className="focus-item-meta"
                        sx={{
                            fontSize: 10.5, fontWeight: 800,
                            color: labelColor,
                            letterSpacing: "-0.005em",
                            fontVariantNumeric: "tabular-nums",
                            transition: "opacity 120ms ease",
                        }}
                    >
                        {label.text}
                    </Box>
                )}
            </Box>

            <Tooltip title="포커스 해제" placement="left">
                <Box
                    component="button"
                    className="focus-item-remove"
                    onClick={(e) => { e.stopPropagation(); onUnfocus(); }}
                    aria-label="포커스 해제"
                    sx={{
                        position: "absolute",
                        right: 6, top: "50%",
                        transform: "translateY(-50%)",
                        width: 20, height: 20,
                        borderRadius: "6px",
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: theme.palette.text.disabled,
                        opacity: 0,
                        pointerEvents: "none",
                        transition: "opacity 120ms ease, background 120ms ease, color 120ms ease",
                        "&:hover": {
                            background: theme.palette.action.hover,
                            color: theme.palette.text.primary,
                        },
                    }}
                >
                    <CloseRoundedIcon sx={{ fontSize: 14 }} />
                </Box>
            </Tooltip>
        </Box>
    );
}

export default function SidebarFocusedItems({ tasks, onMobileClose }) {
    const theme = useTheme();
    const openTodoDetail = useOpenTodoDetail();

    const visible = tasks.slice(0, MAX_VISIBLE);
    const overflow = Math.max(0, tasks.length - MAX_VISIBLE);

    const handleClick = (task) => {
        openTodoDetail(task.id);
        onMobileClose?.();
    };

    const handleUnfocus = async (task) => {
        try {
            await updateTodoFocus(task.id, false);
            window.dispatchEvent(new CustomEvent(APP_EVENTS.TODO_UPDATED, {
                detail: { id: task.id, patch: { focused: false } },
            }));
        } catch (e) {
            toast.error(getApiError(e, "포커스 해제에 실패했어요."));
        }
    };

    if (tasks.length === 0) {
        return (
            <Typography sx={{
                px: 1.5, py: 0.5,
                fontSize: 11.5, fontWeight: 600,
                color: theme.palette.text.disabled,
                lineHeight: 1.45,
            }}>
                할 일 상세에서 ⚡ 포커스를 켜면 여기에 모여요.
            </Typography>
        );
    }

    return (
        <Stack spacing={0.25} sx={{ px: 0.25 }}>
            {visible.map((task) => (
                <FocusItem
                    key={task.id}
                    task={task}
                    onClick={() => handleClick(task)}
                    onUnfocus={() => handleUnfocus(task)}
                />
            ))}
            {overflow > 0 && (
                <Typography sx={{
                    px: 1.5, pt: 0.25,
                    fontSize: 10.5, fontWeight: 700,
                    color: theme.palette.text.disabled,
                    letterSpacing: "-0.005em",
                }}>
                    +{overflow}개 더 있음
                </Typography>
            )}
        </Stack>
    );
}
