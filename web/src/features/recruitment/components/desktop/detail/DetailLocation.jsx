import React from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import NearMeRoundedIcon from "@mui/icons-material/NearMeRounded";
import RecruitMapCanvas from "../../common/RecruitMapCanvas";
import { SHADOW } from "../../common/recruitmentSx";

/**
 * DetailLocation — 위치 카드 (정적 지도 + 길찾기 + 큰 지도로 보기)
 */
export default function DetailLocation({
    item,
    meetLabel,
    locationText,
    onOpenMapDialog,
}) {
    const theme = useTheme();

    const mapBtnSx = {
        py: 1.125,
        borderRadius: 1,
        bgcolor: "background.paper",
        borderColor: alpha(theme.palette.text.primary, 0.12),
        color: "text.secondary",
        fontSize: 12.5,
        fontWeight: 700,
        textTransform: "none",
        boxShadow: SHADOW.sm,
        "&:hover": {
            bgcolor: alpha(theme.palette.text.primary, 0.03),
            color: "text.primary",
        },
    };

    return (
        <Box sx={{
            bgcolor: "background.paper",
            border: 0,
            borderRadius: 2,
            boxShadow: SHADOW.card,
            overflow: "hidden",
            mb: 2,
        }}>
            {/* Header */}
            <Box sx={{
                p: "20px 24px 14px",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
            }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                        <Box sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            fontSize: 10,
                            fontWeight: 700,
                            px: 1,
                            py: 0.375,
                            borderRadius: 99,
                            bgcolor: alpha(theme.palette.success.main, 0.12),
                            color: "success.main",
                            letterSpacing: "0.05em",
                            textTransform: "uppercase",
                            flexShrink: 0,
                        }}>
                            {meetLabel}
                        </Box>
                        <Typography sx={{
                            fontSize: 15,
                            fontWeight: 700,
                            letterSpacing: "-0.02em",
                            color: "text.primary",
                            lineHeight: 1.25,
                        }}>
                            {locationText}
                        </Typography>
                    </Stack>
                    {item.locationText && item.locationText !== locationText && (
                        <Typography sx={{
                            fontSize: 12,
                            color: "text.secondary",
                            fontWeight: 500,
                            mt: 0.5,
                        }}>
                            {item.locationText}
                        </Typography>
                    )}
                </Box>
            </Box>

            {/* 정적 지도 */}
            <Box sx={{
                height: 240,
                borderTop: "1px solid",
                borderColor: alpha(theme.palette.text.primary, 0.06),
                overflow: "hidden",
            }}>
                <RecruitMapCanvas
                    items={[item]}
                    selected={item}
                    onSelect={() => {}}
                    level={4}
                    kakaoReady
                    staticMap
                />
            </Box>

            {/* Map action buttons */}
            <Stack
                direction="row"
                gap={1}
                sx={{
                    p: "14px 20px",
                    bgcolor: "background.paper",
                    borderTop: "1px solid",
                    borderColor: alpha(theme.palette.text.primary, 0.06),
                }}
            >
                <Button
                    fullWidth
                    variant="outlined"
                    size="small"
                    startIcon={<OpenInNewRoundedIcon sx={{ fontSize: 13 }} />}
                    onClick={onOpenMapDialog}
                    sx={mapBtnSx}
                >
                    큰 지도로 보기
                </Button>
                <Button
                    fullWidth
                    variant="outlined"
                    size="small"
                    startIcon={<NearMeRoundedIcon sx={{ fontSize: 13 }} />}
                    onClick={() => {
                        if (item.locationLat && item.locationLng) {
                            window.open(
                                `https://map.kakao.com/link/to/${encodeURIComponent(locationText)},${item.locationLat},${item.locationLng}`,
                                "_blank"
                            );
                        }
                    }}
                    sx={mapBtnSx}
                >
                    길찾기
                </Button>
            </Stack>
        </Box>
    );
}
