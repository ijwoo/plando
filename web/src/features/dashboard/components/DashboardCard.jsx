import React from "react";
import { Box, Stack, Typography, Button, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import { getGlassSx } from "../../../shared/ui/glassSx.js";

export default function DashboardCard({ title, actionText, onAction, children, sx = {}, hideHeader = false }) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));

    return (
        <Box
            sx={{
                borderRadius: "var(--plando-radius-card)",
                bgcolor: "background.paper",
                ...(isMobile ? getGlassSx(theme) : {}),
                boxShadow: "var(--plando-elev-1)",
                ...sx,
            }}
        >
            <Box sx={{ p: { xs: 2, md: 2.5 } }}>
                {!hideHeader && (title || actionText) && (
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                        <Typography
                            sx={{
                                fontSize: "var(--plando-type-title3-size)",
                                fontWeight: "var(--plando-type-title3-weight)",
                                letterSpacing: "var(--plando-type-title3-ls)",
                            }}
                        >
                            {title}
                        </Typography>
                        {actionText && (
                            <Button
                                endIcon={<ChevronRightRoundedIcon sx={{ fontSize: "16px !important" }} />}
                                onClick={onAction}
                                size="small"
                                sx={{
                                    minWidth: 0,
                                    px: 0.5,
                                    color: "text.secondary",
                                    fontWeight: 600,
                                    fontSize: 13,
                                    letterSpacing: "-0.01em",
                                }}
                            >
                                {actionText}
                            </Button>
                        )}
                    </Stack>
                )}
                {children}
            </Box>
        </Box>
    );
}
