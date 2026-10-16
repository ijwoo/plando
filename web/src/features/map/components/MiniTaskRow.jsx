import React from "react";
import { Box, Chip, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import RoomRoundedIcon from "@mui/icons-material/RoomRounded";
import { statusChipColor, getTaskMarkerColor } from "../utils/mapUtils.js";
import { getGlassSx } from "../../../shared/ui/glassSx.js";

export default function MiniTaskRow({ task, onClick }) {
    const theme = useTheme();

    return (
        <Box
            onClick={onClick}
            sx={{
                display: "flex",
                alignItems: "center",
                px: 1.5,
                py: 1.25,
                borderRadius: 3,
                border: "1px solid",
                cursor: "pointer",
                transition: "all 0.15s ease",
                "&:active": { transform: "scale(0.98)" },
                ...getGlassSx(theme),
            }}
        >
            {/* 상태 색상 도트 */}
            <Box
                sx={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    bgcolor: getTaskMarkerColor(theme, task.status),
                    flexShrink: 0,
                    mr: 1.25,
                    boxShadow: `0 0 0 3px ${getTaskMarkerColor(theme, task.status)}22`,
                }}
            />

            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={700} color="text.primary" noWrap>
                    {task.title}
                </Typography>
                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.25 }}>
                    <RoomRoundedIcon sx={{ fontSize: 13, color: "text.disabled" }} />
                    <Typography variant="caption" color="text.secondary" noWrap>
                        {task.locationName || task.locationAddress || "위치 정보 없음"}
                    </Typography>
                </Stack>
            </Box>

            <Chip
                size="small"
                label={
                    task.status === "TODO"
                        ? "할 일"
                        : task.status === "IN_PROGRESS"
                        ? "진행 중"
                        : "완료"
                }
                color={statusChipColor(task.status)}
                sx={{ ml: 1, flexShrink: 0, height: 24, fontSize: 11, fontWeight: 700 }}
            />
        </Box>
    );
}
