import React, { useState } from "react";
import { Avatar, Box, Button, CircularProgress, Divider, IconButton, Stack, Typography } from "@mui/material";
import RoomRoundedIcon                from "@mui/icons-material/RoomRounded";
import AltRouteRoundedIcon            from "@mui/icons-material/AltRouteRounded";
import OpenInNewRoundedIcon           from "@mui/icons-material/OpenInNewRounded";
import AssignmentTurnedInRoundedIcon  from "@mui/icons-material/AssignmentTurnedInRounded";
import CloseRoundedIcon               from "@mui/icons-material/CloseRounded";
import CalendarMonthRoundedIcon       from "@mui/icons-material/CalendarMonthRounded";
import PersonRoundedIcon              from "@mui/icons-material/PersonRounded";
import { updateTodoStatus, deleteTodo } from "../../todo/api/todoApi.js";
import { useOpenTodoDetail } from "../../todo/hooks/useOpenTodoDetail.jsx";
import { getApiError } from "../../../shared/api/axiosInstance.js";
import { toast } from "../../../shared/utils/toast.js";
import { StatusTag } from "../../../shared/ui/common/Tags.jsx";
import { resolveAssigneeList, getAvatarSrc } from "../../../shared/utils/assigneeUtils.js";
import { getAvatarTone } from "../../../shared/utils/avatarUtils.js";
import { useStatuses } from "../../workspace/context/StatusContext.jsx";
import { doneTodoStatusKey } from "../../../shared/utils/todoStatus.js";

/* ── 요일 ── */
const DAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];

/** D-N · 4월 24일 (금) 또는 D+N · 마감 지남 */
function formatDueDateBadge(dueDate) {
    if (!dueDate) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const due   = new Date(dueDate); due.setHours(0, 0, 0, 0);
    const diff  = Math.round((due - today) / 86_400_000);
    const dateStr = `${due.getMonth() + 1}월 ${due.getDate()}일 (${DAYS_KO[due.getDay()]})`;
    if (diff > 0)  return { text: `D-${diff} · ${dateStr}`,          overdue: false };
    if (diff === 0) return { text: `D-Day · ${dateStr}`,              overdue: false };
    return             { text: `D+${Math.abs(diff)} · 마감 지남`,     overdue: true  };
}

/** 아바타 스택 (최대 3개 + 외 N명) */
function AssigneeRow({ task }) {
    const list = resolveAssigneeList(task);
    if (list.length === 0) {
        return (
            <Typography sx={{ fontSize: 12, color: "var(--plando-text-tertiary)" }}>
                담당자 없음
            </Typography>
        );
    }

    const shown = list.slice(0, 3);
    const extra = list.length - 3;

    return (
        <Stack direction="row" alignItems="center" gap="6px">
            {/* 아바타 스택 */}
            <Box sx={{ display: "flex", alignItems: "center" }}>
                {shown.map((a, i) => {
                    const name = typeof a === "string" ? a : (a?.name || a?.email || "?");
                    const src  = getAvatarSrc(typeof a === "object" ? a : {});
                    const tone = getAvatarTone(name);
                    return (
                        <Avatar
                            key={i}
                            src={src}
                            sx={{
                                width: 18, height: 18,
                                fontSize: 9, fontWeight: 700,
                                border: "1.5px solid #fff",
                                ml: i > 0 ? "-6px" : 0,
                                bgcolor: tone.bg,
                                color: tone.color,
                                zIndex: shown.length - i,
                            }}
                        >
                            {!src && name.charAt(0).toUpperCase()}
                        </Avatar>
                    );
                })}
            </Box>
            {/* 3명 초과일 때만 텍스트 표시 */}
            {extra > 0 && (
                <Typography sx={{ fontSize: 12, color: "var(--plando-text-secondary)", fontWeight: 500 }}>
                    외 {extra}명
                </Typography>
            )}
        </Stack>
    );
}

