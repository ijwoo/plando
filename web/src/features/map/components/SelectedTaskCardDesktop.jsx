import React, { useState } from "react";
import { Avatar, Box, Button, Card, CardContent, Chip, CircularProgress, Stack, Typography } from "@mui/material";
import RoomRoundedIcon from "@mui/icons-material/RoomRounded";
import AltRouteRoundedIcon from "@mui/icons-material/AltRouteRounded";
import AssignmentTurnedInRoundedIcon from "@mui/icons-material/AssignmentTurnedInRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import { statusChipColor, formatDueDate } from "../utils/mapUtils.js";
import { getStatusLabel } from "../../../shared/ui/tone.js";
import { resolveAssigneeLabel } from "../../../shared/utils/assigneeUtils.js";
import { updateTodoStatus } from "../../todo/api/todoApi.js";
import { getApiError } from "../../../shared/api/axiosInstance.js";
import { toast } from "../../../shared/utils/toast.js";
import { useStatuses } from "../../workspace/context/StatusContext.jsx";
import { doneTodoStatusKey } from "../../../shared/utils/todoStatus.js";

export default function SelectedTaskCardDesktop({ task, onRefresh, onClear }) {
    const { statuses } = useStatuses();
    const [completing, setCompleting] = useState(false);
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
            onClear?.();
        } catch (e) {
            toast.error(getApiError(e, "완료 처리에 실패했어요."));
        } finally {
            setCompleting(false);
        }
    };

    return (
        <Card
            sx={{
                borderRadius: 4,
                boxShadow: "0 14px 34px rgba(15,23,42,0.16)",
                border: "1px solid",
                borderColor: "divider",
            }}
        >
            <CardContent sx={{ p: 2 }}>
                <Stack spacing={1.5}>
                    {/* 헤더 */}
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Avatar sx={{ width: 36, height: 36, bgcolor: "primary.main" }}>
                                <RoomRoundedIcon fontSize="small" />
                            </Avatar>
                            <Box sx={{ minWidth: 0 }}>
                                <Typography variant="subtitle1" fontWeight={800} noWrap>
                                    {task.title}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" noWrap>
                                    {task.locationName || task.locationAddress || "위치 정보 없음"}
                                </Typography>
                            </Box>
                        </Stack>
                        <Chip
                            size="small"
                            label={getStatusLabel(task.status)}
                            color={statusChipColor(task.status)}
                        />
                    </Stack>

                    {/* 메타 정보 */}
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Chip
                            size="small"
                            icon={<CalendarMonthRoundedIcon />}
                            label={formatDueDate(task.dueDate)}
                            variant="outlined"
                        />
                        {resolveAssigneeLabel(task) && (
                            <Chip
                                size="small"
                                icon={<PersonRoundedIcon />}
                                label={resolveAssigneeLabel(task)}
                                variant="outlined"
                            />
                        )}
                    </Stack>

                    {/* 액션 버튼 */}
                    <Stack direction="row" spacing={1}>
                        <Button
                            fullWidth
                            variant="contained"
                            startIcon={<AltRouteRoundedIcon />}
                            onClick={handleNavigate}
                            disabled={!task.locationLat}
                            sx={{ borderRadius: 3, textTransform: "none", fontWeight: 700 }}
                        >
                            길찾기
                        </Button>
                        <Button
                            fullWidth
                            variant="outlined"
                            color={isDone ? "success" : "primary"}
                            startIcon={completing ? <CircularProgress size={16} /> : <AssignmentTurnedInRoundedIcon />}
                            onClick={handleComplete}
                            disabled={isDone || completing}
                            sx={{ borderRadius: 3, textTransform: "none", fontWeight: 700 }}
                        >
                            {isDone ? "완료됨" : "완료 처리"}
                        </Button>
                    </Stack>
                </Stack>
            </CardContent>
        </Card>
    );
}
