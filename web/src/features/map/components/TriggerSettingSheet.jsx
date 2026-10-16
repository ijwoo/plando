import React, { useState } from "react";
import {
    Box,
    Button,
    Chip,
    Divider,
    IconButton,
    Paper,
    Stack,
    Switch,
    Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import NotificationsRoundedIcon from "@mui/icons-material/NotificationsRounded";
import RadarRoundedIcon from "@mui/icons-material/RadarRounded";
import RoomRoundedIcon from "@mui/icons-material/RoomRounded";
import { getTaskMarkerColor, formatDueDate } from "../utils/mapUtils.js";

const RADIUS_OPTIONS = [100, 200, 300, 500];


export default function TriggerSettingSheet({ tasks, triggerMap, onSave, onBack }) {
    const theme = useTheme();
    const [local, setLocal] = useState({ ...triggerMap });

    const toggle = (id) => {
        setLocal((prev) => ({
            ...prev,
            [id]: { radius: prev[id]?.radius || 200, enabled: !(prev[id]?.enabled) },
        }));
    };

    const setRadius = (id, radius) => {
        setLocal((prev) => ({
            ...prev,
            [id]: { ...prev[id], radius },
        }));
    };

    const activeCount = Object.values(local).filter((v) => v?.enabled).length;
    const locationTasks = tasks.filter((t) => t.locationLat && t.locationLng);

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                overflow: "hidden",
                bgcolor: "background.default",
                pt: "env(safe-area-inset-top)",
            }}
        >
            {/* 헤더 */}
            <Box sx={{ px: 2, pt: 2, pb: 1.5 }}>
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 0.5 }}>
                    <IconButton
                        size="small"
                        onClick={onBack}
                        sx={{ bgcolor: "action.hover" }}
                    >
                        <ArrowBackRoundedIcon fontSize="small" />
                    </IconButton>
                    <Typography sx={{ fontWeight: 800, fontSize: 17 }}>
                        장소 기반 알림 설정
                    </Typography>
                </Stack>

                {/* 활성 요약 카드 */}
                <Paper
                    elevation={0}
                    sx={{
                        mt: 2,
                        p: "12px 14px",
                        borderRadius: 3,
                        border: "1px solid",
                        borderColor: activeCount > 0
                            ? alpha(theme.palette.primary.main, 0.3)
                            : "divider",
                        bgcolor: activeCount > 0
                            ? alpha(theme.palette.primary.main, 0.06)
                            : alpha(theme.palette.background.paper, 0.6),
                    }}
                >
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Box
                            sx={{
                                width: 42,
                                height: 42,
                                borderRadius: 2.5,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                bgcolor: activeCount > 0 ? "primary.main" : "action.selected",
                                color: activeCount > 0 ? "#fff" : "text.disabled",
                                flexShrink: 0,
                                boxShadow: activeCount > 0
                                    ? `0 4px 14px ${alpha(theme.palette.primary.main, 0.35)}`
                                    : "none",
                            }}
                        >
                            <NotificationsRoundedIcon />
                        </Box>
                        <Box>
                            <Typography sx={{ fontSize: 14.5, fontWeight: 700 }}>
                                {activeCount > 0
                                    ? `${activeCount}개 장소 알림 활성화됨`
                                    : "설정된 장소 알림 없음"}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {activeCount > 0
                                    ? "해당 장소 근처 진입 시 푸시 알림"
                                    : "아래에서 장소를 선택해 활성화하세요"}
                            </Typography>
                        </Box>
                    </Stack>
                </Paper>
            </Box>

            <Divider />

            {/* 태스크 목록 */}
            <Box sx={{ flex: 1, overflowY: "auto", px: 2, py: 1.5 }}>
                <Typography
                    variant="caption"
                    color="text.disabled"
                    sx={{ fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", mb: 1.5, display: "block" }}
                >
                    위치 있는 할 일 ({locationTasks.length})
                </Typography>

                {locationTasks.length === 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
                        위치가 등록된 할 일이 없어요
                    </Typography>
                )}

                <Stack spacing={1.5}>
                    {locationTasks.map((task) => {
                        const markerColor = getTaskMarkerColor(theme, task.status);
                        const info = local[task.id];
                        const isOn = !!info?.enabled;
                        const radius = info?.radius || 200;

                        return (
                            <Paper
                                key={task.id}
                                elevation={0}
                                sx={{
                                    borderRadius: 3,
                                    border: "1px solid",
                                    borderColor: isOn
                                        ? alpha(markerColor, 0.28)
                                        : "divider",
                                    bgcolor: isOn
                                        ? alpha(markerColor, 0.05)
                                        : alpha(theme.palette.background.paper, 0.7),
                                    overflow: "hidden",
                                }}
                            >
                                {/* 태스크 행 */}
                                <Stack
                                    direction="row"
                                    alignItems="flex-start"
                                    spacing={1.5}
                                    sx={{ p: "12px 14px" }}
                                >
                                    <Box
                                        sx={{
                                            width: 10,
                                            height: 10,
                                            borderRadius: "50%",
                                            bgcolor: markerColor,
                                            mt: "5px",
                                            flexShrink: 0,
                                            boxShadow: `0 0 6px ${markerColor}`,
                                        }}
                                    />
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography
                                            sx={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.35, mb: 0.5 }}
                                            noWrap
                                        >
                                            {task.title}
                                        </Typography>
                                        <Stack direction="row" alignItems="center" spacing={0.75}>
                                            <RoomRoundedIcon sx={{ fontSize: 12, color: "text.disabled" }} />
                                            <Typography variant="caption" color="text.disabled" noWrap>
                                                {task.locationName || task.locationAddress}
                                            </Typography>
                                            <Typography variant="caption" color="text.disabled">·</Typography>
                                            <Typography variant="caption" color="text.disabled">
                                                {formatDueDate(task.dueDate)}
                                            </Typography>
                                        </Stack>
                                    </Box>
                                    <Switch
                                        size="small"
                                        checked={isOn}
                                        onChange={() => toggle(task.id)}
                                        sx={{
                                            "& .MuiSwitch-switchBase.Mui-checked": { color: markerColor },
                                            "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                                                bgcolor: markerColor,
                                            },
                                        }}
                                    />
                                </Stack>

                                {/* 반경 설정 — 켜져있을 때만 */}
                                {isOn && (
                                    <Box
                                        sx={{
                                            px: "14px",
                                            pb: "12px",
                                            pt: 0.5,
                                            borderTop: "1px solid",
                                            borderColor: alpha(markerColor, 0.15),
                                        }}
                                    >
                                        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1.25 }}>
                                            <RadarRoundedIcon sx={{ fontSize: 13, color: "text.disabled" }} />
                                            <Typography variant="caption" color="text.secondary">
                                                알림 반경 설정
                                            </Typography>
                                        </Stack>
                                        <Stack direction="row" spacing={1}>
                                            {RADIUS_OPTIONS.map((r) => {
                                                const selected = radius === r;
                                                return (
                                                    <Box
                                                        key={r}
                                                        onClick={() => setRadius(task.id, r)}
                                                        sx={{
                                                            flex: 1,
                                                            py: "6px",
                                                            borderRadius: 2,
                                                            border: "1px solid",
                                                            borderColor: selected ? markerColor : "divider",
                                                            bgcolor: selected ? markerColor : "transparent",
                                                            color: selected ? "#fff" : "text.secondary",
                                                            fontSize: 12,
                                                            fontWeight: selected ? 700 : 400,
                                                            textAlign: "center",
                                                            cursor: "pointer",
                                                            transition: "all 0.15s",
                                                            boxShadow: selected ? `0 2px 8px ${alpha(markerColor, 0.3)}` : "none",
                                                        }}
                                                    >
                                                        {r}m
                                                    </Box>
                                                );
                                            })}
                                        </Stack>
                                        {/* 미리보기 */}
                                        <Box
                                            sx={{
                                                mt: 1.25,
                                                px: 1.5,
                                                py: 1,
                                                borderRadius: 2,
                                                bgcolor: alpha(theme.palette.background.default, 0.7),
                                                border: "1px solid",
                                                borderColor: "divider",
                                            }}
                                        >
                                            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                                                <Box component="span" sx={{ color: markerColor, fontWeight: 700 }}>
                                                    {task.locationName || task.locationAddress}
                                                </Box>
                                                {" 반경 "}
                                                <Box component="span" sx={{ color: markerColor, fontWeight: 700 }}>
                                                    {radius}m
                                                </Box>
                                                {" 진입 시 푸시 알림"}
                                            </Typography>
                                        </Box>
                                    </Box>
                                )}
                            </Paper>
                        );
                    })}
                </Stack>
            </Box>

            {/* 저장 버튼 */}
            <Box sx={{ p: 2, pb: "max(16px, env(safe-area-inset-bottom))" }}>
                <Button
                    fullWidth
                    variant="contained"
                    size="large"
                    startIcon={<NotificationsRoundedIcon />}
                    onClick={() => {
                        // 존재하는 태스크의 항목만 저장 (삭제된 태스크의 stale 트리거 제거)
                        const existingIds = new Set(locationTasks.map((t) => String(t.id)));
                        const cleaned = Object.fromEntries(
                            Object.entries(local).filter(([k]) => existingIds.has(k))
                        );
                        onSave(cleaned);
                    }}
                    sx={{ borderRadius: 3, fontWeight: 800, minHeight: 50 }}
                >
                    저장하고 지도로 돌아가기
                </Button>
            </Box>
        </Box>
    );
}
