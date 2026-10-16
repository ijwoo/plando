import React from "react";
import { Box, Typography, Stack, Chip } from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { buildCustomPalette } from "../../../shared/ui/theme.js";

/**
 * 커스텀 테마 실시간 미리보기.
 * primaryColor / baseMode / bgColor / cardColor 변경 시 즉시 반영.
 * 작은 sample (텍스트, 카드, 버튼, chip)으로 결과를 보여준다.
 */
export default function CustomThemePreview({ primaryColor, baseMode, bgColor, cardColor }) {
    const palette = buildCustomPalette(primaryColor, baseMode, bgColor, cardColor || null);
    const theme = React.useMemo(
        () =>
            createTheme({
                palette: {
                    mode: palette.muiMode,
                    primary: palette.primary,
                    background: palette.background,
                    divider: palette.divider,
                    text: palette.text,
                    action: palette.action,
                },
            }),
        [palette.muiMode, palette.primary.main, palette.background.default, palette.background.paper]
    );

    return (
        <ThemeProvider theme={theme}>
            <Box
                sx={{
                    p: 2,
                    borderRadius: 2,
                    bgcolor: palette.background.default,
                    border: "1px solid",
                    borderColor: palette.divider,
                    transition: "background 0.15s",
                }}
            >
                {/* sample 카드 */}
                <Box
                    sx={{
                        p: 1.75,
                        borderRadius: 1.75,
                        bgcolor: palette.background.paper,
                        border: "1px solid",
                        borderColor: palette.divider,
                        mb: 1.25,
                    }}
                >
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.75 }}>
                        <Box
                            sx={{
                                width: 16,
                                height: 16,
                                borderRadius: "50%",
                                bgcolor: palette.primary.main,
                                flexShrink: 0,
                            }}
                        />
                        <Typography sx={{ fontWeight: 700, fontSize: 13, color: palette.text.primary }}>
                            오늘 회의 준비
                        </Typography>
                    </Stack>
                    <Typography sx={{ fontSize: 11.5, color: palette.text.secondary, mb: 1 }}>
                        스프린트 회고 · 마감 5월 10일
                    </Typography>
                    <Stack direction="row" spacing={0.5}>
                        <Chip
                            size="small"
                            label="높음"
                            sx={{
                                fontSize: 10,
                                height: 20,
                                bgcolor: palette.primary.main,
                                color: "#fff",
                            }}
                        />
                        <Chip
                            size="small"
                            label="진행 중"
                            variant="outlined"
                            sx={{
                                fontSize: 10,
                                height: 20,
                                borderColor: palette.divider,
                                color: palette.text.secondary,
                            }}
                        />
                    </Stack>
                </Box>

                {/* sample 액션 */}
                <Stack direction="row" spacing={1}>
                    <Box
                        sx={{
                            flex: 1,
                            py: 0.875,
                            borderRadius: 1.5,
                            bgcolor: palette.primary.main,
                            color: "#fff",
                            fontSize: 12,
                            fontWeight: 700,
                            textAlign: "center",
                        }}
                    >
                        저장
                    </Box>
                    <Box
                        sx={{
                            flex: 1,
                            py: 0.875,
                            borderRadius: 1.5,
                            border: "1px solid",
                            borderColor: palette.divider,
                            color: palette.text.primary,
                            fontSize: 12,
                            fontWeight: 600,
                            textAlign: "center",
                        }}
                    >
                        취소
                    </Box>
                </Stack>
            </Box>
        </ThemeProvider>
    );
}
