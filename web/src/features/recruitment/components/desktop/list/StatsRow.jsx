import { Box, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { statBoxSx } from "../../common/recruitmentSx";

/**
 * 상단 4개 stats 카드 그리드 (활성/내 신청/북마크/마감 임박).
 * statItems: [{ label, value, helper, Icon }]
 */
export default function StatsRow({ items }) {
    const theme = useTheme();

    return (
        <Box
            sx={{
                display: "grid",
                gridTemplateColumns: {
                    xs: "repeat(2, 1fr)",
                    md: "repeat(4, 1fr)",
                },
                gap: 1.5,
                mb: 3,
            }}
        >
            {items.map(({ label, value, helper, Icon }) => (
                <Box key={label} sx={statBoxSx()}>
                    <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="flex-start"
                        gap={1}
                    >
                        <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{
                                fontSize: 13,
                                color: "text.secondary",
                                fontWeight: 500,
                                letterSpacing: "-0.01em",
                            }}>
                                {label}
                            </Typography>
                            <Typography sx={{
                                fontSize: 26,
                                fontWeight: 700,
                                color: "text.primary",
                                letterSpacing: "-0.03em",
                                mt: 0.625,
                                lineHeight: 1,
                            }}>
                                {value}
                            </Typography>
                        </Box>
                        {Icon && (
                            <Box sx={{
                                width: 38,
                                height: 38,
                                borderRadius: 1.5,
                                bgcolor: alpha(theme.palette.primary.main, 0.10),
                                color: "primary.main",
                                display: "grid",
                                placeItems: "center",
                                flexShrink: 0,
                            }}>
                                <Icon sx={{ fontSize: 18 }} />
                            </Box>
                        )}
                    </Stack>
                    <Typography sx={{
                        fontSize: 12,
                        color: "text.disabled",
                        fontWeight: 500,
                        mt: 1,
                    }}>
                        {helper}
                    </Typography>
                </Box>
            ))}
        </Box>
    );
}
