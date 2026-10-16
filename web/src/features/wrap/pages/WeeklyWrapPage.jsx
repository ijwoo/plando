import React from "react";
import { Box, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import WeeklyWrapMobile from "./WeeklyWrapMobile.jsx";

export default function WeeklyWrapPage() {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));
    if (isMobile) return <WeeklyWrapMobile />;

    const isDark = theme.palette.mode === "dark";

    return (
        <Box
            sx={{
                width: "100%",
                minHeight: "100vh",
                display: "flex",
                justifyContent: "center",
                alignItems: "flex-start",
                py: 4,
                background: isDark ? "rgba(15,23,42,0.40)" : "rgba(241,243,245,0.55)",
            }}
        >
            <Box
                sx={{
                    width: "100%",
                    maxWidth: 480,
                    minHeight: "calc(100vh - 64px)",
                    borderRadius: 4,
                    overflow: "hidden",
                    position: "relative",
                    transform: "translateZ(0)",
                    boxShadow: isDark
                        ? "0 24px 60px rgba(0,0,0,0.50), 0 0 0 1px rgba(255,255,255,0.05)"
                        : "0 24px 60px rgba(15,23,42,0.10), 0 0 0 1px rgba(15,23,42,0.04)",
                    background: theme.palette.background.default,
                }}
            >
                <WeeklyWrapMobile />
            </Box>
        </Box>
    );
}
