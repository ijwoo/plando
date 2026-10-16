import React from "react";
import { Box, Stack, Tooltip } from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import CheckIcon from "@mui/icons-material/Check";
import { resolveImageUrl } from "../shared/utils/urlUtils.js";

// 워크스페이스 컬러 (iconImageUrl 없을 때 ID 기반 cycle)
const WS_COLORS = ["#FFA94D", "#82D2A2", "#7CB6FF", "#A78F73", "#E84545", "#A155F0"];

function colorForWorkspace(ws, idx) {
    const id = ws?.workspaceId ?? idx ?? 0;
    return WS_COLORS[Math.abs(Number(id) || idx || 0) % WS_COLORS.length];
}

/**
 * 사이드바 워크스페이스 리스트.
 *
 * Collapsed: 36×36 컬러 정사각형 + 첫 글자. active 는 outer color ring.
 * Expanded: 컬러 dot + 이름 + active 체크.
 */
export default function SidebarWorkspaceList({
    workspaces,
    currentWorkspaceId,
    onSelect,
    collapsed,
}) {
    const theme = useTheme();

    if (collapsed) {
        return (
            <Stack spacing={0.75} alignItems="center" sx={{ px: 0 }}>
                {workspaces.map((ws, idx) => {
                    const isActive = ws.workspaceId === currentWorkspaceId;
                    const wsColor = colorForWorkspace(ws, idx);
                    return (
                        <Tooltip key={ws.workspaceId} title={ws.workspaceName} placement="right">
                            <Box
                                component="button"
                                onClick={() => onSelect(ws)}
                                sx={{
                                    position: "relative",
                                    width: 36, height: 36,
                                    borderRadius: "10px",
                                    border: "none",
                                    cursor: "pointer",
                                    background: ws.iconImageUrl
                                        ? `center/cover url(${resolveImageUrl(ws.iconImageUrl)}), ${wsColor}`
                                        : wsColor,
                                    color: "#fff",
                                    fontSize: 13, fontWeight: 800,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    boxShadow: isActive
                                        ? `0 0 0 2px ${theme.palette.background.paper}, 0 0 0 4px ${alpha(wsColor, 0.4)}`
                                        : "none",
                                }}
                            >
                                {!ws.iconImageUrl && (ws.workspaceName?.charAt(0) || "W")}
                            </Box>
                        </Tooltip>
                    );
                })}
            </Stack>
        );
    }

    return (
        <Stack spacing={0.25} sx={{ px: 0.25 }}>
            {workspaces.map((ws, idx) => {
                const isActive = ws.workspaceId === currentWorkspaceId;
                const wsColor = colorForWorkspace(ws, idx);
                return (
                    <Box
                        key={ws.workspaceId}
                        component="button"
                        onClick={() => onSelect(ws)}
                        sx={{
                            display: "flex", alignItems: "center", gap: 1.25,
                            width: "100%", height: 34,
                            px: 1.5,
                            borderRadius: "10px",
                            border: "none",
                            cursor: "pointer",
                            background: isActive ? theme.palette.background.paper : "transparent",
                            boxShadow: isActive
                                ? `inset 0 0 0 1px ${theme.palette.divider}, 0 1px 3px rgba(15,23,42,0.04)`
                                : "none",
                            fontFamily: "var(--plando-font)",
                            fontSize: 12.5,
                            fontWeight: isActive ? 800 : 700,
                            color: isActive ? "text.primary" : "text.secondary",
                            letterSpacing: "-0.01em",
                            textAlign: "left",
                            transition: "background 120ms ease",
                            "&:hover": { background: isActive ? theme.palette.background.paper : theme.palette.action.hover },
                        }}
                    >
                        {ws.iconImageUrl ? (
                            <Box
                                component="img"
                                src={resolveImageUrl(ws.iconImageUrl)}
                                loading="lazy"
                                sx={{ width: 18, height: 18, borderRadius: "5px", objectFit: "cover", flexShrink: 0 }}
                            />
                        ) : (
                            <Box sx={{
                                width: 8, height: 8,
                                borderRadius: "50%",
                                background: wsColor,
                                flexShrink: 0,
                            }} />
                        )}
                        <Box component="span" sx={{
                            flex: 1, minWidth: 0,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                            {ws.workspaceName}
                        </Box>
                        {isActive && (
                            <CheckIcon sx={{ fontSize: 14, color: "primary.main", flexShrink: 0 }} />
                        )}
                    </Box>
                );
            })}
        </Stack>
    );
}
