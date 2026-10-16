import React from "react";
import { Box, Stack, Typography } from "@mui/material";
import RoomRoundedIcon from "@mui/icons-material/RoomRounded";
import { formatDueDate } from "../utils/mapUtils.js";
import { useTheme } from "@mui/material/styles";
import { statusColor } from "../../../shared/ui/tone.js";
import { StatusTag } from "../../../shared/ui/common/Tags.jsx";

function TriggerListItem({ task, selected, onClick }) {
    const theme = useTheme();
    // 상태 색/라벨은 tone.js 단일 소스에서 파생 (중복 정의 제거)
    const markerColor = statusColor(theme, task.status);
    const location = task.locationName || task.locationAddress || "위치 정보 없음";
    const dueLabel = formatDueDate(task.dueDate);

    return (
        <Box
            component="button"
            onClick={onClick}
            sx={{
                display: "block",
                width: "100%",
                textAlign: "left",
                cursor: "pointer",
                p: "10px 12px",
                mb: "4px",
                borderRadius: "12px",
                bgcolor: selected ? "var(--plando-primary-soft)" : "transparent",
                border: `1px solid ${selected ? "var(--plando-primary)" : "transparent"}`,
                fontFamily: "inherit",
                transition: "background 0.12s",
                "&:hover": {
                    bgcolor: selected ? "var(--plando-primary-soft)" : "var(--plando-gray-soft)",
                },
            }}
        >
            <Stack direction="row" alignItems="center" gap="10px">
                {/* 색상 아이콘 */}
                <Box
                    sx={{
                        width: 28,
                        height: 28,
                        borderRadius: "8px",
                        flexShrink: 0,
                        bgcolor: `color-mix(in srgb, ${markerColor} 14%, transparent)`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <RoomRoundedIcon sx={{ fontSize: 14, color: markerColor }} />
                </Box>

                <Box sx={{ flex: 1, minWidth: 0 }}>
                    {/* 제목 + 상태 배지 */}
                    <Stack direction="row" alignItems="center" gap="6px" sx={{ mb: "3px" }}>
                        <Typography
                            sx={{
                                flex: 1,
                                fontSize: 13,
                                fontWeight: 700,
                                color: "var(--plando-text-primary)",
                                letterSpacing: "-0.01em",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                            }}
                        >
                            {task.title}
                        </Typography>
                        <StatusTag
                            status={task.status}
                            size="xs"
                            showDot={false}
                            sx={{ flexShrink: 0, height: 20, px: "7px", fontWeight: 700 }}
                        />
                    </Stack>

                    {/* 메타 */}
                    <Typography
                        sx={{
                            fontSize: 11.5,
                            color: "var(--plando-text-tertiary)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        }}
                    >
                        {location} · {dueLabel}
                    </Typography>
                </Box>
            </Stack>
        </Box>
    );
}

export default function VisitTaskList({ tasks, selectedId, onSelect, showTitle = true }) {
    const list = (
        <Box sx={{ p: "4px 0" }}>
            {tasks.length === 0 ? (
                <Box sx={{ py: 4, textAlign: "center" }}>
                    <RoomRoundedIcon sx={{ fontSize: 32, color: "var(--plando-text-tertiary)", mb: 1 }} />
                    <Typography sx={{ fontSize: 13, color: "var(--plando-text-secondary)" }}>
                        장소가 등록된 일정이 없어요
                    </Typography>
                </Box>
            ) : (
                tasks.map((task) => (
                    <TriggerListItem
                        key={task.id}
                        task={task}
                        selected={task.id === selectedId}
                        onClick={() => onSelect(task)}
                    />
                ))
            )}
        </Box>
    );

    if (!showTitle) return list;

    return (
        <Box>
            <Typography
                sx={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--plando-text-tertiary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    px: 1,
                    py: 1,
                }}
            >
                장소 일정 {tasks.length}개
            </Typography>
            {list}
        </Box>
    );
}