export default function SelectedTaskPanelDesktop({ task, onClear, onRefresh }) {
    const { statuses } = useStatuses();
    const [completing, setCompleting] = useState(false);
    const openTodoDetail = useOpenTodoDetail();

    if (!task) return null;
    const isDone    = task.status === "DONE";
    const dueBadge  = formatDueDateBadge(task.dueDate);
    const location  = task.locationName || task.locationAddress || null;

    const handleNavigate = () => {
        if (!task.locationLat || !task.locationLng) return;
        window.open(
            `https://map.kakao.com/link/to/${encodeURIComponent(task.locationName || task.title)},${task.locationLat},${task.locationLng}`,
            "_blank"
        );
    };

    const handleComplete = async () => {
        if (isDone) return;
        setCompleting(true);
        try {
            await updateTodoStatus(task.id, doneTodoStatusKey(statuses));
            onRefresh?.();
            onClear?.();
        } catch (e) {
            toast.error(getApiError(e, "완료 처리에 실패했어요."));
        } finally {
            setCompleting(false);
        }
    };

    return (
        <Box
            sx={{
                borderRadius: "16px",
                bgcolor: "var(--plando-surface)",
                boxShadow: "var(--plando-shadow-raised)",
                border: "1px solid var(--plando-border)",
                p: "16px",
            }}
        >
            {/* ── 제목 행: 핀 아이콘 · 제목 · 상태 뱃지 · 닫기 ── */}
            <Stack direction="row" alignItems="center" gap="6px" mb="4px">
                <RoomRoundedIcon
                    sx={{ fontSize: 14, color: "var(--plando-primary)", flexShrink: 0 }}
                />
                <Typography
                    sx={{
                        flex: 1,
                        fontSize: 14, fontWeight: 500,
                        color: "var(--plando-text-primary)",
                        letterSpacing: "-0.01em",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}
                >
                    {task.title}
                </Typography>
                <StatusTag status={task.status} size="xs" sx={{ flexShrink: 0, height: 20, fontWeight: 700 }} />
                <IconButton
                    size="small"
                    onClick={onClear}
                    sx={{ flexShrink: 0, p: "2px", color: "var(--plando-text-tertiary)" }}
                >
                    <CloseRoundedIcon sx={{ fontSize: 15 }} />
                </IconButton>
            </Stack>

            {/* ── 서브타이틀: 장소명 ── */}
            {location && (
                <Typography
                    sx={{
                        fontSize: 12,
                        color: "var(--plando-text-tertiary)",
                        pl: "20px",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}
                >
                    {location}
                </Typography>
            )}

            <Divider sx={{ my: "10px" }} />

            {/* ── 메타 정보 ── */}
            <Stack spacing="8px">
                {/* 마감일 */}
                <Stack direction="row" alignItems="center" gap="8px">
                    <CalendarMonthRoundedIcon
                        sx={{ fontSize: 14, color: "var(--plando-text-tertiary)", flexShrink: 0 }}
                    />
                    {dueBadge ? (
                        <Typography
                            sx={{
                                fontSize: 12, fontWeight: 500,
                                color: dueBadge.overdue ? "var(--plando-red)" : "var(--plando-text-primary)",
                            }}
                        >
                            {dueBadge.text}
                        </Typography>
                    ) : (
                        <Typography sx={{ fontSize: 12, color: "var(--plando-text-tertiary)" }}>
                            날짜 없음
                        </Typography>
                    )}
                </Stack>

                {/* 담당자 */}
                <Stack direction="row" alignItems="center" gap="8px">
                    <PersonRoundedIcon
                        sx={{ fontSize: 14, color: "var(--plando-text-tertiary)", flexShrink: 0 }}
                    />
                    <AssigneeRow task={task} />
                </Stack>
            </Stack>

            <Divider sx={{ my: "10px" }} />

            {/* ── 액션 버튼 ── */}
            <Stack direction="row" spacing={1} alignItems="stretch">
                <Button
                    variant="contained"
                    disableElevation
                    startIcon={<OpenInNewRoundedIcon sx={{ fontSize: 14 }} />}
                    onClick={() => openTodoDetail(task.id, {
                        onDelete: async (id) => {
                            await deleteTodo(id);
                            onRefresh?.();
                            onClear?.();
                        },
                    })}
                    sx={{ flex: 1, fontSize: 12.5 }}
                >
                    상세 보기
                </Button>
                <Button
                    variant="outlined"
                    startIcon={<AltRouteRoundedIcon sx={{ fontSize: 14 }} />}
                    onClick={handleNavigate}
                    sx={{ fontSize: 12.5, px: 1.5 }}
                >
                    길찾기
                </Button>
                {!isDone && (
                    <Button
                        variant="outlined"
                        color="success"
                        onClick={handleComplete}
                        disabled={completing}
                        sx={{ minWidth: 36, px: 0 }}
                    >
                        {completing
                            ? <CircularProgress size={14} />
                            : <AssignmentTurnedInRoundedIcon sx={{ fontSize: 16 }} />
                        }
                    </Button>
                )}
            </Stack>
        </Box>
    );
}
