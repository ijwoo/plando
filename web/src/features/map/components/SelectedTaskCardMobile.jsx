import React, { useState } from "react";
import { Box, Button, Chip, CircularProgress, IconButton, Stack, Typography } from "@mui/material";

import AltRouteRoundedIcon from "@mui/icons-material/AltRouteRounded";
import RoomRoundedIcon from "@mui/icons-material/RoomRounded";
import AssignmentTurnedInRoundedIcon from "@mui/icons-material/AssignmentTurnedInRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import NotificationsRoundedIcon from "@mui/icons-material/NotificationsRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import { alpha, useTheme } from "@mui/material/styles";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { statusChipColor, formatDueDate, getTaskMarkerColor } from "../utils/mapUtils.js";
import { getStatusLabel } from "../../../shared/ui/tone.js";
import { resolveAssigneeLabel } from "../../../shared/utils/assigneeUtils.js";
import { updateTodoStatus, deleteTodo } from "../../todo/api/todoApi.js";
import { useOpenTodoDetail } from "../../todo/hooks/useOpenTodoDetail.jsx";
import { getApiError } from "../../../shared/api/axiosInstance.js";
import { toast } from "../../../shared/utils/toast.js";
import { useStatuses } from "../../workspace/context/StatusContext.jsx";
import { doneTodoStatusKey } from "../../../shared/utils/todoStatus.js";

/** 바텀시트 내부 — 자체 Card 래퍼 없음 */
export default function SelectedTaskCardMobile({ task, onClose, onRefresh, triggerInfo, onTriggerSettings, onDeleteTrigger }) {
    const { statuses } = useStatuses();
    const theme = useTheme();
    const [completing, setCompleting] = useState(false);
    const openTodoDetail = useOpenTodoDetail();
    if (!task) return null;

    const isDone = task.status === "DONE";

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
            onClose?.();
        } catch (e) {
            toast.error(getApiError(e, "완료 처리에 실패했어요."));
        } finally {
            setCompleting(false);
        }
    };

    return (
        <Stack spacing={1.5}>
            {/* 헤더 */}
            <Stack direction="row" alignItems="center" spacing={1}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" alignItems="center" spacing={0.75}>
                        <Box
                            sx={{
                                width: 10,
                                height: 10,
                                borderRadius: "50%",
                                bgcolor: getTaskMarkerColor(theme, task.status),
                                flexShrink: 0,
                                boxShadow: `0 0 0 3px ${getTaskMarkerColor(theme, task.status)}33`,
                            }}
                        />
                        <Typography variant="subtitle1" fontWeight={800} noWrap sx={{ lineHeight: 1.3 }}>
                            {task.title}
                        </Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.25, ml: 0.25 }}>
                        <RoomRoundedIcon sx={{ fontSize: 13, color: "text.disabled" }} />
                        <Typography variant="body2" color="text.secondary" noWrap>
                            {task.locationName || task.locationAddress || "위치 정보 없음"}
                        </Typography>
                    </Stack>
                </Box>
                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
                    <Chip
                        size="small"
                        label={getStatusLabel(task.status)}
                        color={statusChipColor(task.status)}
                        sx={{ height: 26, fontWeight: 700 }}
                    />
                    <IconButton
                        size="small"
                        onClick={onClose}
                        sx={{ bgcolor: "action.hover", width: 28, height: 28 }}
                    >
                        <CloseRoundedIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                </Stack>
            </Stack>

            {/* 메타 칩 */}
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                <Chip
                    size="small"
                    icon={<CalendarMonthRoundedIcon sx={{ fontSize: "14px !important" }} />}
                    label={formatDueDate(task.dueDate)}
                    variant="outlined"
                    sx={{ height: 28, fontSize: 12 }}
                />
                {resolveAssigneeLabel(task) && (
                    <Chip
                        size="small"
                        icon={<PersonRoundedIcon sx={{ fontSize: "14px !important" }} />}
                        label={resolveAssigneeLabel(task)}
                        variant="outlined"
                        sx={{ height: 28, fontSize: 12 }}
                    />
                )}
            </Stack>

            {/* 트리거 상태 */}
            <Box
                sx={{
                    p: "10px 14px",
                    borderRadius: 2.5,
                    border: "1px solid",
                    borderColor: triggerInfo?.enabled
                        ? alpha(theme.palette.primary.main, 0.3)
                        : "divider",
                    bgcolor: triggerInfo?.enabled
                        ? alpha(theme.palette.primary.main, 0.06)
                        : "background.paper",
                }}
            >
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" alignItems="center" spacing={1.25}>
                        <Box
                            sx={{
                                width: 32,
                                height: 32,
                                borderRadius: 1.5,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                bgcolor: triggerInfo?.enabled
                                    ? alpha(theme.palette.primary.main, 0.15)
                                    : "action.selected",
                                color: triggerInfo?.enabled ? "primary.main" : "text.disabled",
                            }}
                        >
                            <NotificationsRoundedIcon sx={{ fontSize: 16 }} />
                        </Box>
                        <Box>
                            <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                                장소 기반 알림
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {triggerInfo?.enabled
                                    ? `${task.locationName || "이 장소"} 반경 ${triggerInfo.radius}m 진입 시`
                                    : "알림 미설정"}
                            </Typography>
                        </Box>
                    </Stack>
                    <Box
                        onClick={onTriggerSettings}
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            color: "primary.main",
                            fontSize: 12.5,
                            fontWeight: 600,
                            cursor: "pointer",
                            gap: 0.25,
                        }}
                    >
                        설정 <ChevronRightRoundedIcon sx={{ fontSize: 16 }} />
                    </Box>
                </Stack>
            </Box>

            {/* 액션 버튼 — 3개 */}
            <Stack direction="row" spacing={0.75}>
                <Button
                    variant="outlined"
                    startIcon={<InfoOutlinedIcon sx={{ fontSize: "15px !important" }} />}
                    onClick={() => openTodoDetail(task.id, {
                        onDelete: async (id) => {
                            await deleteTodo(id);
                            await onDeleteTrigger?.(id); // 위치 알림 트리거 즉시 제거
                            onRefresh?.();
                            onClose?.();
                        },
                        onPatchLocal: onRefresh,
                    })}
                    sx={{ flex: 1, borderRadius: 3, textTransform: "none", minHeight: 46, fontWeight: 700, fontSize: 13 }}
                >
                    상세
                </Button>
                <Button
                    variant="contained"
                    startIcon={<AltRouteRoundedIcon sx={{ fontSize: "15px !important" }} />}
                    onClick={handleNavigate}
                    disabled={!task.locationLat}
                    sx={{ flex: 1, borderRadius: 3, textTransform: "none", minHeight: 46, fontWeight: 700, fontSize: 13 }}
                >
                    길찾기
                </Button>
                <Button
                    variant="outlined"
                    color={isDone ? "success" : "primary"}
                    startIcon={completing ? <CircularProgress size={14} /> : <AssignmentTurnedInRoundedIcon sx={{ fontSize: "15px !important" }} />}
                    onClick={handleComplete}
                    disabled={isDone || completing}
                    sx={{ flex: 1, borderRadius: 3, textTransform: "none", minHeight: 46, fontWeight: 700, fontSize: 13 }}
                >
                    {isDone ? "완료됨" : "완료"}
                </Button>
            </Stack>
        </Stack>
    );
}
