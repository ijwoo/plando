import React from "react";
import { Box } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import GridViewRoundedIcon from "@mui/icons-material/GridViewRounded";

/**
 * 팀 모집 카드 (보라 그라데이션 + BETA 뱃지).
 * Collapsed 시 부모가 숨기는 것이 일관성 — 이 컴포넌트는 expanded 전용.
 */
export default function SidebarRecruitCard({ active, onClick }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";

    return (
        <Box sx={{ mt: 1.5, mb: 0.5 }}>
            <Box
                component="button"
                onClick={onClick}
                sx={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 1.25,
                    height: 42,
                    px: 1.5,
                    borderRadius: "12px",
                    border: "1px solid",
                    borderColor: active ? "rgba(155,123,245,0.4)" : "rgba(155,123,245,0.18)",
                    background: active
                        ? (isDark
                            ? "linear-gradient(135deg, rgba(155,123,245,0.22), rgba(124,92,240,0.18))"
                            : "linear-gradient(135deg, rgba(155,123,245,0.14), rgba(124,92,240,0.10))")
                        : (isDark
                            ? "linear-gradient(135deg, rgba(155,123,245,0.07), rgba(124,92,240,0.04))"
                            : "linear-gradient(135deg, rgba(155,123,245,0.05), rgba(124,92,240,0.03))"),
                    cursor: "pointer",
                    fontFamily: "var(--plando-font)",
                    fontSize: 12.5,
                    transition: "background 140ms ease, border-color 140ms ease",
                    "&:hover": {
                        background: isDark
                            ? "linear-gradient(135deg, rgba(155,123,245,0.16), rgba(124,92,240,0.12))"
                            : "linear-gradient(135deg, rgba(155,123,245,0.10), rgba(124,92,240,0.07))",
                    },
                }}
            >
                <Box sx={{
                    width: 24, height: 24, borderRadius: "8px", flexShrink: 0,
                    background: "linear-gradient(135deg, #9B7BF5, #7C5CF0)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: active ? "0 3px 10px rgba(124,92,240,0.5)" : "0 2px 6px rgba(124,92,240,0.3)",
                }}>
                    <GridViewRoundedIcon sx={{ fontSize: 14, color: "#fff" }} />
                </Box>
                <Box component="span" sx={{
                    flex: 1, minWidth: 0,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    fontWeight: active ? 800 : 700,
                    color: active
                        ? (isDark ? "#B89EF8" : "#7C5CF0")
                        : (isDark ? "rgba(155,123,245,0.85)" : "#9B7BF5"),
                    textAlign: "left",
                }}>
                    팀 모집
                </Box>
                <Box component="span" sx={{
                    fontSize: 9, fontWeight: 800,
                    px: "5px", py: "2px",
                    background: "linear-gradient(135deg, #9B7BF5, #7C5CF0)",
                    color: "#fff",
                    borderRadius: 99, letterSpacing: "0.04em",
                    flexShrink: 0, lineHeight: 1.4,
                }}>
                    BETA
                </Box>
            </Box>
        </Box>
    );
}
