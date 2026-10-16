import React from "react";
import { Stack } from "@mui/material";
import { projectIconColor } from "../utils/projectOptions.js";

/** 프로젝트 옵션 한 줄 표시 (아이콘 + 이름) — Select renderValue/MenuItem 공용. option = buildProjectOptions() 항목 */
export default function ProjectOptionLabel({ option, iconSize = 16, spacing = 0.75 }) {
    const Icon = option.icon;
    return (
        <Stack direction="row" alignItems="center" spacing={spacing}>
            <Icon sx={{ fontSize: iconSize, color: projectIconColor(option.color) ?? "text.secondary" }} />
            <span>{option.label}</span>
        </Stack>
    );
}
