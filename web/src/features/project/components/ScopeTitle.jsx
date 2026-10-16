import React from "react";
import { Box, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { getProjectIcon } from "../projectIcons.js";

/**
 * 스코프(프로젝트) 헤더 타이틀 — 아이콘 박스 + 이름.
 * 개요(ProjectsPage) / 보드(BoardHeader) / 목록(TaskListPage) 헤더 공용 → 탭 전환 시
 * 이름 위치가 어긋나지 않도록 단일 컴포넌트로 통일.
 *
 *  - color 있으면(프로젝트 스코프): 색 틴트 박스 + 프로젝트 아이콘 + 이름
 *  - color 없으면(전체/인박스): 이름만
 *  - onClick 있으면: 이름을 클릭 가능하게(프로젝트 개요로 진입) — hover 시 살짝 강조
 */
export default function ScopeTitle({ color, iconKey, label, box = 28, iconSize = 17, onClick }) {
    const Icon = color ? getProjectIcon(iconKey) : null;
    const clickable = typeof onClick === "function";
    return (
        <Stack
            direction="row"
            alignItems="center"
            spacing={1.25}
            onClick={onClick}
            sx={{
                minWidth: 0,
                ...(clickable && {
                    cursor: "pointer",
                    borderRadius: "8px",
                    "&:hover .scope-title-label": { textDecoration: "underline", textUnderlineOffset: "3px" },
                }),
            }}
        >
            {color && (
                <Box sx={{ width: box, height: box, borderRadius: "8px", bgcolor: alpha(color, 0.16), color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon sx={{ fontSize: iconSize }} />
                </Box>
            )}
            <Typography className="scope-title-label" sx={{ fontSize: "var(--plando-type-title1-size)", fontWeight: "var(--plando-type-title1-weight)", lineHeight: "var(--plando-type-title1-lh)", letterSpacing: "var(--plando-type-title1-ls)", color: "text.primary", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {label}
            </Typography>
        </Stack>
    );
}
