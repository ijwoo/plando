import React from "react";
import { Box, Stack, Typography } from "@mui/material";
import { detailCardSx, SectionEyebrow } from "./detailHelpers";

/**
 * DetailOverview — 프로젝트 개요 (summary) + 지원자에게 바라는 점 (requirements).
 */
export default function DetailOverview({ item }) {
    if (!item.summary && !item.requirements) return null;
    return (
        <Box sx={detailCardSx}>
            <SectionEyebrow eyebrow="Overview" title="프로젝트 개요" />
            <Stack spacing={2}>
                {item.summary && (
                    <Typography sx={{
                        fontSize: 14,
                        lineHeight: 1.75,
                        color: "text.secondary",
                        fontWeight: 500,
                        letterSpacing: "-0.005em",
                        whiteSpace: "pre-wrap",
                    }}>
                        {item.summary}
                    </Typography>
                )}
                {item.requirements && (
                    <Box>
                        <Typography sx={{
                            fontSize: 11.5,
                            fontWeight: 700,
                            color: "text.disabled",
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            mb: 1,
                        }}>
                            지원자에게 바라는 점
                        </Typography>
                        <Typography sx={{
                            fontSize: 14,
                            lineHeight: 1.75,
                            color: "text.secondary",
                            fontWeight: 500,
                            letterSpacing: "-0.005em",
                            whiteSpace: "pre-wrap",
                        }}>
                            {item.requirements}
                        </Typography>
                    </Box>
                )}
            </Stack>
        </Box>
    );
}
