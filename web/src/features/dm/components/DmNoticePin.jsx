import React, { useMemo, useState } from "react";
import { Box, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { Z } from "../../../shared/ui/zIndex.js";

export default function DmNoticePin({ messages, isDark, isDesktop = false }) {
    const theme = useTheme();
    const [expanded, setExpanded] = useState(false);
    const [dismissedId, setDismissedId] = useState(null);

    const latestNotice = useMemo(() => {
        if (!Array.isArray(messages) || messages.length === 0) return null;
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i]?.tag === "NOTICE") return messages[i];
        }
        return null;
    }, [messages]);

    if (!latestNotice) return null;
    if (dismissedId === latestNotice.id) return null;

    const senderName = latestNotice.senderName || latestNotice.senderEmail?.split("@")[0] || "";
    const fullContent = (latestNotice.content || "").trim();
    const firstLine = fullContent.split(/\r?\n/, 1)[0] || "";
    const hasMore = fullContent !== firstLine || firstLine.length > 60;

    const accent = isDark ? "rgba(148,163,184,0.7)" : "rgba(100,116,139,0.8)";

    const containerSx = isDesktop
        ? {
            flexShrink: 0,
            mx: 1, mt: 0.5,
            px: 1.5, py: 0.875,
            borderRadius: "10px",
            border: "1px solid",
            borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
            bgcolor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
        }
        : {
            position: "absolute",
            top: 64,
            left: 10,
            right: 10,
            zIndex: Z.STICKY,
            borderRadius: "10px",
            border: "1px solid",
            borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
            bgcolor: isDark
                ? "rgba(30,30,40,0.92)"
                : "rgba(255,255,255,0.92)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            boxShadow: isDark
                ? "0 2px 8px rgba(0,0,0,0.3)"
                : "0 1px 4px rgba(0,0,0,0.06)",
            px: 1.25, py: 0.75,
        };

    return (
        <Box sx={containerSx}>
            <Box
                onClick={hasMore ? () => setExpanded((v) => !v) : undefined}
                sx={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 0.875,
                    cursor: hasMore ? "pointer" : "default",
                    "&:active": hasMore ? { opacity: 0.7 } : undefined,
                }}
            >
                <PushPinOutlinedIcon sx={{ fontSize: 14, color: accent, mt: "3px", flexShrink: 0, transform: "rotate(45deg)" }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <Typography sx={{
                            fontSize: 11, fontWeight: 600, color: accent,
                            lineHeight: 1.2, letterSpacing: "0.01em",
                        }}>
                            고정됨{senderName ? ` · ${senderName}` : ""}
                        </Typography>
                    </Box>
                    <Typography
                        sx={{
                            fontSize: 13, fontWeight: 400,
                            color: theme.palette.text.primary,
                            lineHeight: 1.45,
                            mt: 0.125,
                            whiteSpace: expanded ? "pre-wrap" : "nowrap",
                            overflow: expanded ? "visible" : "hidden",
                            textOverflow: expanded ? "clip" : "ellipsis",
                            wordBreak: "break-word",
                        }}
                    >
                        {expanded ? fullContent : firstLine}
                    </Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0, flexShrink: 0, mt: "1px" }}>
                    {hasMore && (
                        expanded
                            ? <ExpandMoreRoundedIcon sx={{ fontSize: 16, color: "text.disabled", transform: "rotate(180deg)" }} />
                            : <ChevronRightRoundedIcon sx={{ fontSize: 16, color: "text.disabled" }} />
                    )}
                    <Box
                        component="button"
                        onClick={(e) => { e.stopPropagation(); setDismissedId(latestNotice.id); }}
                        onPointerDown={(e) => e.stopPropagation()}
                        sx={{
                            border: "none", background: "none", cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            p: 0.25, borderRadius: "6px", color: "text.disabled",
                            transition: "color 0.15s, background 0.15s",
                            "&:hover": { color: "text.secondary", bgcolor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" },
                        }}
                        aria-label="공지 닫기"
                    >
                        <CloseRoundedIcon sx={{ fontSize: 14 }} />
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}
