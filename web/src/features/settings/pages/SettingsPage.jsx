import React from "react";
import { Box, Typography, useMediaQuery, useTheme } from "@mui/material";
import { useSettingsState } from "../hooks/useSettingsState.js";
import SettingsPageDesktop from "./SettingsPageDesktop.jsx";
import SettingsPageMobile from "./SettingsPageMobile.jsx";

export default function SettingsPage() {
    const muiTheme = useTheme();
    const isDesktop = useMediaQuery(muiTheme.breakpoints.up("md"));
    const s = useSettingsState();

    if (s.loading) {
        return (
            <Box sx={{ p: { xs: 2, md: 3 } }}>
                <Typography color="text.secondary">설정을 불러오는 중...</Typography>
            </Box>
        );
    }

    return isDesktop
        ? <SettingsPageDesktop s={s} />
        : <SettingsPageMobile s={s} />;
}
