import React from "react";
import { Box, Chip } from "@mui/material";
import { alpha } from "@mui/material/styles";
import InboxRoundedIcon from "@mui/icons-material/InboxRounded";
import { useActiveProject } from "../../project/context/ActiveProjectContext.jsx";

/**
 * 캘린더 스코프 표시 칩 — "조용한 필터링" 방지 (데스크탑 툴바·모바일 헤더 공용).
 * 스코프(프로젝트/인박스)가 활성일 때만 렌더, X 탭 → 전체로 해제.
 */
export default function ScopeFilterChip({ size = "small", sx }) {
    const { activeProjectId, activeProject, setActiveProject } = useActiveProject();
    if (activeProjectId == null) return null;

    const label = activeProject ? `${activeProject.name}만 표시` : "인박스만 표시";
    const color = activeProject?.color ?? null;

    return (
        <Chip
            size={size}
            icon={color
                ? <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: `${color} !important`, ml: "6px !important" }} />
                : <InboxRoundedIcon sx={{ fontSize: 14 }} />}
            label={label}
            onDelete={() => setActiveProject(null)}
            sx={{
                height: 26,
                fontSize: 12,
                fontWeight: 700,
                bgcolor: color ? alpha(color, 0.12) : "var(--plando-gray-soft)",
                color: "text.secondary",
                "& .MuiChip-deleteIcon": { fontSize: 15 },
                ...sx,
            }}
        />
    );
}
